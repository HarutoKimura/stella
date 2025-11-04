/**
 * TypeScript types for AI Coach v2 feature
 */

export interface CoachTurn {
  turn: number
  coach_text: string
  expected_student_text: string
  correction_tip: string
}

export interface CoachSession {
  id: string
  user_id: string
  week_id: number
  focus_areas: string[]
  dialogue: CoachTurn[]
  avg_score?: number
  created_at: string
}

export interface StartSessionRequest {
  focusAreas: string[]
  level: string
  theme?: string
  insightText?: string
  userId: string
  weekId: number
}

export interface StartSessionResponse {
  sessionId: string
  dialogue: CoachTurn[]
}

export interface CoachDialogueResponse {
  dialogue: CoachTurn[]
}

/**
 * Types for Realtime Conversation Mode
 */

export interface ConversationMessage {
  role: 'user' | 'assistant'
  text: string
  timestamp?: string
}

export interface ConversationSession {
  id: string
  user_id: string
  week_id: number
  focus_areas: string[]
  transcript: ConversationMessage[]
  feedback?: string
  avg_score?: number
  created_at: string
}

export interface StartConversationRequest {
  focusAreas: string[]
  level: string
  insightSummary?: string
  weekId: number
}

export interface SaveConversationRequest {
  weekId: number
  focusAreas: string[]
  transcript: ConversationMessage[]
  insightSummary?: string
}

export interface SaveConversationResponse {
  sessionId: string
  feedback: string
}

export interface RealtimeMessageRequest {
  input: string
  focusAreas: string[]
  level: string
  messages: ConversationMessage[]
}

export interface RealtimeMessageResponse {
  reply: string
}
