// Supabase Edge Function: Update User Progress
// This function updates the user_progress table from the progress_summary view
// Can be triggered manually, via cron job, or after each session

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Get Supabase client with service role key (has full access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Call the database function to update progress
    const { error: functionError } = await supabase.rpc('update_user_progress')

    if (functionError) {
      console.error('Error calling update_user_progress:', functionError)
      return new Response(
        JSON.stringify({ error: functionError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get updated stats
    const { data: stats, error: statsError } = await supabase
      .from('user_progress')
      .select('user_id, week_start')
      .order('created_at', { ascending: false })
      .limit(10)

    if (statsError) {
      console.error('Error fetching stats:', statsError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User progress updated successfully',
        updated_records: stats?.length || 0,
        sample: stats?.slice(0, 5) || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
