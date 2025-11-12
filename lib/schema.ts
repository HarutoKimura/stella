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
  userText: z.string().min(1).max(5000), // Max 5000 characters to prevent abuse
  cefr: z.string().max(10),
  activeTargets: z.array(z.string().max(200)).max(10), // Max 10 targets, 200 chars each
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
  sessionId: z.string().uuid(),
  usedTargets: z.array(z.string().max(200)).max(50), // Max 50 targets
  missedTargets: z.array(z.string().max(200)).max(50),
  corrections: z.array(z.object({
    type: z.enum(["grammar", "vocab", "pron"]),
    example: z.string().max(1000),
    correction: z.string().max(1000),
  })).max(100), // Max 100 corrections per session
  transcript: z.array(z.object({
    role: z.enum(["user", "tutor"]),
    text: z.string().max(5000),
    timestamp: z.number(),
  })).max(500).optional(), // Max 500 turns (very generous)
  metrics: z.object({
    wpm: z.number().optional(),
    filler_rate: z.number().optional(),
    avg_pause_ms: z.number().optional(),
  }).optional(),
});

export const PlannerInputSchema = z.object({
  cefr: z.string().max(10),
  lastErrors: z.array(z.string().max(500)).max(20).optional(), // Max 20 errors, 500 chars each
  interests: z.array(z.string().max(100)).max(10).optional(), // Max 10 interests, 100 chars each
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
  mean_utterance_length: number | null;
  unique_words_count: number | null;
  total_words_count: number | null;
  grammar_accuracy: number | null;
  pronunciation_score: number | null;
  turn_ratio: number | null;
  confidence_score: number | null;
  created_at: string;
};

export type DbProgressMetric = {
  id: string;
  user_id: string;
  session_id: string;
  fluency_score: number;
  grammar_score: number;
  vocabulary_score: number;
  comprehension_score: number;
  confidence_score: number;
  total_words: number;
  unique_words: number;
  lexical_diversity: number;
  cefr_distribution: Record<string, number>;
  grammar_errors: number;
  vocab_errors: number;
  pronunciation_errors: number;
  total_errors: number;
  response_time_avg_ms: number;
  topic_switches: number;
  egi_score: number;
  created_at: string;
};

export type DbWeeklyProgress = {
  id: string;
  user_id: string;
  week_start_date: string;
  total_sessions: number;
  total_minutes: number;
  avg_fluency_score: number;
  avg_grammar_score: number;
  avg_vocabulary_score: number;
  avg_egi_score: number;
  phrases_mastered: number;
  new_vocabulary: number;
  error_reduction_rate: number;
  days_practiced: number;
  streak_maintained: boolean;
  created_at: string;
};

export type DbCefrTrajectory = {
  id: string;
  user_id: string;
  estimated_cefr: string;
  confidence_level: number;
  evaluation_basis: Record<string, string>;
  notes: string | null;
  created_at: string;
};
