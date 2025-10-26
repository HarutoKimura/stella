import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * Create a new learning session
 *
 * This endpoint is called when starting a new conversation session.
 * It creates a session record and optionally inserts target phrases.
 */
export async function POST(req: NextRequest) {
  try {
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
    const { userId, targets } = body

    // Validate userId matches authenticated user
    if (userId !== userProfile.id) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 })
    }

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (sessionError || !session) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Insert target phrases if provided
    if (targets && Array.isArray(targets) && targets.length > 0) {
      const targetInserts = targets.map((target: any) => ({
        user_id: userId,
        phrase: target.phrase,
        cefr: target.cefr || 'B1',
        status: 'planned',
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }))

      const { error: targetsError } = await supabase
        .from('targets')
        .insert(targetInserts)

      if (targetsError) {
        console.error('Targets insertion error:', targetsError)
        // Don't fail the whole request if targets fail - session is still created
      }
    }

    return NextResponse.json({
      sessionId: session.id,
      userId: session.user_id,
      startedAt: session.started_at,
    })
  } catch (error) {
    console.error('Session create API error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
