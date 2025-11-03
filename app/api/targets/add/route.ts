import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * POST /api/targets/add
 *
 * Adds a new target phrase to the user's phrase library
 *
 * Body:
 * {
 *   userId: string,
 *   phrase: string,
 *   cefr?: string
 * }
 *
 * Returns:
 * {
 *   success: boolean,
 *   targetId: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, phrase, cefr } = body

    if (!userId || !phrase) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, phrase' },
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
      .select('id, cefr_level')
      .eq('auth_user_id', authUser.id)
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found or unauthorized' },
        { status: 403 }
      )
    }

    // Check if phrase already exists
    const { data: existing } = await supabase
      .from('targets')
      .select('id')
      .eq('user_id', userId)
      .eq('phrase', phrase.trim())
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Phrase already exists in your library' },
        { status: 409 }
      )
    }

    // Insert new target phrase
    const { data: target, error: insertError } = await supabase
      .from('targets')
      .insert({
        user_id: userId,
        phrase: phrase.trim(),
        cefr: cefr || profile.cefr_level || 'B1',
        status: 'planned',
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError || !target) {
      console.error('Failed to insert target:', insertError)
      return NextResponse.json(
        { error: 'Failed to add phrase' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      targetId: target.id,
    })
  } catch (error) {
    console.error('Target add error:', error)
    return NextResponse.json(
      { error: 'Failed to add target phrase' },
      { status: 500 }
    )
  }
}
