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

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <button
          onClick={() => router.push('/free_conversation')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full transition-colors"
        >
          Start Personalized Lesson
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
