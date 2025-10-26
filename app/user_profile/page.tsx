'use client'

import { OrbBG } from '@/components/OrbBG'
import { ProfileCards } from '@/components/ProfileCards'
import { SessionHistory } from '@/components/SessionHistory'
import { LearningInsights } from '@/components/LearningInsights'
import { PhraseLibrary } from '@/components/PhraseLibrary'
import { createClient } from '@/lib/supabaseClient'
import { DbTarget, DbFluencySnapshot } from '@/lib/schema'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type TabType = 'overview' | 'history' | 'insights' | 'phrases'

export default function UserProfilePage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [displayName, setDisplayName] = useState('')
  const [cefr, setCefr] = useState('B1')
  const [masteredCount, setMasteredCount] = useState(0)
  const [weeklyMasteredCount, setWeeklyMasteredCount] = useState(0)
  const [fluencyData, setFluencyData] = useState<DbFluencySnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) {
        router.push('/login')
        return
      }

      setDisplayName(profile.display_name || '')
      setCefr(profile.cefr_level)

      // Get mastered targets count
      const { data: targets } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'mastered')

      setMasteredCount(targets?.length || 0)

      // Get weekly mastered count
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const { data: weeklyTargets } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'mastered')
        .gte('last_seen_at', oneWeekAgo.toISOString())

      setWeeklyMasteredCount(weeklyTargets?.length || 0)

      // Get fluency snapshots
      const { data: snapshots } = await supabase
        .from('fluency_snapshots')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(10)

      setFluencyData(snapshots || [])
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) return

      await supabase
        .from('users')
        .update({
          display_name: displayName,
          cefr_level: cefr,
        })
        .eq('auth_user_id', authUser.id)

      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert('Failed to update profile')
    }
  }

  if (loading) {
    return (
      <OrbBG>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </OrbBG>
    )
  }

  return (
    <OrbBG>
      <div className="min-h-screen p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">My Profile</h1>
            <a
              href="/home"
              className="text-white hover:text-blue-300 transition-colors"
            >
              ← Back to Home
            </a>
          </div>

          {/* Profile settings */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-blue-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  CEFR Level
                </label>
                <select
                  value={cefr}
                  onChange={(e) => setCefr(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-blue-500/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="A1">A1 - Beginner</option>
                  <option value="A2">A2 - Elementary</option>
                  <option value="B1">B1 - Intermediate</option>
                  <option value="B2">B2 - Upper Intermediate</option>
                  <option value="C1">C1 - Advanced</option>
                  <option value="C2">C2 - Proficient</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleUpdateProfile}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-green-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              📜 History
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === 'insights'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              💡 Insights
            </button>
            <button
              onClick={() => setActiveTab('phrases')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === 'phrases'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              📚 Phrases
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <ProfileCards
              masteredCount={masteredCount}
              weeklyMasteredCount={weeklyMasteredCount}
              fluencyData={fluencyData}
            />
          )}

          {activeTab === 'history' && <SessionHistory />}

          {activeTab === 'insights' && <LearningInsights />}

          {activeTab === 'phrases' && <PhraseLibrary />}
        </div>
      </div>
    </OrbBG>
  )
}
