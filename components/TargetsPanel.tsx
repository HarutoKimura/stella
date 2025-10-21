'use client'

import { useSessionStore } from '@/lib/sessionStore'

/**
 * TargetsPanel - Shows active target phrases and their usage status
 */
export function TargetsPanel() {
  const activeTargets = useSessionStore((state) => state.activeTargets)

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 h-full">
      <h2 className="text-xl font-bold text-white mb-4">Target Phrases</h2>

      <div className="space-y-3">
        {activeTargets.length === 0 ? (
          <p className="text-gray-400 text-sm">No active targets yet</p>
        ) : (
          activeTargets.map((target, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border-2 transition-all ${
                target.used
                  ? 'bg-green-500/20 border-green-500'
                  : 'bg-gray-800/50 border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-white font-medium">{target.phrase}</p>
                {target.used && (
                  <span className="text-green-400 text-sm">✓ Used</span>
                )}
              </div>
              {target.attempts > 0 && (
                <p className="text-gray-400 text-xs mt-1">
                  Attempts: {target.attempts}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-gray-300 text-sm">
          <span className="font-semibold">Goal:</span> Use all phrases naturally
          in conversation
        </p>
      </div>
    </div>
  )
}
