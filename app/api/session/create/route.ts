import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * POST /api/session/create
 *
 * Creates a new session and inserts target phrases for practice
 *
 * Body:
 * {
 *   userId: string,
 *   targets: Array<{ phrase: string, cefr?: string }>
 * }
 *
 * Returns:
 * {
 *   sessionId: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, targets } = body

    if (!userId || !targets) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, targets' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the userId belongs to the authenticated user
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found or unauthorized' },
        { status: 403 }
      )
    }

    // Create new session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        started_at: new Date().toISOString(),
        student_turns: 0,
        tutor_turns: 0,
        speaking_ms: 0,
        adoption_score: 0,
        summary: {},
      })
      .select()
      .single()

    if (sessionError || !session) {
      console.error('Failed to create session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Insert target phrases for this session
    if (targets.length > 0) {
      const targetInserts = targets.map((target: { phrase: string; cefr?: string }) => ({
        user_id: userId,
        phrase: target.phrase,
        cefr: target.cefr || 'B1',
        status: 'planned',
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }))

      // Check if targets already exist, only insert new ones
      const existingTargets = await supabase
        .from('targets')
        .select('phrase')
        .eq('user_id', userId)
        .in('phrase', targets.map((t: { phrase: string }) => t.phrase))

      const existingPhrases = new Set(existingTargets.data?.map((t) => t.phrase) || [])
      const newTargets = targetInserts.filter((t) => !existingPhrases.has(t.phrase))

      if (newTargets.length > 0) {
        const { error: targetError } = await supabase
          .from('targets')
          .insert(newTargets)

        if (targetError) {
          console.error('Failed to insert targets:', targetError)
          // Don't fail the whole request if targets fail
        }
      }
    }

    return NextResponse.json({
      sessionId: session.id,
    })
  } catch (error) {
    console.error('Session create error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
