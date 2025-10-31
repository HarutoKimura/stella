import { z } from 'zod';

// Zod schemas for API I/O validation

export const MicroPackSchema = z.object({
  targets: z.array(z.object({
    phrase: z.string(),
    cefr: z.string(),
  })),
  grammar: z.string(),
  pron: z.string(),
});

export const TutorTurnInSchema = z.object({
  userText: z.string(),
  cefr: z.string(),
  activeTargets: z.array(z.string()),
  mode: z.enum(["gentle", "turn", "post"]),
});

export const TutorTurnOutSchema = z.object({
  reply: z.string(),
  corrections: z.array(z.object({
    type: z.enum(["grammar", "vocab", "pron"]),
    example: z.string(),
    correction: z.string(),
  })),
  enforce: z.object({
    must_use_next: z.string().optional(),
  }).optional(),
  metrics: z.object({
    fillers: z.number().optional(),
    pause_ms: z.number().optional(),
  }).optional(),
  usedTargets: z.array(z.string()),
  missedTargets: z.array(z.string()),
});

export const SessionSummaryInSchema = z.object({
  sessionId: z.string(),
  usedTargets: z.array(z.string()),
  missedTargets: z.array(z.string()),
  corrections: z.array(z.object({
    type: z.enum(["grammar", "vocab", "pron"]),
    example: z.string(),
    correction: z.string(),
  })),
  metrics: z.object({
    wpm: z.number().optional(),
    filler_rate: z.number().optional(),
    avg_pause_ms: z.number().optional(),
  }).optional(),
});

export const PlannerInputSchema = z.object({
  cefr: z.string(),
  lastErrors: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
});

// Database types
export type CorrectionMode = 'immediate' | 'balanced' | 'gentle';

export type DbUser = {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  native_language: string;
  cefr_level: string;
  correction_mode: CorrectionMode;
  created_at: string;
};

export type DbSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  speaking_ms: number;
  student_turns: number;
  tutor_turns: number;
  adoption_score: number;
  summary: Record<string, any>;
};

export type DbTarget = {
  id: string;
  user_id: string;
  phrase: string;
  cefr: string | null;
  status: 'planned' | 'attempted' | 'mastered';
  first_seen_at: string;
  last_seen_at: string;
};

export type DbError = {
  id: string;
  user_id: string;
  type: 'grammar' | 'vocab' | 'pron';
  example: string | null;
  correction: string | null;
  count: number;
  last_seen_at: string;
};

export type DbFluencySnapshot = {
  id: string;
  user_id: string;
  session_id: string;
  wpm: number | null;
  filler_rate: number | null;
  avg_pause_ms: number | null;
  created_at: string;
};
