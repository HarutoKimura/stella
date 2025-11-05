import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabaseServer'
import {
  assessPronunciationFromUrl,
  generateNativeTTS,
} from '@/lib/azurePronunciation'

/**
 * POST /api/pronunciation-review
 * Process audio segments for pronunciation assessment and extract problem words
 *
 * Body: {
 *   sessionId: string
 *   segments: Array<{ audioUrl: string, transcript: string }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Pronunciation Review] POST request received')
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
    const { sessionId, segments } = body

    if (!sessionId || !Array.isArray(segments)) {
      return NextResponse.json(
        { error: 'sessionId and segments array required' },
        { status: 400 }
      )
    }

    console.log(`[Pronunciation Review] Processing ${segments.length} segments for session ${sessionId}`)

    let totalProblems = 0
    let processedSegments = 0

    // Process each segment
    for (const segment of segments) {
      try {
        const { audioUrl, transcript } = segment

        if (!audioUrl) {
          console.warn('[Pronunciation Review] Skipping segment without audioUrl')
          continue
        }

        console.log(`[Pronunciation Review] Assessing segment: ${transcript?.substring(0, 50)}...`)

        // Call Azure Pronunciation Assessment
        const assessment = await assessPronunciationFromUrl(audioUrl, undefined)

        if (!assessment) {
          console.log('[Pronunciation Review] No speech detected in segment, skipping')
          continue
        }

        // Store segment assessment in database
        const { data: segmentData, error: segmentError } = await supabase
          .from('pronunciation_segments')
          .insert({
            session_id: sessionId,
            audio_url: audioUrl,
            transcript: transcript || assessment.recognizedText,
            azure_json: assessment.rawJson,
          })
          .select()
          .single()

        if (segmentError) {
          console.error('[Pronunciation Review] Failed to insert segment:', segmentError)
          continue
        }

        processedSegments++

        // Extract problem words (accuracy < 60)
        const problemWords = assessment.words.filter((w) => w.accuracyScore < 60)

        console.log(`[Pronunciation Review] Found ${problemWords.length} problem words in segment`)

        for (const word of problemWords) {
          try {
            // Generate native TTS reference
            const nativeTtsUrl = await generateNativeTTS(word.word, userProfile.id, supabase)

            // Insert problem word
            const { error: problemError } = await supabase
              .from('pronunciation_problems')
              .insert({
                session_id: sessionId,
                segment_id: segmentData.id,
                word: word.word,
                accuracy: word.accuracyScore,
                start_offset_ms: word.offset ? Math.floor(word.offset / 10000) : null, // Convert from 100ns to ms
                end_offset_ms: word.offset && word.duration
                  ? Math.floor((word.offset + word.duration) / 10000)
                  : null,
                audio_user_url: audioUrl,
                audio_native_url: nativeTtsUrl,
              })

            if (problemError) {
              console.error('[Pronunciation Review] Failed to insert problem word:', problemError)
            } else {
              totalProblems++
            }
          } catch (ttsError) {
            console.error('[Pronunciation Review] TTS generation failed for word:', word.word, ttsError)
            // Continue even if TTS fails - we can still store the problem without native audio
            const { error: problemError } = await supabase
              .from('pronunciation_problems')
              .insert({
                session_id: sessionId,
                segment_id: segmentData.id,
                word: word.word,
                accuracy: word.accuracyScore,
                start_offset_ms: word.offset ? Math.floor(word.offset / 10000) : null,
                end_offset_ms: word.offset && word.duration
                  ? Math.floor((word.offset + word.duration) / 10000)
                  : null,
                audio_user_url: audioUrl,
                audio_native_url: null,
              })

            if (!problemError) {
              totalProblems++
            }
          }
        }
      } catch (segmentError) {
        console.error('[Pronunciation Review] Error processing segment:', segmentError)
        // Continue with next segment
      }
    }

    console.log(`[Pronunciation Review] Processing complete: ${processedSegments} segments, ${totalProblems} problems found`)

    return NextResponse.json({
      success: true,
      processedSegments,
      problemsFound: totalProblems,
    })
  } catch (error) {
    console.error('[Pronunciation Review] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process pronunciation review',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/pronunciation-review?sessionId=xxx
 * Fetch pronunciation problems for a specific session
 */
export async function GET(req: NextRequest) {
  try {
    console.log('[Pronunciation Review] GET request received')
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get sessionId from query params
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter required' },
        { status: 400 }
      )
    }

    console.log(`[Pronunciation Review] Fetching problems for session ${sessionId}`)
    console.log(`[Pronunciation Review] Using auth user:`, authUser.id)

    // First, verify the session exists and belongs to this user
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      console.error('[Pronunciation Review] User profile not found')
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', userProfile.id)
      .single()

    if (!session) {
      console.error('[Pronunciation Review] Session not found or not owned by user')
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    console.log(`[Pronunciation Review] Session verified, user_id: ${session.user_id}`)

    // Use service role client to bypass RLS (we've already verified ownership above)
    const serviceClient = createServiceRoleClient()

    // Fetch pronunciation problems for this session, ordered by accuracy (worst first)
    const { data: problems, error } = await serviceClient
      .from('pronunciation_problems')
      .select('*')
      .eq('session_id', sessionId)
      .order('accuracy', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[Pronunciation Review] Failed to fetch problems:', error)
      console.error('[Pronunciation Review] Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: 'Failed to fetch pronunciation problems', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[Pronunciation Review] Query completed, found ${problems?.length || 0} problems`)
    if (problems && problems.length > 0) {
      console.log(`[Pronunciation Review] First problem:`, problems[0])
    }

    return NextResponse.json({
      success: true,
      problems: problems || [],
      count: problems?.length || 0,
    })
  } catch (error) {
    console.error('[Pronunciation Review] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch pronunciation review',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
