import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { SessionSummaryInSchema } from '@/lib/schema'

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

    // Update session summary with transcript
    await supabase
      .from('sessions')
      .update({
        ended_at: new Date().toISOString(),
        summary: {
          usedTargets: input.usedTargets,
          missedTargets: input.missedTargets,
          corrections: input.corrections,
          transcript: input.transcript || [], // Save full transcript
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

    // Upsert errors
    for (const correction of input.corrections) {
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

    // Insert fluency snapshot
    if (input.metrics) {
      await supabase.from('fluency_snapshots').insert({
        user_id: userId,
        session_id: input.sessionId,
        wpm: input.metrics.wpm,
        filler_rate: input.metrics.filler_rate,
        avg_pause_ms: input.metrics.avg_pause_ms,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Summarize API error:', error)
    return NextResponse.json(
      { error: 'Failed to save session summary' },
      { status: 500 }
    )
  }
}
