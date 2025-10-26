'use client'

import { useState, useEffect } from 'react'
import { BIG_GOALS, calculateGoalProgress, getNextStep, type BigGoal, type Milestone } from '@/lib/goalSystem'
import SpotlightCard from './SpotlightCard'
import { createClient } from '@/lib/supabaseClient'

export function GoalProgressDashboard() {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [customGoal, setCustomGoal] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadGoalProgress()
  }, [])

  const loadGoalProgress = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: profile } = await supabase
        .from('users')
        .select('id, goal_id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile || !profile.goal_id) {
        setLoading(false)
        return
      }

      setSelectedGoalId(profile.goal_id)

      // Check if it's a custom goal (starts with 'custom_')
      if (profile.goal_id.startsWith('custom_')) {
        const { data: customGoalData } = await supabase
          .from('custom_goals')
          .select('*')
          .eq('id', profile.goal_id)
          .single()

        if (customGoalData) {
          setCustomGoal(customGoalData)
        }
      }

      // Get mastered phrases
      const { data: targets } = await supabase
        .from('targets')
        .select('phrase, status')
        .eq('user_id', profile.id)
        .eq('status', 'mastered')

      const masteredPhrases = targets?.map((t) => t.phrase) || []

      // Get user stats
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', profile.id)

      const { data: fluencySnapshots } = await supabase
        .from('fluency_snapshots')
        .select('wpm')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)

      const avgWPM = fluencySnapshots && fluencySnapshots.length > 0
        ? Math.round(fluencySnapshots.reduce((sum, s) => sum + (s.wpm || 0), 0) / fluencySnapshots.length)
        : 0

      // Calculate grammar accuracy (simplified)
      const { data: errors } = await supabase
        .from('errors')
        .select('count')
        .eq('user_id', profile.id)

      const totalErrors = errors?.reduce((sum, e) => sum + e.count, 0) || 0
      const totalSessions = sessions?.length || 0
      const accuracy = totalSessions > 0 ? Math.max(0, 100 - (totalErrors / totalSessions) * 5) : 0

      const userStats = {
        wpm: avgWPM,
        accuracy: Math.round(accuracy),
        fluency: avgWPM > 0 ? Math.min(100, Math.round(avgWPM / 1.5)) : 0,
        sessionCount: totalSessions,
      }

      const goalProgress = calculateGoalProgress(profile.goal_id, masteredPhrases, userStats)
      setProgress(goalProgress)
    } catch (error) {
      console.error('Failed to load goal progress:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-white text-center py-8">Loading your goal...</div>
  }

  if (!selectedGoalId || !progress) {
    // No goal yet - just show a simple message
    return (
      <div className="max-w-md mx-auto text-center space-y-4">
        <div className="text-5xl mb-2">📊</div>
        <h3 className="text-2xl font-bold text-white">No Progress Yet</h3>
        <p className="text-gray-400 text-sm">
          Start a conversation with your tutor to begin tracking your progress
        </p>
      </div>
    )
  }

  // Use custom goal if available, otherwise template goal
  const bigGoal = customGoal || BIG_GOALS.find((g) => g.id === selectedGoalId)
  if (!bigGoal) return null

  const nextStep = getNextStep(selectedGoalId, progress)
  const currentMilestone = bigGoal.milestones[progress.currentMilestoneIndex]

  return (
    <div className="space-y-6">
      {/* Big Goal Header */}
      <SpotlightCard className="!p-6" spotlightColor="rgba(139, 92, 246, 0.3)">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{bigGoal.icon}</div>
            <div>
              <h2 className="text-2xl font-bold text-white">{bigGoal.title}</h2>
              <p className="text-gray-300">{bigGoal.description}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-purple-400">{progress.progressPercentage}%</div>
            <div className="text-sm text-gray-400">Complete</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
            style={{ width: `${progress.progressPercentage}%` }}
          >
            {progress.progressPercentage > 10 && (
              <span className="text-xs font-bold text-white">
                {progress.completedMilestones.length}/{bigGoal.milestones.length}
              </span>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-400">
          {progress.estimatedCompletionDate && (
            <>
              Estimated completion:{' '}
              {new Date(progress.estimatedCompletionDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </>
          )}
        </div>
      </SpotlightCard>

      {/* Next Step */}
      {nextStep && (
        <SpotlightCard className="!p-6" spotlightColor="rgba(34, 197, 94, 0.3)">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🎯</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2">Next Step</h3>
              <p className="text-green-300 text-lg mb-2">{nextStep.nextAction}</p>
              <p className="text-gray-400 text-sm">
                Current milestone: {nextStep.milestone.title} ({nextStep.progress})
              </p>
            </div>
          </div>
        </SpotlightCard>
      )}

      {/* Milestones */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Milestones</h3>
        {bigGoal.milestones.map((milestone, index) => {
          const isCompleted = progress.completedMilestones.includes(milestone.id)
          const isCurrent = index === progress.currentMilestoneIndex
          const isLocked = index > progress.currentMilestoneIndex

          return (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              isCompleted={isCompleted}
              isCurrent={isCurrent}
              isLocked={isLocked}
              progress={progress}
            />
          )
        })}
      </div>
    </div>
  )

}

function MilestoneCard({
  milestone,
  isCompleted,
  isCurrent,
  isLocked,
  progress,
}: {
  milestone: Milestone
  isCompleted: boolean
  isCurrent: boolean
  isLocked: boolean
  progress: any
}) {
  const phrasesLearned = milestone.requiredPhrases.filter((phrase) =>
    progress.phrasesLearned.includes(phrase)
  ).length

  const spotlightColor = isCompleted
    ? 'rgba(34, 197, 94, 0.3)'
    : isCurrent
    ? 'rgba(59, 130, 246, 0.3)'
    : 'rgba(107, 114, 128, 0.3)'

  return (
    <SpotlightCard className={`!p-4 ${isLocked ? 'opacity-50' : ''}`} spotlightColor={spotlightColor}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {isCompleted ? (
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-2xl">
              ✓
            </div>
          ) : isLocked ? (
            <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-2xl">
              🔒
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-xl font-bold text-white">
              {milestone.order}
            </div>
          )}
        </div>

        <div className="flex-1">
          <h4 className="text-lg font-bold text-white mb-1">{milestone.title}</h4>
          <p className="text-gray-300 text-sm mb-3">{milestone.description}</p>

          {!isLocked && (
            <>
              {/* Phrase Progress */}
              {milestone.requiredPhrases.length > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Phrases</span>
                    <span className={isCompleted ? 'text-green-400' : 'text-blue-400'}>
                      {phrasesLearned}/{milestone.requiredPhrases.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        isCompleted ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{
                        width: `${(phrasesLearned / milestone.requiredPhrases.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Skill Requirements */}
              {milestone.requiredSkills && milestone.requiredSkills.length > 0 && (
                <div className="space-y-2">
                  {milestone.requiredSkills.map((skill, idx) => {
                    const currentValue = progress.skillsAchieved[skill.type] || 0
                    const percentage = Math.min(100, (currentValue / skill.target) * 100)
                    const isMet = currentValue >= skill.target

                    return (
                      <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">{skill.description}</span>
                          <span className={isMet ? 'text-green-400' : 'text-blue-400'}>
                            {currentValue}/{skill.target}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${isMet ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Rewards */}
              {isCompleted && milestone.rewards.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {milestone.rewards.map((reward, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full"
                    >
                      🏆 {reward.description}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SpotlightCard>
  )
}
