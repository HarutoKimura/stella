'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

type Phrase = {
  id: string
  phrase: string
  cefr: string
  status: string
  first_seen_at: string
  last_seen_at: string
}

export function PhraseLibrary() {
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [filter, setFilter] = useState<'all' | 'mastered' | 'attempted'>('all')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPhrases()
  }, [])

  const loadPhrases = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) return

      const { data } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', profile.id)
        .order('last_seen_at', { ascending: false })

      setPhrases(data || [])
    } catch (error) {
      console.error('Failed to load phrases:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPhrases = phrases.filter((phrase) => {
    if (filter === 'all') return true
    return phrase.status === filter
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'mastered':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'attempted':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  if (loading) {
    return <div className="text-white text-center py-8">Loading phrases...</div>
  }

  if (phrases.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Phrases Yet</h3>
        <p className="text-gray-400">Start practicing to build your phrase library</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Phrase Library</h2>
        <div className="text-gray-400 text-sm">
          {filteredPhrases.length} phrases
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('mastered')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            filter === 'mastered'
              ? 'bg-green-600 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          Mastered
        </button>
        <button
          onClick={() => setFilter('attempted')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            filter === 'attempted'
              ? 'bg-yellow-600 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          Learning
        </button>
      </div>

      {/* Phrase Grid */}
      <div className="grid grid-cols-1 gap-3">
        {filteredPhrases.map((phrase) => (
          <div
            key={phrase.id}
            className={`bg-white/10 backdrop-blur-md rounded-lg p-4 border ${getStatusColor(
              phrase.status
            )}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-lg font-semibold text-white mb-1">
                  "{phrase.phrase}"
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="px-2 py-1 bg-white/10 rounded">
                    {phrase.cefr}
                  </span>
                  <span>Last practiced: {formatDate(phrase.last_seen_at)}</span>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(
                  phrase.status
                )}`}
              >
                {phrase.status === 'mastered' ? '✓ Mastered' : '⏳ Learning'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPhrases.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No {filter} phrases yet
        </div>
      )}
    </div>
  )
}
