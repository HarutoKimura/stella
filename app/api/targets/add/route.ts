import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * Add a custom target phrase for the user
 *
 * This allows users to add their own phrases they want to practice.
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
      .select('id, cefr_level')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const { userId, phrase, cefr } = body

    // Validate userId matches authenticated user
    if (userId !== userProfile.id) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 })
    }

    if (!phrase || typeof phrase !== 'string' || phrase.trim().length === 0) {
      return NextResponse.json(
        { error: 'Phrase is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Check if phrase already exists for this user
    const { data: existing } = await supabase
      .from('targets')
      .select('id, status')
      .eq('user_id', userId)
      .eq('phrase', phrase.trim())
      .single()

    if (existing) {
      // If already exists, just return it
      return NextResponse.json({
        targetId: existing.id,
        phrase: phrase.trim(),
        status: existing.status,
        alreadyExists: true,
      })
    }

    // Insert new target
    const { data: target, error: insertError } = await supabase
      .from('targets')
      .insert({
        user_id: userId,
        phrase: phrase.trim(),
        cefr: cefr || userProfile.cefr_level || 'B1',
        status: 'planned',
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError || !target) {
      console.error('Target insertion error:', insertError)
      return NextResponse.json(
        { error: 'Failed to add target phrase' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      targetId: target.id,
      phrase: target.phrase,
      cefr: target.cefr,
      status: target.status,
      alreadyExists: false,
    })
  } catch (error) {
    console.error('Add target API error:', error)
    return NextResponse.json(
      { error: 'Failed to add target phrase' },
      { status: 500 }
    )
  }
}
