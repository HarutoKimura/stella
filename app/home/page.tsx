'use client'

import { OrbBG } from '@/components/OrbBG'
import { IntentCaption } from '@/components/IntentCaption'
import { useSessionStore } from '@/lib/sessionStore'
import { parseTextIntent, executeIntent } from '@/lib/intentRouter'
import { createClient } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useSessionStore((state) => state.setUser)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('id, display_name, cefr_level')
      .eq('auth_user_id', authUser.id)
      .single()

    if (profile) {
      setUser({
        id: profile.id,
        displayName: profile.display_name,
        cefr: profile.cefr_level,
      })
    }
  }

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim()) return

    setLoading(true)
    const intent = parseTextIntent(command)
    await executeIntent(intent)
    setCommand('')
    setLoading(false)
  }

  return (
    <OrbBG>
      <IntentCaption />
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            Ready to practice?
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Type or say a command to get started
          </p>

          <form onSubmit={handleCommand} className="max-w-md mx-auto">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder='Try: "start", "profile", "home"'
              className="w-full px-6 py-4 rounded-lg bg-white/10 border border-blue-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              disabled={loading}
            />
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
          <a
            href="/free_conversation"
            className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <div className="text-4xl mb-3">💬</div>
            <h3 className="text-white text-xl font-bold mb-2">Start Session</h3>
            <p className="text-gray-300 text-sm">
              Begin practicing with your AI tutor
            </p>
          </a>

          <a
            href="/user_profile"
            className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-white text-xl font-bold mb-2">My Progress</h3>
            <p className="text-gray-300 text-sm">
              View your learning statistics
            </p>
          </a>
        </div>
      </div>
    </OrbBG>
  )
}
