'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'

interface AccentTestResultProps {
  results: {
    test_id: string
    egi_score: number
    cefr_level: string
    scores: {
      pronunciation: number
      fluency: number
      grammar: number
      vocabulary: number
      confidence: number
    }
    recognized_text: string
    feedback: {
      strengths: string[]
      improvements: string[]
      next_steps: string
    }
    semantic_feedback?: Array<{
      category: string
      original: string
      corrected: string
      tip: string
      explanation: string
      severity: string
    }>
  }
  onRetake: () => void
}

export function AccentTestResult({ results, onRetake }: AccentTestResultProps) {
  const router = useRouter()
  const [isAnimated, setIsAnimated] = useState(false)

  // Trigger animation on mount
  useState(() => {
    setTimeout(() => setIsAnimated(true), 100)
  })

  // Prepare data for radar chart
  const radarData = [
    { subject: 'Pronunciation', score: results.scores.pronunciation, fullMark: 100 },
    { subject: 'Fluency', score: results.scores.fluency, fullMark: 100 },
    { subject: 'Grammar', score: results.scores.grammar, fullMark: 100 },
    { subject: 'Vocabulary', score: results.scores.vocabulary, fullMark: 100 },
    { subject: 'Confidence', score: results.scores.confidence, fullMark: 100 },
  ]

  // Prepare data for bar chart
  const barData = [
    { name: 'Pronunciation', score: results.scores.pronunciation },
    { name: 'Fluency', score: results.scores.fluency },
    { name: 'Grammar', score: results.scores.grammar },
    { name: 'Vocabulary', score: results.scores.vocabulary },
    { name: 'Confidence', score: results.scores.confidence },
  ]

  // Color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981' // green
    if (score >= 60) return '#f59e0b' // amber
    return '#ef4444' // red
  }

  const getCefrColor = (level: string) => {
    const colors: Record<string, string> = {
      A1: '#ef4444',
      A2: '#f59e0b',
      B1: '#eab308',
      B2: '#84cc16',
      C1: '#22c55e',
      C2: '#10b981',
    }
    return colors[level] || '#6b7280'
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          Your Accent Test Results
        </h1>
        <p className="text-gray-400">
          AI-powered analysis of your English proficiency
        </p>
      </div>

      {/* Main Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* EGI Score Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="text-center">
            <h2 className="text-xl text-gray-300 mb-4">Overall EGI Score</h2>
            <div
              className={`text-7xl font-bold mb-4 transition-all duration-1000 ${
                isAnimated ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
              style={{ color: getScoreColor(results.egi_score) }}
            >
              {results.egi_score}
            </div>
            <div className="text-sm text-gray-400 mb-6">out of 100</div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: isAnimated ? `${results.egi_score}%` : '0%',
                  backgroundColor: getScoreColor(results.egi_score),
                }}
              />
            </div>
          </div>
        </div>

        {/* CEFR Level Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="text-center">
            <h2 className="text-xl text-gray-300 mb-4">Estimated CEFR Level</h2>
            <div
              className={`text-7xl font-bold mb-4 transition-all duration-1000 delay-300 ${
                isAnimated ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
              style={{ color: getCefrColor(results.cefr_level) }}
            >
              {results.cefr_level}
            </div>
            <div className="text-sm text-gray-400 mb-4">
              {results.cefr_level === 'C2' && 'Mastery or proficiency'}
              {results.cefr_level === 'C1' && 'Advanced or proficient'}
              {results.cefr_level === 'B2' && 'Upper intermediate'}
              {results.cefr_level === 'B1' && 'Intermediate'}
              {results.cefr_level === 'A2' && 'Elementary'}
              {results.cefr_level === 'A1' && 'Beginner'}
            </div>

            {/* CEFR Scale */}
            <div className="flex justify-between text-xs text-gray-400 mt-6">
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => (
                <div
                  key={level}
                  className={`${
                    level === results.cefr_level ? 'font-bold text-white' : ''
                  }`}
                >
                  {level}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Scores Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radar Chart */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 text-center">
            Skills Overview
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#ffffff20" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#fff', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#fff' }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 text-center">
            Detailed Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#fff' }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#fff', fontSize: 11 }} width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recognized Text */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6">
        <h3 className="text-xl font-bold text-white mb-3">What You Said</h3>
        <p className="text-gray-300 italic">"{results.recognized_text}"</p>
      </div>

      {/* AI Feedback */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6">
        <h3 className="text-xl font-bold text-white mb-4">AI Feedback</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          {/* Strengths */}
          <div>
            <h4 className="text-green-400 font-bold mb-2 flex items-center">
              <span className="mr-2">✓</span> Strengths
            </h4>
            <ul className="space-y-2">
              {results.feedback.strengths.map((strength, idx) => (
                <li key={idx} className="text-gray-300 text-sm">
                  • {strength}
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for Improvement */}
          <div>
            <h4 className="text-amber-400 font-bold mb-2 flex items-center">
              <span className="mr-2">→</span> Areas to Improve
            </h4>
            <ul className="space-y-2">
              {results.feedback.improvements.map((improvement, idx) => (
                <li key={idx} className="text-gray-300 text-sm">
                  • {improvement}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
          <h4 className="text-blue-300 font-bold mb-2">💡 Next Steps</h4>
          <p className="text-gray-300 text-sm">{results.feedback.next_steps}</p>
        </div>
      </div>

      {/* Semantic Feedback - Actionable Tips (Stage 2: What makes you better than Elsa!) */}
      {results.semantic_feedback && results.semantic_feedback.length > 0 && (
        <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-md rounded-2xl p-6 border border-purple-400/30 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🎯</span>
            <h3 className="text-xl font-bold text-white">
              Specific Tips to Sound More Natural
            </h3>
          </div>
          <p className="text-gray-300 text-sm mb-6">
            These are actual mistakes from your speech with concrete fixes. Practice these!
          </p>

          <div className="space-y-4">
            {results.semantic_feedback.map((tip, idx) => {
              const severityColor = {
                high: 'border-red-400/50 bg-red-500/10',
                medium: 'border-amber-400/50 bg-amber-500/10',
                low: 'border-blue-400/50 bg-blue-500/10',
              }[tip.severity] || 'border-gray-400/50 bg-gray-500/10'

              const categoryIcon = {
                grammar: '📝',
                vocabulary: '📚',
                pronunciation: '🗣️',
                fluency: '⚡',
                idiom: '💬',
                structure: '🏗️',
              }[tip.category] || '💡'

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${severityColor} transition-all hover:scale-[1.02]`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{categoryIcon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-purple-300 uppercase">
                          {tip.category}
                        </span>
                        <span className="text-xs text-gray-400">
                          {tip.severity} priority
                        </span>
                      </div>

                      {/* Original vs Corrected */}
                      <div className="mb-3">
                        <div className="mb-2">
                          <span className="text-red-400 text-sm font-semibold">❌ You said:</span>
                          <p className="text-gray-300 italic ml-5 mt-1">"{tip.original}"</p>
                        </div>
                        <div>
                          <span className="text-green-400 text-sm font-semibold">✅ Try this:</span>
                          <p className="text-white font-medium ml-5 mt-1">"{tip.corrected}"</p>
                        </div>
                      </div>

                      {/* Actionable Tip */}
                      <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-lg mb-2">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-300">💡</span>
                          <div>
                            <p className="text-blue-200 font-semibold text-sm">Tip:</p>
                            <p className="text-gray-200 text-sm">{tip.tip}</p>
                          </div>
                        </div>
                      </div>

                      {/* Explanation */}
                      {tip.explanation && (
                        <p className="text-gray-400 text-xs italic">{tip.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Progress Continuity: Practice Now CTA */}
      {results.semantic_feedback && results.semantic_feedback.length > 0 && (
        <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-md rounded-2xl p-8 border border-green-400/30 mb-6 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h3 className="text-2xl font-bold text-white mb-3">
            Ready to Apply What You Learned?
          </h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            The best way to master these corrections is to practice them immediately.
            Start a conversation with our AI tutor and get real-time feedback as you speak.
          </p>
          <button
            onClick={() => router.push(`/free_conversation?from_test=${results.test_id}`)}
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-10 rounded-full transition-all transform hover:scale-105 shadow-lg"
          >
            Practice These Corrections Now →
          </button>
          <p className="text-gray-400 text-sm mt-4">
            Your corrections will be loaded automatically
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <button
          onClick={() => router.push('/free_conversation')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full transition-colors"
        >
          Start General Lesson
        </button>
        <button
          onClick={onRetake}
          className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-full border border-white/20 transition-colors"
        >
          Retake Test
        </button>
        <button
          onClick={() => router.push('/user_profile')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          View Profile →
        </button>
      </div>
    </div>
  )
}
