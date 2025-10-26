import { NextRequest, NextResponse } from 'next/server'
import { MicroPackSchema, PlannerInputSchema } from '@/lib/schema'
import { MicroPack } from '@/lib/aiContracts'
import { getMixedPhrases } from '@/lib/phraseLibrary'

/**
 * Planner API - Returns a micro-pack of phrases to practice
 * Now uses a fixed phrase library instead of AI generation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = PlannerInputSchema.parse(body)

    // Get 3 random phrases from the library (current level + slightly above)
    const phrases = getMixedPhrases(input.cefr, 3)

    // Create micro-pack with selected phrases
    const microPack: MicroPack = {
      targets: phrases.map((p) => ({
        phrase: p.phrase,
        cefr: p.cefr,
      })),
      grammar: getGrammarPoint(input.cefr),
      pron: getPronunciationPoint(input.cefr),
    }

    const validated = MicroPackSchema.parse(microPack)
    return NextResponse.json(validated)
  } catch (error) {
    console.error('Planner API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate micro-pack' },
      { status: 500 }
    )
  }
}

/**
 * Get grammar point based on CEFR level
 */
function getGrammarPoint(cefr: string): string {
  const grammarPoints: Record<string, string[]> = {
    A1: ['Present simple', 'Basic questions', 'Personal pronouns'],
    A2: ['Past simple', 'Future with "going to"', 'Comparative adjectives'],
    B1: ['Present perfect', 'Conditional sentences', 'Modal verbs'],
    B2: ['Past perfect', 'Passive voice', 'Reported speech'],
    C1: ['Mixed conditionals', 'Inversion', 'Cleft sentences'],
    C2: ['Subjunctive mood', 'Advanced modals', 'Complex relative clauses'],
  }

  const points = grammarPoints[cefr] || grammarPoints.B1
  return points[Math.floor(Math.random() * points.length)]
}

/**
 * Get pronunciation point based on CEFR level
 */
function getPronunciationPoint(cefr: string): string {
  const pronPoints: Record<string, string[]> = {
    A1: ['th sounds', 'Basic vowels', 'Word stress'],
    A2: ['r vs l', 'Long vs short vowels', 'Sentence stress'],
    B1: ['Linking sounds', 'Weak forms', 'Intonation patterns'],
    B2: ['Consonant clusters', 'Schwa sound', 'Rhythm and timing'],
    C1: ['Advanced intonation', 'Accent reduction', 'Natural speech flow'],
    C2: ['Native-like rhythm', 'Subtle sound distinctions', 'Register variation'],
  }

  const points = pronPoints[cefr] || pronPoints.B1
  return points[Math.floor(Math.random() * points.length)]
}
