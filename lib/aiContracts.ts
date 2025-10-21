// Shared JSON contracts for AI API routes

export type MicroPack = {
  targets: { phrase: string; cefr: string }[];
  grammar: string;
  pron: string;
};

export type TutorTurnIn = {
  userText: string;
  cefr: string;
  activeTargets: string[];  // phrases to enforce
  mode: "gentle" | "turn" | "post";
};

export type TutorTurnOut = {
  reply: string;
  corrections: { type: "grammar" | "vocab" | "pron"; example: string; correction: string }[];
  enforce?: { must_use_next?: string };
  metrics?: { fillers?: number; pause_ms?: number };
  usedTargets: string[];
  missedTargets: string[];
};

export type SessionSummaryIn = {
  sessionId: string;
  usedTargets: string[];
  missedTargets: string[];
  corrections: TutorTurnOut["corrections"];
  metrics?: { wpm?: number; filler_rate?: number; avg_pause_ms?: number };
};

// Phase 2: Realtime API contracts
export type RealtimeSessionConfig = {
  token: string;
  model: string;
  voice: string;
  instructions: string;
  functions: RealtimeFunction[];
  activeTargets: string[];
};

export type RealtimeFunction = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; enum?: string[]; description?: string }>;
    required?: string[];
  };
};

export type VoiceIntent =
  | { type: "navigate"; destination: "/home" | "/user_profile" | "/free_conversation" }
  | { type: "start_session" }
  | { type: "end_session" }
  | { type: "add_target"; phrase: string }
  | { type: "mark_target_used"; phrase: string }
  | { type: "add_correction"; correctionType: "grammar" | "vocab" | "pron"; example: string; correction: string };
