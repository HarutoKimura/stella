import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { SessionSummaryInSchema } from '@/lib/schema'
import { calculateMetrics, estimateCefrLevel } from '@/lib/metricsCalculator'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = SessionSummaryInSchema.parse(body)

    const supabase = await createServerSupabaseClient()

    // Get current user
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = userProfile.id

    // Get user's CEFR level
    const { data: userData } = await supabase
      .from('users')
      .select('cefr_level')
      .eq('id', userId)
      .single()

    const userCefrLevel = userData?.cefr_level || 'B1'

    // Get session start time to calculate duration
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('started_at')
      .eq('id', input.sessionId)
      .single()

    const sessionDurationMs = sessionData
      ? new Date().getTime() - new Date(sessionData.started_at).getTime()
      : 0

    // COMPREHENSIVE POST-SESSION ANALYSIS
    // Call analyze-transcript to get thorough grammar/vocabulary assessment
    let comprehensiveCorrections = input.corrections // Fallback to tutor corrections
    let complexityAnalysis = null

    try {
      // Use the request's host to determine the correct URL
      const host = req.headers.get('host') || 'localhost:3000'
      const protocol = host.includes('localhost') ? 'http' : 'https'
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`

      const analyzeResponse = await fetch(`${baseUrl}/api/analyze-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: input.transcript || [],
          userCefrLevel,
        }),
      })

      if (analyzeResponse.ok) {
        const analysis = await analyzeResponse.json()

        // Convert comprehensive analysis to corrections format with metadata
        const grammarCorrections = (analysis.grammar_errors || []).map((err: any) => ({
          type: 'grammar' as const,
          example: err.text,
          correction: err.correction,
          error_type: err.error_type,
          severity: err.severity,
        }))

        const vocabCorrections = (analysis.vocabulary_issues || []).map((issue: any) => ({
          type: 'vocab' as const,
          example: issue.text,
          correction: issue.suggestion,
          reason: issue.reason,
          issue_type: issue.issue_type,
        }))

        comprehensiveCorrections = [...grammarCorrections, ...vocabCorrections]
        complexityAnalysis = analysis.complexity_analysis

        console.log('[Summarize] Comprehensive analysis found:', {
          grammar_errors: grammarCorrections.length,
          vocab_issues: vocabCorrections.length,
          complexity: complexityAnalysis,
        })
      } else {
        console.warn('[Summarize] Analyze-transcript failed, using tutor corrections')
      }
    } catch (error) {
      console.error('[Summarize] Failed to analyze transcript:', error)
      console.warn('[Summarize] Falling back to tutor corrections')
    }

    // Retrieve Azure pronunciation scores from session summary (if available)
    let azurePronunciationScore: number | undefined
    let azureAccuracyScore: number | undefined
    let azureFluencyScore: number | undefined
    let azureProsodyScore: number | undefined
    let azureCompletenessScore: number | undefined

    try {
      const { data: sessionWithSummary } = await supabase
        .from('sessions')
        .select('summary')
        .eq('id', input.sessionId)
        .single()

      if (sessionWithSummary?.summary?.pronunciation_assessment?.scores) {
        const scores = sessionWithSummary.summary.pronunciation_assessment.scores
        azurePronunciationScore = scores.pronunciationScore
        azureAccuracyScore = scores.accuracyScore
        azureFluencyScore = scores.fluencyScore
        azureProsodyScore = scores.prosodyScore
        azureCompletenessScore = scores.completenessScore
        console.log('[Summarize] Using Azure pronunciation scores from session:', scores)
      } else {
        console.log('[Summarize] No Azure pronunciation scores found in session summary')
      }
    } catch (error) {
      console.warn('[Summarize] Failed to retrieve pronunciation scores:', error)
    }

    // Calculate comprehensive metrics using thorough analysis
    const metrics = calculateMetrics({
      transcript: input.transcript || [],
      corrections: comprehensiveCorrections, // Use comprehensive analysis instead of sparse tutor corrections
      usedTargets: input.usedTargets,
      missedTargets: input.missedTargets,
      sessionDurationMs,
      userCefrLevel,
      azurePronunciationScore, // Pass real Azure score if available
    })

    // Update session summary with transcript and comprehensive analysis
    await supabase
      .from('sessions')
      .update({
        ended_at: new Date().toISOString(),
        speaking_ms: Math.round(sessionDurationMs * (metrics.turn_ratio / 100)),
        summary: {
          usedTargets: input.usedTargets,
          missedTargets: input.missedTargets,
          corrections: comprehensiveCorrections, // Store comprehensive analysis, not sparse tutor corrections
          transcript: input.transcript || [],
          complexity: complexityAnalysis, // Store complexity analysis for future reference
        },
      })
      .eq('id', input.sessionId)

    // Update targets
    // Mark used targets as 'attempted' or 'mastered' (mastered if used ≥2 times)
    for (const phrase of input.usedTargets) {
      const { data: existing } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', userId)
        .eq('phrase', phrase)
        .single()

      if (existing) {
        // Count how many times used (simple heuristic: if in usedTargets, assume used 2+ times = mastered)
        const status = input.usedTargets.filter((p) => p === phrase).length >= 2 ? 'mastered' : 'attempted'

        await supabase
          .from('targets')
          .update({
            status,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      }
    }

    // Upsert errors from comprehensive analysis (only save meaningful corrections where example differs from correction)
    for (const correction of comprehensiveCorrections) {
      // Skip if example and correction are the same (not a real correction)
      if (correction.example.trim() === correction.correction.trim()) {
        console.log('[Summarize] Skipping non-correction:', correction.example)
        continue
      }

      const { data: existing } = await supabase
        .from('errors')
        .select('*')
        .eq('user_id', userId)
        .eq('example', correction.example)
        .single()

      if (existing) {
        await supabase
          .from('errors')
          .update({
            count: existing.count + 1,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('errors').insert({
          user_id: userId,
          type: correction.type,
          example: correction.example,
          correction: correction.correction,
          count: 1,
        })
      }
    }

    // Insert enhanced fluency snapshot with Azure scores
    console.log('[Summarize] Inserting fluency_snapshots for session:', input.sessionId, 'user:', userId)
    const { data: fluencyData, error: fluencyError } = await supabase.from('fluency_snapshots').insert({
      user_id: userId,
      session_id: input.sessionId,
      wpm: metrics.wpm,
      filler_rate: metrics.filler_rate,
      avg_pause_ms: metrics.avg_pause_ms,
      mean_utterance_length: metrics.mean_utterance_length,
      unique_words_count: metrics.unique_words,
      total_words_count: metrics.total_words,
      grammar_accuracy: metrics.grammar_accuracy,
      pronunciation_score: metrics.pronunciation_score,
      turn_ratio: metrics.turn_ratio,
      confidence_score: metrics.confidence_score,
      // Include detailed Azure pronunciation scores
      accuracy_score: azureAccuracyScore,
      fluency_score: azureFluencyScore,
      prosody_score: azureProsodyScore,
      completeness_score: azureCompletenessScore,
    }).select()

    if (fluencyError) {
      console.error('[Summarize] Failed to insert fluency_snapshots:', fluencyError)
    } else {
      console.log('[Summarize] Successfully inserted fluency_snapshots:', fluencyData)
    }

    // Insert comprehensive progress metrics
    await supabase.from('progress_metrics').insert({
      user_id: userId,
      session_id: input.sessionId,
      fluency_score: metrics.fluency_score,
      grammar_score: metrics.grammar_score,
      vocabulary_score: metrics.vocabulary_score,
      comprehension_score: metrics.comprehension_score,
      confidence_score: metrics.confidence_score,
      total_words: metrics.total_words,
      unique_words: metrics.unique_words,
      lexical_diversity: metrics.lexical_diversity,
      cefr_distribution: metrics.cefr_distribution,
      grammar_errors: metrics.grammar_errors,
      vocab_errors: metrics.vocab_errors,
      pronunciation_errors: metrics.pronunciation_errors,
      total_errors: metrics.total_errors,
      response_time_avg_ms: metrics.response_time_avg_ms,
      topic_switches: 0, // TODO: implement topic detection
      egi_score: metrics.egi_score,
    })

    // Estimate and record CEFR trajectory
    const cefrEstimate = estimateCefrLevel(metrics)
    await supabase.from('cefr_trajectory').insert({
      user_id: userId,
      estimated_cefr: cefrEstimate.level,
      confidence_level: cefrEstimate.confidence,
      evaluation_basis: cefrEstimate.basis,
      notes: `Auto-estimated from session ${input.sessionId}. EGI: ${metrics.egi_score}`,
    })

    // Update or create weekly progress
    const weekStart = getWeekStartDate(new Date())
    const { data: weeklyData } = await supabase
      .from('weekly_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', weekStart)
      .single()

    const phrasesThisSession = input.usedTargets.filter((t, _i, arr) =>
      arr.filter(x => x === t).length >= 2
    ).length

    if (weeklyData) {
      // Update existing weekly progress
      await supabase
        .from('weekly_progress')
        .update({
          total_sessions: weeklyData.total_sessions + 1,
          total_minutes: weeklyData.total_minutes + Math.round(sessionDurationMs / 60000),
          avg_fluency_score: ((weeklyData.avg_fluency_score * weeklyData.total_sessions) + metrics.fluency_score) / (weeklyData.total_sessions + 1),
          avg_grammar_score: ((weeklyData.avg_grammar_score * weeklyData.total_sessions) + metrics.grammar_score) / (weeklyData.total_sessions + 1),
          avg_vocabulary_score: ((weeklyData.avg_vocabulary_score * weeklyData.total_sessions) + metrics.vocabulary_score) / (weeklyData.total_sessions + 1),
          avg_egi_score: ((weeklyData.avg_egi_score * weeklyData.total_sessions) + metrics.egi_score) / (weeklyData.total_sessions + 1),
          phrases_mastered: weeklyData.phrases_mastered + phrasesThisSession,
          new_vocabulary: Math.max(weeklyData.new_vocabulary, metrics.unique_words),
        })
        .eq('id', weeklyData.id)
    } else {
      // Create new weekly progress
      await supabase.from('weekly_progress').insert({
        user_id: userId,
        week_start_date: weekStart,
        total_sessions: 1,
        total_minutes: Math.round(sessionDurationMs / 60000),
        avg_fluency_score: metrics.fluency_score,
        avg_grammar_score: metrics.grammar_score,
        avg_vocabulary_score: metrics.vocabulary_score,
        avg_egi_score: metrics.egi_score,
        phrases_mastered: phrasesThisSession,
        new_vocabulary: metrics.unique_words,
        days_practiced: 1,
      })
    }

    return NextResponse.json({
      success: true,
      metrics: {
        egi_score: metrics.egi_score,
        fluency_score: metrics.fluency_score,
        grammar_score: metrics.grammar_score,
        vocabulary_score: metrics.vocabulary_score,
        estimated_cefr: cefrEstimate.level,
      }
    })
  } catch (error) {
    console.error('Summarize API error:', error)
    return NextResponse.json(
      { error: 'Failed to save session summary' },
      { status: 500 }
    )
  }
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStartDate(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}
