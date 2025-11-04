'use client'

import { useEffect, useState } from 'react'

type RecommendedAction = {
  id: string
  user_id: string
  week_start: string
  category: string
  action_text: string
  completed: boolean
  created_at: string
}

type NextStepsProps = {
  insightText?: string
  weekStart?: string
}

export function NextSteps({ insightText, weekStart }: NextStepsProps) {
  const [actions, setActions] = useState<RecommendedAction[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchActions()
  }, [])

  const fetchActions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/recommendations')
      if (res.ok) {
        const data = await res.json()
        setActions(data.actions || [])
      } else {
        console.error('Failed to fetch recommendations:', await res.text())
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateActions = async () => {
    if (!insightText || !weekStart) {
      console.error('Missing insight_text or week_start')
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight_text: insightText, week_start: weekStart }),
      })

      if (res.ok) {
        const data = await res.json()
        setActions(data.actions || [])
      } else {
        console.error('Failed to generate recommendations:', await res.text())
      }
    } catch (error) {
      console.error('Error generating recommendations:', error)
    } finally {
      setGenerating(false)
    }
  }

  const markComplete = async (id: string) => {
    try {
      const res = await fetch('/api/recommendations/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        // Remove from UI with animation
        setActions(actions.filter((a) => a.id !== id))
      } else {
        console.error('Failed to mark complete:', await res.text())
      }
    } catch (error) {
      console.error('Error marking complete:', error)
    }
  }

  const getCategoryEmoji = (category: string) => {
    switch (category.toLowerCase()) {
      case 'grammar':
        return '📝'
      case 'pronunciation':
        return '🗣️'
      case 'vocabulary':
        return '📚'
      case 'fluency':
        return '💬'
      default:
        return '🎯'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'grammar':
        return 'text-blue-400 bg-blue-500/20'
      case 'pronunciation':
        return 'text-green-400 bg-green-500/20'
      case 'vocabulary':
        return 'text-yellow-400 bg-yellow-500/20'
      case 'fluency':
        return 'text-purple-400 bg-purple-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  if (loading) {
    return (
      <div className="mt-6 bg-gradient-to-r from-purple-800/10 to-indigo-800/10 rounded-xl p-6 border border-purple-700/20">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400"></div>
          <p className="text-gray-400 text-sm">Loading next steps...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 bg-gradient-to-r from-purple-800/10 to-indigo-800/10 rounded-xl p-6 border border-purple-700/20">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-purple-300 flex items-center gap-2 text-lg">
          <span className="text-2xl">🎯</span> Next Steps
        </h4>
        {actions.length === 0 && insightText && weekStart && (
          <button
            onClick={generateActions}
            disabled={generating}
            className="text-xs px-3 py-1.5 rounded-lg bg-purple-700/30 hover:bg-purple-700/50 text-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-200"></div>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Actions
              </>
            )}
          </button>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-4xl mb-3">💪</div>
          <p className="text-gray-400 text-sm mb-3">
            No next actions yet — generate personalized steps from this week's insight!
          </p>
          {insightText && weekStart && (
            <button
              onClick={generateActions}
              disabled={generating}
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating your next steps...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate From Insight
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex items-start justify-between gap-3 bg-white/5 rounded-lg p-4 border border-purple-700/10 hover:bg-white/10 transition-all duration-200"
            >
              <div className="flex items-start gap-3 flex-1">
                <span className="text-xl mt-0.5">{getCategoryEmoji(action.category)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getCategoryColor(action.category)}`}>
                      {action.category}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {action.action_text}
                  </p>
                </div>
              </div>
              <button
                onClick={() => markComplete(action.id)}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-purple-700/30 hover:bg-green-700/50 text-purple-200 hover:text-green-200 transition-all group"
                title="Mark as complete"
              >
                <span className="group-hover:hidden">Done</span>
                <span className="hidden group-hover:inline">✓</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {actions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-purple-700/20">
          <p className="text-xs text-gray-400 text-center">
            Complete these actions to improve your skills this week
          </p>
        </div>
      )}
    </div>
  )
}
