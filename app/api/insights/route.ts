import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * Get personalized learning insights for the authenticated user
 *
 * Returns:
 * - Learning streak (consecutive days with sessions)
 * - Total sessions count
 * - Top 5 most common errors
 * - Recommended phrases based on error patterns
 * - Progress summary (attempted vs mastered)
 * - Recent activity (last 7 days)
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
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, cefr_level')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const userId = userProfile.id

    // 1. Get all sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    const totalSessions = sessions?.length || 0

    // 2. Calculate learning streak (consecutive days)
    let streak = 0
    if (sessions && sessions.length > 0) {
      const sessionDates = sessions.map((s) => {
        const date = new Date(s.started_at)
        return date.toISOString().split('T')[0] // YYYY-MM-DD
      })

      const uniqueDates = [...new Set(sessionDates)].sort().reverse()

      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      // Streak starts if there's a session today or yesterday
      if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
        streak = 1
        let currentDate = new Date(uniqueDates[0])

        for (let i = 1; i < uniqueDates.length; i++) {
          const prevDate = new Date(currentDate)
          prevDate.setDate(prevDate.getDate() - 1)
          const prevDateStr = prevDate.toISOString().split('T')[0]

          if (uniqueDates[i] === prevDateStr) {
            streak++
            currentDate = new Date(uniqueDates[i])
          } else {
            break
          }
        }
      }
    }

    // 3. Get top 5 most common errors
    const { data: errors } = await supabase
      .from('errors')
      .select('*')
      .eq('user_id', userId)
      .order('count', { ascending: false })
      .limit(5)

    const topErrors = errors?.map((e) => ({
      type: e.type,
      example: e.example,
      correction: e.correction,
      count: e.count,
    })) || []

    // 4. Get phrase progress
    const { data: targets } = await supabase
      .from('targets')
      .select('status')
      .eq('user_id', userId)

    const phrasesPlanned = targets?.filter((t) => t.status === 'planned').length || 0
    const phrasesAttempted = targets?.filter((t) => t.status === 'attempted').length || 0
    const phrasesMastered = targets?.filter((t) => t.status === 'mastered').length || 0

    // 5. Recent activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', sevenDaysAgo.toISOString())

    const recentSessionCount = recentSessions?.length || 0

    // Calculate total speaking time in last 7 days (in minutes)
    const totalSpeakingMs = recentSessions?.reduce((sum, s) => sum + (s.speaking_ms || 0), 0) || 0
    const totalSpeakingMinutes = Math.round(totalSpeakingMs / 60000)

    // 6. Generate personalized recommendations based on errors
    const recommendations: string[] = []

    if (topErrors.length > 0) {
      const grammarErrors = topErrors.filter((e) => e.type === 'grammar').length
      const vocabErrors = topErrors.filter((e) => e.type === 'vocab').length
      const pronErrors = topErrors.filter((e) => e.type === 'pron').length

      if (grammarErrors >= 2) {
        recommendations.push('Focus on grammar practice - you have recurring grammar patterns')
      }
      if (vocabErrors >= 2) {
        recommendations.push('Expand your vocabulary - consider learning synonyms for common words')
      }
      if (pronErrors >= 2) {
        recommendations.push('Practice pronunciation - try shadowing native speakers')
      }
    }

    if (streak === 0 && totalSessions > 0) {
      recommendations.push('Start a new streak! Practice today to build consistency')
    }

    if (streak >= 7) {
      recommendations.push(`Amazing! You're on a ${streak}-day streak. Keep it going!`)
    }

    if (phrasesPlanned > phrasesAttempted + phrasesMastered) {
      recommendations.push(`You have ${phrasesPlanned} phrases waiting - try using them in conversation!`)
    }

    if (recentSessionCount === 0) {
      recommendations.push("You haven't practiced this week - let's get back on track!")
    }

    if (recommendations.length === 0) {
      recommendations.push('Great work! Keep practicing regularly to maintain your progress.')
    }

    // 7. Get average WPM trend
    const { data: fluencySnapshots } = await supabase
      .from('fluency_snapshots')
      .select('wpm')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    const recentWPM = fluencySnapshots?.map((s) => s.wpm).filter((w) => w !== null) || []
    const avgWPM = recentWPM.length > 0
      ? Math.round(recentWPM.reduce((sum, w) => sum + (w || 0), 0) / recentWPM.length)
      : null

    return NextResponse.json({
      userId,
      cefrLevel: userProfile.cefr_level,
      streak,
      totalSessions,
      recentActivity: {
        last7Days: recentSessionCount,
        totalSpeakingMinutes,
      },
      phraseProgress: {
        planned: phrasesPlanned,
        attempted: phrasesAttempted,
        mastered: phrasesMastered,
        total: targets?.length || 0,
      },
      topErrors,
      recommendations,
      fluency: {
        averageWPM: avgWPM,
        recentSessions: recentWPM.length,
      },
    })
  } catch (error) {
    console.error('Insights API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
