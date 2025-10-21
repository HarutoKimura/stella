// Debug script to check database contents
// Run this in the browser console while logged into the app

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkMyData() {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.log('Not logged in!')
    return
  }

  console.log('=== AUTHENTICATED USER ===')
  console.log('Email:', user.email)
  console.log('ID:', user.id)

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  console.log('\n=== USER PROFILE ===')
  console.log(profile)

  if (!profile) return

  // Get all targets
  const { data: targets } = await supabase
    .from('targets')
    .select('*')
    .eq('user_id', profile.id)
    .order('first_seen_at', { ascending: false })

  console.log('\n=== TARGETS (', targets?.length, ') ===')
  targets?.forEach((t, i) => {
    console.log(`${i + 1}. [${t.status}] "${t.phrase}" (${t.cefr})`)
    console.log(`   Created: ${new Date(t.first_seen_at).toLocaleString()}`)
  })

  // Get all sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', profile.id)
    .order('started_at', { ascending: false })

  console.log('\n=== SESSIONS (', sessions?.length, ') ===')
  sessions?.forEach((s, i) => {
    console.log(`${i + 1}. Session ${s.id.slice(0, 8)}...`)
    console.log(`   Started: ${new Date(s.started_at).toLocaleString()}`)
    console.log(`   Ended: ${s.ended_at ? new Date(s.ended_at).toLocaleString() : 'Still active'}`)
    console.log(`   Turns: Student ${s.student_turns} / Tutor ${s.tutor_turns}`)
    console.log(`   Summary:`, s.summary)
  })

  // Get all errors
  const { data: errors } = await supabase
    .from('errors')
    .select('*')
    .eq('user_id', profile.id)
    .order('last_seen_at', { ascending: false })

  console.log('\n=== ERRORS (', errors?.length, ') ===')
  errors?.forEach((e, i) => {
    console.log(`${i + 1}. [${e.type}] Count: ${e.count}`)
    console.log(`   Example: "${e.example}"`)
    console.log(`   Correction: "${e.correction}"`)
  })

  // Get fluency snapshots
  const { data: fluency } = await supabase
    .from('fluency_snapshots')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  console.log('\n=== FLUENCY METRICS (', fluency?.length, ') ===')
  fluency?.forEach((f, i) => {
    console.log(`${i + 1}. ${new Date(f.created_at).toLocaleString()}`)
    console.log(`   WPM: ${f.wpm}, Filler Rate: ${f.filler_rate}, Avg Pause: ${f.avg_pause_ms}ms`)
  })

  console.log('\n=== SUMMARY ===')
  console.log('Total targets:', targets?.length || 0)
  console.log('Total sessions:', sessions?.length || 0)
  console.log('Total errors recorded:', errors?.length || 0)
  console.log('Total fluency snapshots:', fluency?.length || 0)
}

// Run it
checkMyData()
