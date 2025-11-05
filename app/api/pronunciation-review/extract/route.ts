import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabaseServer'
import { generateNativeTTS } from '@/lib/azurePronunciation'

/**
 * POST /api/pronunciation-review/extract
 * Extract pronunciation problems from existing session assessment data
 * This is called server-side to avoid re-processing audio
 *
 * Body: { sessionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Pronunciation Review Extract] POST request received')
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    console.log(`[Pronunciation Review Extract] Processing session ${sessionId}`)

    // Get session data with pronunciation assessment
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('summary')
      .eq('id', sessionId)
      .eq('user_id', userProfile.id)
      .single()

    if (sessionError || !session) {
      console.error('[Pronunciation Review Extract] Session not found:', sessionError)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Extract pronunciation assessment from summary
    const pronunciationAssessment = session.summary?.pronunciation_assessment
    if (!pronunciationAssessment || !pronunciationAssessment.words) {
      console.log('[Pronunciation Review Extract] No pronunciation assessment data found')
      return NextResponse.json({
        success: true,
        processedWords: 0,
        problemsFound: 0,
        message: 'No pronunciation data available'
      })
    }

    const words = pronunciationAssessment.words
    console.log(`[Pronunciation Review Extract] Found ${words.length} assessed words`)

    // Filter problem words (accuracy < 85) - temporarily higher threshold for testing
    // TODO: Change back to < 60 for production
    const problemWords = words.filter((w: any) => w.accuracyScore < 85)
    console.log(`[Pronunciation Review Extract] Found ${problemWords.length} problem words (threshold: <85 for testing)`)

    // Deduplicate words - keep only the WORST pronunciation of each unique word
    const wordMap = new Map<string, any>()
    for (const word of problemWords) {
      const wordLower = word.word.toLowerCase()
      const existing = wordMap.get(wordLower)

      // Keep the word with the lowest accuracy score (worst pronunciation)
      if (!existing || word.accuracyScore < existing.accuracyScore) {
        wordMap.set(wordLower, word)
      }
    }

    const uniqueProblemWords = Array.from(wordMap.values())
    console.log(`[Pronunciation Review Extract] After deduplication: ${uniqueProblemWords.length} unique problem words`)

    // Use service role client for DB operations (we've already verified session ownership)
    const serviceClient = createServiceRoleClient()

    // Delete existing pronunciation problems for this session to avoid duplicates
    // This allows re-running the extraction with updated data
    const { error: deleteError } = await serviceClient
      .from('pronunciation_problems')
      .delete()
      .eq('session_id', sessionId)

    if (deleteError) {
      console.error('[Pronunciation Review Extract] Failed to delete existing problems:', deleteError)
    } else {
      console.log('[Pronunciation Review Extract] Cleared existing pronunciation problems for re-extraction')
    }

    let successCount = 0

    // Process each unique problem word
    for (const word of uniqueProblemWords) {
      try {
        // Generate native TTS reference
        console.log(`[Pronunciation Review Extract] Generating TTS for "${word.word}"`)
        const nativeTtsUrl = await generateNativeTTS(word.word, userProfile.id, serviceClient)

        // Extract timing and audio URL from word data
        const startOffsetMs = word.offset ? Math.floor(word.offset / 10000) : null // Convert 100ns to ms
        const endOffsetMs = word.offset && word.duration
          ? Math.floor((word.offset + word.duration) / 10000)
          : null
        const userAudioUrl = word.audioUrl || null

        console.log(`[Pronunciation Review Extract] Word timing: ${startOffsetMs}ms - ${endOffsetMs}ms, audio: ${userAudioUrl ? 'available' : 'none'}`)

        // Insert problem word with user audio
        const { error: problemError } = await serviceClient
          .from('pronunciation_problems')
          .insert({
            session_id: sessionId,
            segment_id: null, // No segment reference in this approach
            word: word.word,
            accuracy: word.accuracyScore,
            start_offset_ms: startOffsetMs,
            end_offset_ms: endOffsetMs,
            audio_user_url: userAudioUrl, // User's audio segment URL
            audio_native_url: nativeTtsUrl,
          })

        if (problemError) {
          console.error('[Pronunciation Review Extract] Failed to insert problem word:', problemError)
        } else {
          successCount++
          console.log(`[Pronunciation Review Extract] Inserted problem word: "${word.word}" (${word.accuracyScore})`)
        }
      } catch (err) {
        console.error(`[Pronunciation Review Extract] Error processing word "${word.word}":`, err)
        // Continue with next word
      }
    }

    console.log(`[Pronunciation Review Extract] Processing complete: ${successCount}/${uniqueProblemWords.length} unique problems saved`)

    return NextResponse.json({
      success: true,
      processedWords: words.length,
      problemsFound: successCount,
      uniqueProblems: uniqueProblemWords.length,
    })
  } catch (error) {
    console.error('[Pronunciation Review Extract] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to extract pronunciation problems',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
