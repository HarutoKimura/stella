'use client'

import { useState } from 'react'
import type { CoachTurn } from '@/types/coach'

type CoachSessionProps = {
  focusAreas: string[]
  level: string
  weekId?: number
  insightText?: string
  theme?: string
}

export function CoachSession({ focusAreas, level, weekId, insightText, theme }: CoachSessionProps) {
  const [dialogue, setDialogue] = useState<CoachTurn[]>([])
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentTurn, setCurrentTurn] = useState(0)

  const startSession = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusAreas,
          level,
          theme: theme || 'General conversation',
          insightText,
          weekId: weekId || getCurrentWeekId(),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setDialogue(data.dialogue || [])
        setSessionId(data.sessionId)
        setCurrentTurn(0)
      } else {
        console.error('Failed to start session:', await res.text())
      }
    } catch (error) {
      console.error('Error starting session:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetSession = () => {
    setDialogue([])
    setSessionId(null)
    setCurrentTurn(0)
  }

  const nextTurn = () => {
    if (currentTurn < dialogue.length - 1) {
      setCurrentTurn(currentTurn + 1)
    }
  }

  const previousTurn = () => {
    if (currentTurn > 0) {
      setCurrentTurn(currentTurn - 1)
    }
  }

  const getFocusAreaEmoji = (area: string) => {
    switch (area.toLowerCase()) {
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

  const getFocusAreaColor = (area: string) => {
    switch (area.toLowerCase()) {
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

  return (
    <div className="mt-6 bg-gradient-to-r from-indigo-800/10 to-cyan-800/10 rounded-xl p-6 border border-indigo-700/20">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-indigo-300 flex items-center gap-2 text-lg">
          <span className="text-2xl">🎯</span> AI Practice Session
        </h4>
        {dialogue.length === 0 && (
          <button
            onClick={startSession}
            disabled={loading || focusAreas.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-700/30 hover:bg-indigo-700/50 text-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-200"></div>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Practice
              </>
            )}
          </button>
        )}
        {dialogue.length > 0 && (
          <button
            onClick={resetSession}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 text-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
        )}
      </div>

      {/* Focus Areas Display */}
      <div className="flex flex-wrap gap-2 mb-4">
        {focusAreas.map((area, idx) => (
          <span
            key={idx}
            className={`text-xs font-semibold px-3 py-1 rounded-full ${getFocusAreaColor(area)} flex items-center gap-1`}
          >
            <span>{getFocusAreaEmoji(area)}</span>
            {area}
          </span>
        ))}
      </div>

      {dialogue.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🎙️</div>
          <p className="text-gray-400 text-sm mb-3">
            Ready to practice? Start an AI-powered coaching session tailored to your focus areas!
          </p>
          <button
            onClick={startSession}
            disabled={loading || focusAreas.length === 0}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating your practice session...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start AI Practice
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Turn {currentTurn + 1} of {dialogue.length}</span>
            <div className="flex gap-1">
              {dialogue.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    idx === currentTurn
                      ? 'bg-indigo-500'
                      : idx < currentTurn
                      ? 'bg-indigo-700'
                      : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Current turn display */}
          {dialogue[currentTurn] && (
            <div className="space-y-3">
              {/* Coach's message */}
              <div className="bg-indigo-900/30 rounded-lg p-4 border border-indigo-700/30">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600/50 flex items-center justify-center text-sm">
                    🎓
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-indigo-300 mb-1">Coach</p>
                    <p className="text-gray-200 leading-relaxed">
                      {dialogue[currentTurn].coach_text}
                    </p>
                  </div>
                </div>
              </div>

              {/* Expected student response */}
              <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-700/20">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-600/50 flex items-center justify-center text-sm">
                    💭
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-cyan-300 mb-1">Example Response</p>
                    <p className="text-gray-300 leading-relaxed italic">
                      {dialogue[currentTurn].expected_student_text}
                    </p>
                  </div>
                </div>
              </div>

              {/* Correction tip */}
              <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-700/20">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 text-xl">💡</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-300 mb-1">Tip</p>
                    <p className="text-gray-300 leading-relaxed text-sm">
                      {dialogue[currentTurn].correction_tip}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={previousTurn}
              disabled={currentTurn === 0}
              className="px-4 py-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 text-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <button
              onClick={nextTurn}
              disabled={currentTurn === dialogue.length - 1}
              className="px-4 py-2 rounded-lg bg-indigo-700/50 hover:bg-indigo-700/70 text-indigo-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {currentTurn === dialogue.length - 1 && (
            <div className="mt-4 pt-4 border-t border-indigo-700/20">
              <p className="text-xs text-gray-400 text-center">
                Great job! You've completed this practice session. Start a new session to continue improving!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper function to get current week ID (week number of the year)
function getCurrentWeekId(): number {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const weekId = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return weekId
}
