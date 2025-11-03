import { NextRequest, NextResponse } from 'next/server'
import { MicroPackSchema, PlannerInputSchema, DbTarget, DbError } from '@/lib/schema'
import { MicroPack } from '@/lib/aiContracts'
import { getMixedPhrases, PHRASE_LIBRARY } from '@/lib/phraseLibrary'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

/**
 * IMPROVED Planner API - Returns personalized micro-pack based on user's history
 *
 * Strategy:
 * 1. Query user's recent errors (high-frequency mistakes)
 * 2. Query user's incomplete targets (attempted but not mastered)
 * 3. Generate smart micro-pack:
 *    - 1 phrase targeting common error pattern
 *    - 1 phrase from incomplete targets (retry)
 *    - 1 NEW phrase slightly above level
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = PlannerInputSchema.parse(body)

    const supabase = await createServerSupabaseClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's database profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, cefr_level')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Fetch user's personalized data
    const [recentErrors, incompleteTargets] = await Promise.all([
      fetchRecentErrors(supabase, userProfile.id),
      fetchIncompleteTargets(supabase, userProfile.id),
    ])

    // Generate personalized micro-pack
    const microPack = generatePersonalizedPack(
      input.cefr,
      recentErrors,
      incompleteTargets
    )

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
 * Fetch user's recent high-frequency errors
 */
async function fetchRecentErrors(supabase: any, userId: string): Promise<DbError[]> {
  const { data, error } = await supabase
    .from('errors')
    .select('*')
    .eq('user_id', userId)
    .gte('count', 2) // Only errors seen 2+ times
    .order('count', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching recent errors:', error)
    return []
  }

  return data || []
}

/**
 * Fetch user's incomplete targets (planned or attempted, not mastered)
 */
async function fetchIncompleteTargets(supabase: any, userId: string): Promise<DbTarget[]> {
  const { data, error } = await supabase
    .from('targets')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['planned', 'attempted'])
    .order('last_seen_at', { ascending: true }) // Prioritize older attempts
    .limit(10)

  if (error) {
    console.error('Error fetching incomplete targets:', error)
    return []
  }

  return data || []
}

/**
 * Generate personalized micro-pack based on user's weakness patterns
 */
function generatePersonalizedPack(
  cefr: string,
  recentErrors: DbError[],
  incompleteTargets: DbTarget[]
): MicroPack {
  const selectedPhrases: { phrase: string; cefr: string }[] = []

  // 1. Add ONE phrase from incomplete targets (retry failed attempts)
  if (incompleteTargets.length > 0) {
    const retryTarget = incompleteTargets[0]
    selectedPhrases.push({
      phrase: retryTarget.phrase,
      cefr: retryTarget.cefr || cefr,
    })
  }

  // 2. Add ONE phrase targeting common error pattern
  if (recentErrors.length > 0) {
    const errorPhrase = selectPhraseForError(recentErrors[0], cefr)
    if (errorPhrase && !selectedPhrases.find(p => p.phrase === errorPhrase.phrase)) {
      selectedPhrases.push(errorPhrase)
    }
  }

  // 3. Fill remaining slots with NEW phrases slightly above level
  const neededCount = 3 - selectedPhrases.length
  if (neededCount > 0) {
    const newPhrases = getMixedPhrases(cefr, neededCount + 5) // Get extras to filter out duplicates
    const filteredPhrases = newPhrases.filter(
      p => !selectedPhrases.find(sp => sp.phrase === p.phrase) &&
           !incompleteTargets.find(t => t.phrase === p.phrase)
    )
    selectedPhrases.push(...filteredPhrases.slice(0, neededCount).map(p => ({
      phrase: p.phrase,
      cefr: p.cefr,
    })))
  }

  // Ensure we always have 3 phrases (fallback to random if needed)
  while (selectedPhrases.length < 3) {
    const fallback = getMixedPhrases(cefr, 1)
    if (fallback.length > 0 && !selectedPhrases.find(p => p.phrase === fallback[0].phrase)) {
      selectedPhrases.push({
        phrase: fallback[0].phrase,
        cefr: fallback[0].cefr,
      })
    }
  }

  return {
    targets: selectedPhrases.slice(0, 3),
    grammar: getGrammarForErrors(recentErrors, cefr),
    pron: getPronunciationForErrors(recentErrors, cefr),
  }
}

/**
 * Select a phrase that helps address a specific error type
 */
function selectPhraseForError(
  error: DbError,
  cefr: string
): { phrase: string; cefr: string } | null {
  // Map error types to relevant phrase categories
  const categoryMap: Record<string, string[]> = {
    grammar: ['request', 'courtesy', 'discussion', 'clarification'],
    vocab: ['opinion', 'discussion', 'consideration', 'analysis'],
    pron: ['greeting', 'introduction', 'daily', 'restaurant'],
  }

  const categories = categoryMap[error.type] || ['discussion']
  const relevantPhrases = PHRASE_LIBRARY.filter(
    p => categories.includes(p.category) && (p.cefr === cefr || p.cefr === getNextLevel(cefr))
  )

  if (relevantPhrases.length === 0) return null

  const selected = relevantPhrases[Math.floor(Math.random() * relevantPhrases.length)]
  return {
    phrase: selected.phrase,
    cefr: selected.cefr,
  }
}

/**
 * Get grammar point based on user's error patterns
 */
function getGrammarForErrors(errors: DbError[], cefr: string): string {
  const grammarErrors = errors.filter(e => e.type === 'grammar')

  // If user has grammar errors, target related grammar points
  if (grammarErrors.length > 0 && grammarErrors[0].correction) {
    // Extract grammar point from correction (simplified logic)
    const correction = grammarErrors[0].correction.toLowerCase()
    if (correction.includes('tense')) return getTenseGrammar(cefr)
    if (correction.includes('modal')) return 'Modal verbs (can, should, must)'
    if (correction.includes('article')) return 'Article usage (a, an, the)'
    if (correction.includes('preposition')) return 'Preposition patterns'
  }

  return getGrammarPoint(cefr)
}

/**
 * Get pronunciation point based on user's error patterns
 */
function getPronunciationForErrors(errors: DbError[], cefr: string): string {
  const pronErrors = errors.filter(e => e.type === 'pron')

  if (pronErrors.length > 0 && pronErrors[0].example) {
    // Could analyze example to determine specific sound issues
    // For now, use generic pronunciation point
  }

  return getPronunciationPoint(cefr)
}

// Helper functions (keep from original)
function getNextLevel(cefr: string): string {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const index = levels.indexOf(cefr)
  return index < levels.length - 1 ? levels[index + 1] : cefr
}

function getTenseGrammar(cefr: string): string {
  const tenseMap: Record<string, string> = {
    A1: 'Present simple tense',
    A2: 'Past simple tense',
    B1: 'Present perfect tense',
    B2: 'Past perfect tense',
    C1: 'Mixed tenses in context',
    C2: 'Advanced tense usage',
  }
  return tenseMap[cefr] || 'Present perfect tense'
}

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
