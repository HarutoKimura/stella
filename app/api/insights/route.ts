import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * GET /api/insights
 *
 * Generates AI-powered weekly insights for the user's progress
 * Uses OpenAI to create personalized, motivational feedback
 */
export async function GET(req: NextRequest) {
  try {
    console.log('[Insights API] Request received')

    // Check if requesting historical insights
    const { searchParams } = new URL(req.url)
    const isHistoryRequest = searchParams.get('history') === 'true'

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
      .select('id, cefr_level, display_name')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    console.log('[Insights API] User profile:', userProfile.id)

    // If requesting history, return last 5 weeks of insights
    if (isHistoryRequest) {
      console.log('[Insights API] Fetching historical insights')

      const { data: historicalInsights, error: historyError } = await supabase
        .from('weekly_insights')
        .select('week_start, insight_text, created_at')
        .eq('user_id', userProfile.id)
        .order('week_start', { ascending: false })
        .limit(5)

      if (historyError) {
        console.error('[Insights API] Error fetching history:', historyError)
        return NextResponse.json({ error: 'Failed to fetch historical insights' }, { status: 500 })
      }

      return NextResponse.json({
        history: historicalInsights || [],
      })
    }

    // Check if we already have an insight for this week
    const currentWeekStart = getWeekStart(new Date())
    const { data: existingInsight } = await supabase
      .from('weekly_insights')
      .select('*')
      .eq('user_id', userProfile.id)
      .eq('week_start', currentWeekStart)
      .single()

    if (existingInsight) {
      console.log('[Insights API] Using cached insight for this week')
      return NextResponse.json({
        insight: existingInsight.insight_text,
        week_start: existingInsight.week_start,
        cached: true,
      })
    }

    // Fetch weekly error data using the database function
    const { data: weeklyErrors, error: errorsError } = await supabase
      .rpc('get_weekly_errors', { target_user_id: userProfile.id })

    if (errorsError) {
      console.error('[Insights API] Error fetching weekly errors:', errorsError)
      return NextResponse.json(
        { error: 'Failed to fetch progress data' },
        { status: 500 }
      )
    }

    if (!weeklyErrors || weeklyErrors.length === 0) {
      console.log('[Insights API] No progress data yet')
      return NextResponse.json({
        insight: "Welcome! Complete your first accent test to receive personalized AI insights about your progress.",
        week_start: currentWeekStart,
        cached: false,
      })
    }

    console.log('[Insights API] Weekly errors data:', weeklyErrors.length, 'weeks')

    // Calculate current week and previous week
    const currentWeek = weeklyErrors[0]
    const previousWeek = weeklyErrors[1] || currentWeek

    // Calculate deltas (improvement = positive number)
    const deltas = {
      grammar: Number(previousWeek.grammar_errors) - Number(currentWeek.grammar_errors),
      pronunciation: Number(previousWeek.pronunciation_errors) - Number(currentWeek.pronunciation_errors),
      vocabulary: Number(previousWeek.vocabulary_errors) - Number(currentWeek.vocabulary_errors),
      fluency: Number(previousWeek.fluency_errors) - Number(currentWeek.fluency_errors),
    }

    // Calculate scores
    const scores = {
      grammar: Math.max(0, 100 - Number(currentWeek.grammar_errors) * 5),
      pronunciation: Math.max(0, 100 - Number(currentWeek.pronunciation_errors) * 5),
      vocabulary: Math.max(0, 100 - Number(currentWeek.vocabulary_errors) * 5),
      fluency: Math.max(0, 100 - Number(currentWeek.fluency_errors) * 5),
    }

    // Find strongest and weakest skills
    const skillsArray = Object.entries(scores).map(([skill, score]) => ({ skill, score }))
    const strongest = skillsArray.reduce((max, curr) => curr.score > max.score ? curr : max)
    const weakest = skillsArray.reduce((min, curr) => curr.score < min.score ? curr : min)

    console.log('[Insights API] Generating AI insight with OpenAI...')

    // Generate insight with OpenAI
    const prompt = `You are an encouraging English learning coach. Generate a short, personalized weekly insight for ${userProfile.display_name || 'the student'}.

**Current Week Performance:**
- Grammar: ${currentWeek.grammar_errors} errors (score: ${scores.grammar}/100) ${deltas.grammar > 0 ? `↓ ${deltas.grammar} fewer` : deltas.grammar < 0 ? `↑ ${Math.abs(deltas.grammar)} more` : '→ same'}
- Pronunciation: ${currentWeek.pronunciation_errors} errors (score: ${scores.pronunciation}/100) ${deltas.pronunciation > 0 ? `↓ ${deltas.pronunciation} fewer` : deltas.pronunciation < 0 ? `↑ ${Math.abs(deltas.pronunciation)} more` : '→ same'}
- Vocabulary: ${currentWeek.vocabulary_errors} errors (score: ${scores.vocabulary}/100) ${deltas.vocabulary > 0 ? `↓ ${deltas.vocabulary} fewer` : deltas.vocabulary < 0 ? `↑ ${Math.abs(deltas.vocabulary)} more` : '→ same'}
- Fluency: ${currentWeek.fluency_errors} errors (score: ${scores.fluency}/100) ${deltas.fluency > 0 ? `↓ ${deltas.fluency} fewer` : deltas.fluency < 0 ? `↑ ${Math.abs(deltas.fluency)} more` : '→ same'}

**Student Level:** ${userProfile.cefr_level}
**Strongest Skill:** ${strongest.skill} (${strongest.score}/100)
**Area for Focus:** ${weakest.skill} (${weakest.score}/100)

**Instructions:**
Generate exactly 2-3 sentences:
1. One motivational line celebrating improvement or acknowledging effort
2. One specific, actionable focus tip for the weakest area
3. Optional: One encouraging note about their strongest skill

Keep it warm, personal, and actionable. Use the student's name if provided. Be concise but meaningful.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a warm, encouraging English learning coach who provides personalized, actionable feedback.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    })

    const insightText = completion.choices[0].message.content?.trim() ||
      "Great work this week! Keep practicing consistently, and you'll see continued improvement."

    console.log('[Insights API] AI insight generated:', insightText.substring(0, 100) + '...')

    // Store insight in database
    const { error: insertError } = await supabase
      .from('weekly_insights')
      .insert({
        user_id: userProfile.id,
        week_start: currentWeekStart,
        grammar_errors: Number(currentWeek.grammar_errors),
        pronunciation_errors: Number(currentWeek.pronunciation_errors),
        vocabulary_errors: Number(currentWeek.vocabulary_errors),
        fluency_errors: Number(currentWeek.fluency_errors),
        insight_text: insightText,
      })

    if (insertError) {
      console.error('[Insights API] Failed to store insight:', insertError)
      // Don't fail the request, just log the error
    } else {
      console.log('[Insights API] Insight stored successfully')
    }

    return NextResponse.json({
      insight: insightText,
      week_start: currentWeekStart,
      cached: false,
      scores,
      deltas,
    })

  } catch (error) {
    console.error('[Insights API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate insights',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// Helper function to get Monday of current week
function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}
