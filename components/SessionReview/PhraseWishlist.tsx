import { useState } from 'react'
import SpotlightCard from '../SpotlightCard'
import { createClient } from '@/lib/supabaseClient'

type Props = {
  sessionId: string
  usedTargets: string[]
  missedTargets: string[]
}

export function PhraseWishlist({ sessionId, usedTargets, missedTargets }: Props) {
  const supabase = createClient()
  const [newPhrase, setNewPhrase] = useState('')
  const [savedPhrases, setSavedPhrases] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const handleAddPhrase = async () => {
    if (!newPhrase.trim()) return

    try {
      setSaving(true)

      // Get current user
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        alert('Please log in to save phrases')
        return
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) {
        alert('User profile not found')
        return
      }

      // Add to targets table as "planned" for future sessions
      await supabase.from('targets').insert({
        user_id: profile.id,
        phrase: newPhrase.trim(),
        status: 'planned',
      })

      setSavedPhrases([...savedPhrases, newPhrase.trim()])
      setNewPhrase('')
      setSaving(false)

      // Show success message
      alert('✅ Phrase added to your learning list!')
    } catch (error) {
      console.error('Failed to save phrase:', error)
      alert('Failed to save phrase. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Phrases for Future Practice</h2>

      {/* Missed Target Phrases */}
      {missedTargets.length > 0 && (
        <SpotlightCard className="!p-4" spotlightColor="rgba(250, 204, 21, 0.2)">
          <h3 className="text-yellow-300 font-bold text-sm mb-3 flex items-center gap-2">
            <span>⚠️</span>
            <span>Missed Target Phrases ({missedTargets.length})</span>
          </h3>
          <p className="text-gray-400 text-xs mb-3">
            These phrases were planned for this session but you didn't use them. Consider practicing them next time!
          </p>
          <div className="space-y-2">
            {missedTargets.map((phrase, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-yellow-500/10 border border-yellow-500/30 rounded"
              >
                <span className="text-white text-sm">"{phrase}"</span>
                <button
                  className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30 transition-colors"
                  onClick={() => {
                    alert('This phrase will automatically appear in your next session!')
                  }}
                >
                  ✓ Ready for next time
                </button>
              </div>
            ))}
          </div>
        </SpotlightCard>
      )}

      {/* Used Target Phrases */}
      {usedTargets.length > 0 && (
        <SpotlightCard className="!p-4" spotlightColor="rgba(34, 197, 94, 0.2)">
          <h3 className="text-green-300 font-bold text-sm mb-3 flex items-center gap-2">
            <span>✅</span>
            <span>Successfully Used Phrases ({usedTargets.length})</span>
          </h3>
          <p className="text-gray-400 text-xs mb-3">
            Great job! You used these target phrases during the session.
          </p>
          <div className="flex flex-wrap gap-2">
            {usedTargets.map((phrase, index) => (
              <span
                key={index}
                className="px-3 py-1.5 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full text-xs font-semibold"
              >
                "{phrase}"
              </span>
            ))}
          </div>
        </SpotlightCard>
      )}

      {/* "I Wish I Had Said..." Feature */}
      <SpotlightCard className="!p-6" spotlightColor="rgba(168, 85, 247, 0.2)">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">💭</span>
          <div className="flex-1">
            <h3 className="text-purple-300 font-bold text-lg mb-1">
              "I Wish I Had Said..."
            </h3>
            <p className="text-gray-400 text-sm">
              Add phrases you wanted to use but couldn't remember. They'll be included in your next practice session!
            </p>
          </div>
        </div>

        {/* Input form */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddPhrase()
              }
            }}
            placeholder='e.g., "Could you elaborate on that?"'
            className="flex-1 px-4 py-3 bg-gray-800 text-white border border-purple-500/30 rounded-lg focus:outline-none focus:border-purple-500/60 transition-colors placeholder-gray-500"
            disabled={saving}
          />
          <button
            onClick={handleAddPhrase}
            disabled={!newPhrase.trim() || saving}
            className="px-6 py-3 bg-purple-500/30 text-purple-300 border border-purple-500/50 rounded-lg font-semibold hover:bg-purple-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '...' : '+ Add'}
          </button>
        </div>

        {/* Saved phrases list */}
        {savedPhrases.length > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-500/30">
            <p className="text-gray-400 text-xs mb-2">
              ✅ Added to your learning list:
            </p>
            <div className="space-y-1">
              {savedPhrases.map((phrase, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm text-green-300"
                >
                  <span>✓</span>
                  <span>"{phrase}"</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-4 pt-4 border-t border-purple-500/30">
          <p className="text-gray-500 text-xs">
            💡 <span className="font-semibold">Pro tip:</span> During conversations, if you think
            "I wish I knew how to say...", write it down here immediately after the session!
          </p>
        </div>
      </SpotlightCard>
    </div>
  )
}
