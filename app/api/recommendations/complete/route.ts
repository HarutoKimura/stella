import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * POST /api/recommendations/complete
 *
 * Marks a recommended action as completed
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Complete Recommendation API] Request received')

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

    // Parse request body
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    console.log('[Complete Recommendation API] Marking action as complete:', id)

    // Verify the action belongs to the user and mark as complete
    const { data: updatedAction, error: updateError } = await supabase
      .from('recommended_actions')
      .update({ completed: true })
      .eq('id', id)
      .eq('user_id', userProfile.id) // Security: ensure user owns this action
      .select()
      .single()

    if (updateError) {
      console.error('[Complete Recommendation API] Error updating action:', updateError)
      return NextResponse.json(
        { error: 'Failed to complete action' },
        { status: 500 }
      )
    }

    if (!updatedAction) {
      return NextResponse.json(
        { error: 'Action not found or does not belong to user' },
        { status: 404 }
      )
    }

    console.log('[Complete Recommendation API] Action completed successfully')

    return NextResponse.json({
      success: true,
      action: updatedAction,
    })

  } catch (error) {
    console.error('[Complete Recommendation API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to complete recommendation',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
