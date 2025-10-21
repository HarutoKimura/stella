import { create } from 'zustand'

export type TranscriptTurn = {
  role: 'user' | 'tutor'
  text: string
  timestamp: number
}

export type UserProfile = {
  id: string
  displayName: string | null
  cefr: string
}

export type SessionStats = {
  studentTurns: number
  tutorTurns: number
  speakingMs: number
}

export type TargetStatus = {
  phrase: string
  used: boolean
  attempts: number
}

type SessionStore = {
  user: UserProfile | null
  sessionId: string | null
  transcript: TranscriptTurn[]
  activeTargets: TargetStatus[]
  stats: SessionStats
  isVoiceMode: boolean
  currentIntent: string | null

  // Actions
  setUser: (user: UserProfile | null) => void
  startSession: (sessionId: string, targets: string[]) => void
  endSession: () => void
  addTurn: (role: 'user' | 'tutor', text: string) => void
  markTargetUsed: (phrase: string) => void
  updateStats: (updates: Partial<SessionStats>) => void
  setVoiceMode: (enabled: boolean) => void
  setIntent: (intent: string | null) => void
  reset: () => void
}

const initialState = {
  user: null,
  sessionId: null,
  transcript: [],
  activeTargets: [],
  stats: {
    studentTurns: 0,
    tutorTurns: 0,
    speakingMs: 0,
  },
  isVoiceMode: false,
  currentIntent: null,
}

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),

  startSession: (sessionId, targets) =>
    set({
      sessionId,
      activeTargets: targets.map((phrase) => ({
        phrase,
        used: false,
        attempts: 0,
      })),
      transcript: [],
      stats: {
        studentTurns: 0,
        tutorTurns: 0,
        speakingMs: 0,
      },
    }),

  endSession: () =>
    set({
      sessionId: null,
      transcript: [],
      activeTargets: [],
      stats: {
        studentTurns: 0,
        tutorTurns: 0,
        speakingMs: 0,
      },
    }),

  addTurn: (role, text) =>
    set((state) => ({
      transcript: [
        ...state.transcript,
        { role, text, timestamp: Date.now() },
      ],
      stats: {
        ...state.stats,
        studentTurns: role === 'user' ? state.stats.studentTurns + 1 : state.stats.studentTurns,
        tutorTurns: role === 'tutor' ? state.stats.tutorTurns + 1 : state.stats.tutorTurns,
      },
    })),

  markTargetUsed: (phrase) =>
    set((state) => ({
      activeTargets: state.activeTargets.map((target) =>
        target.phrase === phrase
          ? { ...target, used: true, attempts: target.attempts + 1 }
          : target
      ),
    })),

  updateStats: (updates) =>
    set((state) => ({
      stats: { ...state.stats, ...updates },
    })),

  setVoiceMode: (enabled) => set({ isVoiceMode: enabled }),

  setIntent: (intent) => set({ currentIntent: intent }),

  reset: () => set(initialState),
}))
