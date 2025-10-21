'use client'

import { DbTarget, DbFluencySnapshot } from '@/lib/schema'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type ProfileCardsProps = {
  masteredCount: number
  weeklyMasteredCount: number
  fluencyData: DbFluencySnapshot[]
}

/**
 * ProfileCards - Dashboard cards for user profile page
 */
export function ProfileCards({
  masteredCount,
  weeklyMasteredCount,
  fluencyData,
}: ProfileCardsProps) {
  // Prepare chart data
  const chartData = fluencyData.map((snapshot) => ({
    date: new Date(snapshot.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    wpm: snapshot.wpm || 0,
  }))

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-blue-500/30">
          <h3 className="text-gray-300 text-sm uppercase tracking-wide mb-2">
            Total Phrases Mastered
          </h3>
          <p className="text-5xl font-bold text-white">{masteredCount}</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-blue-500/30">
          <h3 className="text-gray-300 text-sm uppercase tracking-wide mb-2">
            Mastered This Week
          </h3>
          <p className="text-5xl font-bold text-white">{weeklyMasteredCount}</p>
        </div>
      </div>

      {/* Fluency trend chart */}
      {chartData.length > 0 && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
          <h3 className="text-white text-lg font-bold mb-4">
            Fluency Trend (Words Per Minute)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #444',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="wpm"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
