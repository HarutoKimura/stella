/**
 * Metrics Calculator
 * Comprehensive statistical analysis for language learning progress
 */

// CEFR word list samples (simplified - in production, use comprehensive CEFR lexicon)
const CEFR_WORD_LISTS: Record<string, Set<string>> = {
  A1: new Set(['hello', 'yes', 'no', 'please', 'thank', 'you', 'good', 'bad', 'big', 'small']),
  A2: new Set(['because', 'before', 'after', 'always', 'never', 'sometimes', 'usually']),
  B1: new Set(['although', 'however', 'therefore', 'furthermore', 'nevertheless']),
  B2: new Set(['consequently', 'meanwhile', 'nonetheless', 'whereby', 'whereas']),
  C1: new Set(['notwithstanding', 'hitherto', 'albeit', 'forthwith']),
  C2: new Set(['quintessential', 'ubiquitous', 'paradigm', 'albeit']),
}

// Common filler words for detection
const FILLER_WORDS = new Set([
  'um', 'uh', 'like', 'you know', 'i mean', 'well', 'so', 'actually', 'basically',
  'literally', 'honestly', 'kind of', 'sort of', 'right'
])

export interface TranscriptTurn {
  role: 'user' | 'tutor'
  text: string
  timestamp: number
}

export interface Correction {
  type: 'grammar' | 'vocab' | 'pron'
  example: string
  correction: string
}

export interface MetricsInput {
  transcript: TranscriptTurn[]
  corrections: Correction[]
  usedTargets: string[]
  missedTargets: string[]
  sessionDurationMs: number
  userCefrLevel: string
}

export interface CalculatedMetrics {
  // Fluency metrics
  wpm: number
  filler_rate: number
  avg_pause_ms: number
  mean_utterance_length: number

  // Vocabulary metrics
  total_words: number
  unique_words: number
  lexical_diversity: number  // type-token ratio
  cefr_distribution: Record<string, number>

  // Grammar & accuracy
  grammar_accuracy: number
  grammar_errors: number
  vocab_errors: number
  pronunciation_errors: number
  total_errors: number

  // Speaking behavior
  turn_ratio: number  // user speaking time %
  response_time_avg_ms: number

  // Scores (0-100)
  fluency_score: number
  grammar_score: number
  vocabulary_score: number
  comprehension_score: number
  confidence_score: number
  pronunciation_score: number

  // Composite
  egi_score: number  // English Growth Index
}

/**
 * Calculate comprehensive metrics from session transcript
 */
export function calculateMetrics(input: MetricsInput): CalculatedMetrics {
  const userTurns = input.transcript.filter(t => t.role === 'user')
  const tutorTurns = input.transcript.filter(t => t.role === 'tutor')

  // 1. Extract all user words
  const allUserText = userTurns.map(t => t.text).join(' ')
  const words = tokenizeWords(allUserText)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()))

  // 2. Calculate fluency metrics
  const fluencyMetrics = calculateFluencyMetrics(userTurns, input.sessionDurationMs)

  // 3. Calculate vocabulary metrics
  const vocabMetrics = calculateVocabularyMetrics(words, uniqueWords, input.userCefrLevel)

  // 4. Calculate accuracy metrics
  const accuracyMetrics = calculateAccuracyMetrics(input.corrections, userTurns.length)

  // 5. Calculate speaking behavior
  const behaviorMetrics = calculateBehaviorMetrics(userTurns, tutorTurns, input.transcript)

  // 6. Calculate scores (0-100 normalized)
  const scores = calculateScores({
    ...fluencyMetrics,
    ...vocabMetrics,
    ...accuracyMetrics,
    ...behaviorMetrics,
  }, input)

  // 7. Calculate EGI (English Growth Index)
  const egi_score = calculateEGI(scores)

  return {
    ...fluencyMetrics,
    ...vocabMetrics,
    ...accuracyMetrics,
    ...behaviorMetrics,
    ...scores,
    egi_score,
  }
}

/**
 * Tokenize text into words
 */
function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')  // Keep apostrophes for contractions
    .split(/\s+/)
    .filter(w => w.length > 0)
}

/**
 * Calculate fluency-related metrics
 */
function calculateFluencyMetrics(
  userTurns: TranscriptTurn[],
  sessionDurationMs: number
): {
  wpm: number
  filler_rate: number
  avg_pause_ms: number
  mean_utterance_length: number
} {
  if (userTurns.length === 0) {
    return { wpm: 0, filler_rate: 0, avg_pause_ms: 0, mean_utterance_length: 0 }
  }

  const allWords = userTurns.flatMap(t => tokenizeWords(t.text))
  const totalWords = allWords.length

  // Calculate WPM (words per minute)
  const speakingMinutes = sessionDurationMs / 60000
  const wpm = speakingMinutes > 0 ? Math.round(totalWords / speakingMinutes) : 0

  // Calculate filler rate (fillers per 100 words)
  const fillerCount = allWords.filter(w => FILLER_WORDS.has(w)).length
  const filler_rate = totalWords > 0 ? (fillerCount / totalWords) * 100 : 0

  // Calculate average pause between turns (rough estimate)
  const pauses: number[] = []
  for (let i = 1; i < userTurns.length; i++) {
    const pause = userTurns[i].timestamp - userTurns[i - 1].timestamp
    if (pause < 30000) {  // Only count pauses < 30 seconds
      pauses.push(pause)
    }
  }
  const avg_pause_ms = pauses.length > 0
    ? Math.round(pauses.reduce((a, b) => a + b, 0) / pauses.length)
    : 0

  // Mean utterance length (words per turn)
  const mean_utterance_length = totalWords / userTurns.length

  return { wpm, filler_rate, avg_pause_ms, mean_utterance_length }
}

/**
 * Calculate vocabulary-related metrics
 */
function calculateVocabularyMetrics(
  words: string[],
  uniqueWords: Set<string>,
  userCefrLevel: string
): {
  total_words: number
  unique_words: number
  lexical_diversity: number
  cefr_distribution: Record<string, number>
} {
  const total_words = words.length
  const unique_words_count = uniqueWords.size

  // Type-token ratio (lexical diversity)
  const lexical_diversity = total_words > 0 ? unique_words_count / total_words : 0

  // CEFR distribution
  const cefr_distribution: Record<string, number> = {
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0
  }

  uniqueWords.forEach(word => {
    let found = false
    for (const [level, wordList] of Object.entries(CEFR_WORD_LISTS)) {
      if (wordList.has(word)) {
        cefr_distribution[level]++
        found = true
        break
      }
    }
    // If not found in any list, assume it's at user's level
    if (!found) {
      cefr_distribution[userCefrLevel] = (cefr_distribution[userCefrLevel] || 0) + 1
    }
  })

  return {
    total_words,
    unique_words: unique_words_count,
    lexical_diversity,
    cefr_distribution,
  }
}

/**
 * Calculate accuracy metrics from corrections
 */
function calculateAccuracyMetrics(
  corrections: Correction[],
  totalUserTurns: number
): {
  grammar_errors: number
  vocab_errors: number
  pronunciation_errors: number
  total_errors: number
  grammar_accuracy: number
} {
  const grammar_errors = corrections.filter(c => c.type === 'grammar').length
  const vocab_errors = corrections.filter(c => c.type === 'vocab').length
  const pronunciation_errors = corrections.filter(c => c.type === 'pron').length
  const total_errors = corrections.length

  // Grammar accuracy: % of turns without grammar errors
  const grammar_accuracy = totalUserTurns > 0
    ? ((totalUserTurns - grammar_errors) / totalUserTurns) * 100
    : 100

  return {
    grammar_errors,
    vocab_errors,
    pronunciation_errors,
    total_errors,
    grammar_accuracy: Math.max(0, Math.min(100, grammar_accuracy)),
  }
}

/**
 * Calculate speaking behavior metrics
 */
function calculateBehaviorMetrics(
  userTurns: TranscriptTurn[],
  tutorTurns: TranscriptTurn[],
  allTurns: TranscriptTurn[]
): {
  turn_ratio: number
  response_time_avg_ms: number
} {
  // Turn ratio: user turns / total turns
  const totalTurns = userTurns.length + tutorTurns.length
  const turn_ratio = totalTurns > 0 ? (userTurns.length / totalTurns) * 100 : 0

  // Response time: average time from tutor's turn to user's response
  const responseTimes: number[] = []
  for (let i = 1; i < allTurns.length; i++) {
    if (allTurns[i].role === 'user' && allTurns[i - 1].role === 'tutor') {
      const responseTime = allTurns[i].timestamp - allTurns[i - 1].timestamp
      if (responseTime < 60000) {  // Only count < 1 minute
        responseTimes.push(responseTime)
      }
    }
  }

  const response_time_avg_ms = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0

  return { turn_ratio, response_time_avg_ms }
}

/**
 * Calculate normalized scores (0-100)
 */
function calculateScores(
  metrics: any,
  input: MetricsInput
): {
  fluency_score: number
  grammar_score: number
  vocabulary_score: number
  comprehension_score: number
  confidence_score: number
  pronunciation_score: number
} {
  // Fluency score: based on WPM and filler rate
  // Target: 120-150 WPM for intermediate learners
  const wpmScore = Math.min(100, (metrics.wpm / 150) * 100)
  const fillerPenalty = metrics.filler_rate * 2  // -2 points per % filler
  const fluency_score = Math.max(0, wpmScore - fillerPenalty)

  // Grammar score: directly from grammar accuracy
  const grammar_score = metrics.grammar_accuracy

  // Vocabulary score: lexical diversity + CEFR appropriateness
  const diversityScore = metrics.lexical_diversity * 100
  const cefrScore = calculateCefrScore(metrics.cefr_distribution, input.userCefrLevel)
  const vocabulary_score = (diversityScore * 0.4) + (cefrScore * 0.6)

  // Comprehension score: based on target usage
  const totalTargets = input.usedTargets.length + input.missedTargets.length
  const comprehension_score = totalTargets > 0
    ? (input.usedTargets.length / totalTargets) * 100
    : 50  // Default if no targets

  // Confidence score: based on turn ratio and response time
  // Higher turn ratio and faster responses = more confident
  const turnConfidence = Math.min(100, metrics.turn_ratio * 1.5)  // Target ~67%
  const responseConfidence = metrics.response_time_avg_ms > 0
    ? Math.max(0, 100 - (metrics.response_time_avg_ms / 100))  // Penalty for slow response
    : 50
  const confidence_score = (turnConfidence * 0.6) + (responseConfidence * 0.4)

  // Pronunciation score: based on pronunciation errors
  const pronunciationAccuracy = input.transcript.filter(t => t.role === 'user').length
  const pronunciation_score = pronunciationAccuracy > 0
    ? ((pronunciationAccuracy - metrics.pronunciation_errors) / pronunciationAccuracy) * 100
    : 50

  return {
    fluency_score: Math.round(Math.max(0, Math.min(100, fluency_score))),
    grammar_score: Math.round(Math.max(0, Math.min(100, grammar_score))),
    vocabulary_score: Math.round(Math.max(0, Math.min(100, vocabulary_score))),
    comprehension_score: Math.round(Math.max(0, Math.min(100, comprehension_score))),
    confidence_score: Math.round(Math.max(0, Math.min(100, confidence_score))),
    pronunciation_score: Math.round(Math.max(0, Math.min(100, pronunciation_score))),
  }
}

/**
 * Calculate CEFR appropriateness score
 */
function calculateCefrScore(
  distribution: Record<string, number>,
  userLevel: string
): number {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const userIndex = levels.indexOf(userLevel)

  let score = 0
  let totalWords = 0

  for (const [level, count] of Object.entries(distribution)) {
    const levelIndex = levels.indexOf(level)
    totalWords += count

    // Award points based on proximity to user level
    if (levelIndex === userIndex) {
      score += count * 100  // Same level: full points
    } else if (levelIndex === userIndex + 1) {
      score += count * 120  // One level up: bonus (desired challenge)
    } else if (levelIndex === userIndex - 1) {
      score += count * 80   // One level down: acceptable
    } else {
      score += count * 50   // Far from level: lower score
    }
  }

  return totalWords > 0 ? score / totalWords : 50
}

/**
 * Calculate EGI (English Growth Index)
 * Weighted composite: F=0.30, G=0.25, V=0.20, C=0.15, Conf=0.10
 */
function calculateEGI(scores: {
  fluency_score: number
  grammar_score: number
  vocabulary_score: number
  comprehension_score: number
  confidence_score: number
}): number {
  const egi = (
    scores.fluency_score * 0.30 +
    scores.grammar_score * 0.25 +
    scores.vocabulary_score * 0.20 +
    scores.comprehension_score * 0.15 +
    scores.confidence_score * 0.10
  )

  return Math.round(Math.max(0, Math.min(100, egi)))
}

/**
 * Estimate CEFR level from metrics
 */
export function estimateCefrLevel(metrics: CalculatedMetrics): {
  level: string
  confidence: number
  basis: Record<string, string>
} {
  const scores = {
    fluency: metrics.fluency_score,
    grammar: metrics.grammar_score,
    vocabulary: metrics.vocabulary_score,
  }

  // Simple heuristic mapping
  const avgScore = (scores.fluency + scores.grammar + scores.vocabulary) / 3

  let level = 'B1'
  if (avgScore >= 90) level = 'C2'
  else if (avgScore >= 80) level = 'C1'
  else if (avgScore >= 70) level = 'B2'
  else if (avgScore >= 60) level = 'B1'
  else if (avgScore >= 45) level = 'A2'
  else level = 'A1'

  // Confidence based on variance
  const variance = Math.max(
    Math.abs(scores.fluency - avgScore),
    Math.abs(scores.grammar - avgScore),
    Math.abs(scores.vocabulary - avgScore)
  )
  const confidence = Math.max(0.5, 1 - (variance / 100))

  const basis = {
    fluency: estimateSubLevel(scores.fluency),
    grammar: estimateSubLevel(scores.grammar),
    vocabulary: estimateSubLevel(scores.vocabulary),
  }

  return { level, confidence, basis }
}

function estimateSubLevel(score: number): string {
  if (score >= 90) return 'C2'
  if (score >= 80) return 'C1'
  if (score >= 70) return 'B2'
  if (score >= 60) return 'B1'
  if (score >= 45) return 'A2'
  return 'A1'
}
