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
