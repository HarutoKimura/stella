import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * GET /api/user-errors
 * Fetch user's historical errors from the database
 */
export async function GET(req: NextRequest) {
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
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get limit from query params (default: 10)
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)

    // Fetch user's errors, ordered by count (most frequent first) and recency
    const { data: errors, error: errorsError } = await supabase
      .from('errors')
      .select('*')
      .eq('user_id', profile.id)
      .order('count', { ascending: false })
      .order('last_seen_at', { ascending: false })
      .limit(limit)

    if (errorsError) {
      console.error('[User Errors API] Database error:', errorsError)
      return NextResponse.json({ error: 'Failed to fetch errors' }, { status: 500 })
    }

    console.log('[User Errors API] Fetched', errors?.length || 0, 'errors for user:', profile.id)

    return NextResponse.json({
      errors: errors || [],
      count: errors?.length || 0,
    })
  } catch (error) {
    console.error('[User Errors API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
