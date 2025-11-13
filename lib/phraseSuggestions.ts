import { PhraseCardData } from '@/components/FloatingPhraseCard'
import { PHRASE_LIBRARY, PhraseItem } from './phraseLibrary'

/**
 * Database error type from errors table
 */
type DbError = {
  id: string
  user_id: string
  type: 'grammar' | 'vocab' | 'pron'
  example: string
  correction: string
  count: number
  last_seen_at: string
}

/**
 * Map error patterns to relevant phrase categories based on database errors
 */
function mapErrorTypeToCategories(error: DbError): string[] {
  const lowerExample = error.example.toLowerCase()
  const lowerCorrection = error.correction.toLowerCase()

  if (error.type === 'grammar') {
    // Analyze grammar mistakes
    if (lowerCorrection.includes('tense') || lowerExample.includes('tense')) {
      return ['daily', 'discussion', 'narration']
    } else if (lowerCorrection.includes('preposition')) {
      return ['navigation', 'request', 'discussion']
    } else if (lowerCorrection.includes('article') || lowerCorrection.includes('a/an/the')) {
      return ['shopping', 'request', 'restaurant']
    } else if (lowerCorrection.includes('modal') || lowerCorrection.includes('should') || lowerCorrection.includes('could')) {
      return ['request', 'courtesy', 'opinion', 'advice']
    } else if (lowerCorrection.includes('plural') || lowerCorrection.includes('singular')) {
      return ['shopping', 'daily', 'description']
    } else {
      // General grammar error
      return ['discussion', 'clarification', 'request']
    }
  } else if (error.type === 'vocab') {
    // Analyze vocabulary mistakes
    if (lowerCorrection.includes('expression') || lowerCorrection.includes('phrase')) {
      return ['opinion', 'discussion', 'consideration', 'emphasis']
    } else if (lowerCorrection.includes('formal') || lowerCorrection.includes('polite')) {
      return ['courtesy', 'request', 'disagreement']
    } else if (lowerCorrection.includes('word choice') || lowerCorrection.includes('collocation')) {
      return ['discussion', 'analysis', 'description']
    } else {
      // General vocabulary error
      return ['opinion', 'discussion', 'clarification']
    }
  } else if (error.type === 'pron') {
    // Pronunciation errors - suggest simpler phrases for practice
    return ['greeting', 'daily', 'courtesy', 'request']
  }

  return ['discussion']
}

/**
 * Select phrases based on user's historical errors and CEFR level
 */
function selectPhrasesForErrors(
  errors: DbError[],
  cefr: string,
  existingPhrases: string[]
): PhraseItem[] {
  if (errors.length === 0) return []

  // Collect all relevant categories from top errors (sorted by count)
  const relevantCategories = new Set<string>()

  // Prioritize high-count errors
  const topErrors = errors.sort((a, b) => b.count - a.count).slice(0, 5)

  topErrors.forEach((error) => {
    const categories = mapErrorTypeToCategories(error)
    categories.forEach((cat) => relevantCategories.add(cat))
  })

  console.log('[Phrase Selection] Relevant categories from errors:', Array.from(relevantCategories))

  // Filter phrases by CEFR level and relevant categories
  const candidatePhrases = PHRASE_LIBRARY.filter((phrase) => {
    // Match CEFR level (current or one below for practice)
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    const currentIndex = levels.indexOf(cefr)
    const targetLevels = [cefr]
    if (currentIndex > 0) {
      targetLevels.push(levels[currentIndex - 1]) // Include one level below for easier practice
    }
    if (currentIndex < levels.length - 1) {
      targetLevels.push(levels[currentIndex + 1]) // Include one level above for challenge
    }

    const matchesLevel = targetLevels.includes(phrase.cefr)
    const matchesCategory = relevantCategories.has(phrase.category)
    const notAlreadyUsed = !existingPhrases.includes(phrase.phrase)

    return matchesLevel && matchesCategory && notAlreadyUsed
  })

  console.log('[Phrase Selection] Candidate phrases found:', candidatePhrases.length)

  // Shuffle and return
  return candidatePhrases.sort(() => Math.random() - 0.5)
}

/**
 * Generate example sentences dynamically based on phrase
 */
function generateExampleSentence(phrase: string, category: string): string {
  // Simple example generator
  const templates: Record<string, string[]> = {
    request: [
      `${phrase} some help?`,
      `${phrase} join you for lunch?`,
      `${phrase} a favor?`,
    ],
    opinion: [
      `${phrase} this is a great opportunity.`,
      `${phrase} we should consider all options.`,
      `${phrase} quality matters more than quantity.`,
    ],
    discussion: [
      `${phrase} Let's explore that further.`,
      `${phrase} What do you think about this?`,
      `${phrase} There are multiple perspectives here.`,
    ],
    courtesy: [
      `${phrase} Could we discuss this later?`,
      `${phrase} I appreciate your patience.`,
      `${phrase} Thank you for understanding.`,
    ],
    default: [
      `You can use "${phrase}" when discussing your ideas.`,
      `Try saying "${phrase}" in this context.`,
      `Practice with: ${phrase}`,
    ],
  }

  const categoryTemplates = templates[category] || templates.default
  const template = categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)]

  return template
}

/**
 * Format category to readable text
 */
function formatCategory(category: string): string {
  const categoryNames: Record<string, string> = {
    greeting: 'Greeting',
    introduction: 'Introduction',
    courtesy: 'Polite Expression',
    request: 'Making Requests',
    restaurant: 'Restaurant',
    daily: 'Daily Conversation',
    opinion: 'Giving Opinions',
    discussion: 'Discussion',
    clarification: 'Clarification',
    consideration: 'Considering Options',
    emphasis: 'Emphasis',
    disagreement: 'Polite Disagreement',
    agreement: 'Agreement',
    analysis: 'Analysis',
    description: 'Description',
    advice: 'Giving Advice',
    narration: 'Storytelling',
    navigation: 'Directions',
    shopping: 'Shopping',
  }

  return categoryNames[category] || 'Expression'
}

/**
 * Generate floating phrase cards based on user's historical weaknesses using GPT-4o-mini
 */
export async function generateFloatingPhraseCardsFromDb(
  userId: string,
  cefr: string,
  existingPhrases: string[],
  maxCards: number = 2
): Promise<PhraseCardData[]> {
  try {
    console.log('[Phrase Generation AI] Generating personalized suggestions for user:', userId)

    // Call the AI-powered phrase suggestion API
    const response = await fetch('/api/phrase-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        existingPhrases,
        maxCards,
      }),
    })

    if (!response.ok) {
      console.error('[Phrase Generation AI] API error:', response.status)
      return []
    }

    const { suggestions } = await response.json()

    console.log('[Phrase Generation AI] Received suggestions:', suggestions?.length || 0)

    if (!suggestions || suggestions.length === 0) {
      console.log('[Phrase Generation AI] No suggestions returned')
      return []
    }

    // Convert AI suggestions to phrase cards
    const cards: PhraseCardData[] = suggestions.map((suggestion: any, index: number) => ({
      id: `phrase-ai-${index}-${Date.now()}`,
      phrase: suggestion.phrase,
      cefr: suggestion.cefr || cefr,
      exampleSentence: suggestion.exampleSentence,
      category: suggestion.category || 'Expression',
    }))

    console.log('[Phrase Generation AI] Generated cards:', cards.length)
    return cards
  } catch (error) {
    console.error('[Phrase Generation AI] Error:', error)
    return []
  }
}
