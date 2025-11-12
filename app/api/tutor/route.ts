import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { TutorTurnInSchema, TutorTurnOutSchema } from '@/lib/schema'
import type { TutorTurnOut } from '@/lib/aiContracts'
import { ratelimit, getRateLimitIdentifier } from '@/lib/ratelimit'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting - strict for AI calls (using authenticated user ID)
    const identifier = getRateLimitIdentifier(req, user.id)
    const { success } = await ratelimit.ai.limit(identifier)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await req.json()
    const input = TutorTurnInSchema.parse(body)

    // Normalize mode (defaults to 'light' if omitted)
    const mode = (input.mode ?? 'light') as 'light' | 'standard' | 'exam'

    // Mode-specific guidance for frequency/strictness
    const modePolicy =
      mode === 'exam'
        ? `CORRECTION POLICY (EXAM):
- After each learner turn, provide up to 2 concise corrections if needed.
- It's okay to be strict, but keep tone friendly and brief.`
        : mode === 'standard'
        ? `CORRECTION POLICY (STANDARD):
- Provide at most 1 concise correction every 1–2 learner turns.
- Prefer end-of-turn notes; avoid interrupting flow.`
        : `CORRECTION POLICY (LIGHT DEFAULT):
- Provide at most 1 concise correction every 2–3 learner turns.
- Prioritize natural flow; only correct when clearly helpful.`

    // Treat activeTargets as an optional gentle nudge pool, not must-use items
    const optionalTargets =
      (input.activeTargets && input.activeTargets.length > 0)
        ? `OPTIONAL VOCAB NUDGE POOL (use sparingly, ≤1 per 3 learner turns):
${input.activeTargets.join(', ')}`
        : `OPTIONAL VOCAB NUDGE POOL: (none provided)`

    const systemPrompt = `You are a general-purpose AI English tutor for everyday conversation.
Your goal is to keep the chat natural and enjoyable while offering *lightweight* help.

PRINCIPLES
- Natural first: follow the learner’s topic of choice. Do NOT role-play an occupation unless explicitly asked.
- Light touch: prioritize flow over correction. Keep the learner speaking ≥65% of the time.
- Respect turns: never interrupt mid-sentence; imagine waiting ~3–5 seconds before jumping in.
- Correction style: concise, friendly, one-liners. Prefer turn-end mini-notes over mid-turn interjections.
- Vocabulary nudges: occasionally (≤1 per 3 learner turns) suggest one nicer synonym or phrasing when it feels natural.
- Consent & control: if the learner says “no corrections”, pause corrections until they ask again.
- Stop words: if the learner says “stop”, “end”, or “finish”, you should end the session.

${modePolicy}

${optionalTargets}

OUTPUT CONTRACT (MUST be strict JSON, no extra text):
{
  "reply": "Tutor response (1–2 sentences, ask a genuine follow-up if appropriate)",
  "corrections": [
    {
      "type": "grammar" | "vocab" | "pron",
      "example": "the full sentence or phrase with sufficient context that the learner said (not just the error word)",
      "correction": "the corrected full sentence or phrase with the same context",
      "note": "≤ 15 words (optional)"
    }
  ],
  "enforce": { "must_use_next": string | null },  // usually null in LIGHT/STANDARD unless learner explicitly asks for drills
  "metrics": { "fillers": number | 0, "pause_ms": number | 1200 },
  "usedTargets": string[],    // phrases the learner already used well (may be empty)
  "missedTargets": string[]   // optional gentle opportunities; keep short and relevant (may be empty)
}

IMPORTANT FOR CORRECTIONS:
- For grammar errors (especially tense, verb forms): include enough context to show WHY the correction is needed
  Example: If learner says "Yesterday I go to the store", don't just extract "go" → "went"
  Instead extract: "Yesterday I go to the store" → "Yesterday I went to the store"
- For vocabulary: include the surrounding phrase to show proper usage
  Example: "the assessment result" → "the assessment results"
- Keep both "example" and "correction" as complete, understandable sentences or meaningful phrases

RULES
- Keep reply short; avoid long lectures.
- If you include corrections, keep them minimal and only when clearly helpful (follow mode policy).
- If the learner did well, it's fine for "corrections" to be an empty array.
- Do not force any target phrase usage; "enforce.must_use_next" should usually be null unless the learner requested focused practice.
- Never fabricate facts about the learner; ask if unsure.`

    const completion = await openai.chat.completions.create({
      // Keep your chosen model; swap if needed
      model: 'gpt-5-nano-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Learner (CEFR ${input.cefr}) said: "${input.userText}"`
        },
      ],
      response_format: { type: 'json_object' },
      // Temperature left at model default per your note
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('No content returned from OpenAI')
    }

    const parsed: TutorTurnOut = JSON.parse(content)

    // Safety: ensure arrays exist even if model returns null/undefined
    parsed.corrections = Array.isArray(parsed.corrections) ? parsed.corrections : []
    parsed.usedTargets = Array.isArray(parsed.usedTargets) ? parsed.usedTargets : []
    parsed.missedTargets = Array.isArray(parsed.missedTargets) ? parsed.missedTargets : []
    if (!parsed.enforce) parsed.enforce = { must_use_next: null as unknown as string }

    const validated = TutorTurnOutSchema.parse(parsed)
    return NextResponse.json(validated)
  } catch (error) {
    console.error('Tutor API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate tutor response' },
      { status: 500 }
    )
  }
}
