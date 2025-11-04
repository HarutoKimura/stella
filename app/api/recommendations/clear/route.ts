import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * DELETE /api/recommendations/clear
 *
 * Clears all recommended actions for the current user
 * Useful for testing or starting fresh
 */
export async function DELETE() {
  try {
    console.log('[Clear Recommendations API] Request received')

    // Authenticate user
    const supabase = await createServerSupabaseClient()
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

    console.log('[Clear Recommendations API] Deleting all actions for user:', userProfile.id)

    // Delete all actions for this user
    const { error: deleteError, count } = await supabase
      .from('recommended_actions')
      .delete()
      .eq('user_id', userProfile.id)

    if (deleteError) {
      console.error('[Clear Recommendations API] Error deleting:', deleteError)
      return NextResponse.json(
        { error: 'Failed to clear recommendations' },
        { status: 500 }
      )
    }

    console.log('[Clear Recommendations API] Successfully deleted', count, 'actions')

    return NextResponse.json({
      success: true,
      deleted_count: count,
      message: 'All recommendations cleared successfully',
    })

  } catch (error) {
    console.error('[Clear Recommendations API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to clear recommendations',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
