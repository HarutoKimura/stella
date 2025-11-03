/**
 * Fixed Phrase Library
 * Organized by CEFR level (A1-C2)
 * Practical, everyday conversation phrases
 */

export type PhraseItem = {
  phrase: string
  cefr: string
  category: string
}

export const PHRASE_LIBRARY: PhraseItem[] = [
  // A1 - Beginner
  { phrase: "Hello, how are you?", cefr: "A1", category: "greeting" },
  { phrase: "Nice to meet you", cefr: "A1", category: "greeting" },
  { phrase: "What's your name?", cefr: "A1", category: "introduction" },
  { phrase: "Where are you from?", cefr: "A1", category: "introduction" },
  { phrase: "Thank you very much", cefr: "A1", category: "courtesy" },
  { phrase: "Excuse me", cefr: "A1", category: "courtesy" },
  { phrase: "Can you help me?", cefr: "A1", category: "request" },
  { phrase: "I don't understand", cefr: "A1", category: "learning" },
  { phrase: "How much is this?", cefr: "A1", category: "shopping" },
  { phrase: "Where is the bathroom?", cefr: "A1", category: "navigation" },

  // A2 - Elementary
  { phrase: "I'd like to...", cefr: "A2", category: "request" },
  { phrase: "Could you repeat that?", cefr: "A2", category: "learning" },
  { phrase: "What time is it?", cefr: "A2", category: "daily" },
  { phrase: "I'm looking for...", cefr: "A2", category: "shopping" },
  { phrase: "How do I get to...?", cefr: "A2", category: "navigation" },
  { phrase: "Can I have the bill, please?", cefr: "A2", category: "restaurant" },
  { phrase: "What do you recommend?", cefr: "A2", category: "restaurant" },
  { phrase: "I need some help with...", cefr: "A2", category: "request" },
  { phrase: "That sounds good", cefr: "A2", category: "agreement" },
  { phrase: "I'm not sure about that", cefr: "A2", category: "uncertainty" },

  // B1 - Intermediate
  { phrase: "I was wondering if...", cefr: "B1", category: "request" },
  { phrase: "Would you mind if I...?", cefr: "B1", category: "courtesy" },
  { phrase: "I'm afraid I can't...", cefr: "B1", category: "refusal" },
  { phrase: "That's a good point", cefr: "B1", category: "discussion" },
  { phrase: "What I mean is...", cefr: "B1", category: "clarification" },
  { phrase: "As far as I know...", cefr: "B1", category: "opinion" },
  { phrase: "It depends on...", cefr: "B1", category: "consideration" },
  { phrase: "I'd rather...", cefr: "B1", category: "preference" },
  { phrase: "Let me think about it", cefr: "B1", category: "decision" },
  { phrase: "Could you give me some advice?", cefr: "B1", category: "request" },

  // B2 - Upper Intermediate
  { phrase: "From my perspective...", cefr: "B2", category: "opinion" },
  { phrase: "I couldn't agree more", cefr: "B2", category: "agreement" },
  { phrase: "On the other hand...", cefr: "B2", category: "contrast" },
  { phrase: "It's worth considering that...", cefr: "B2", category: "discussion" },
  { phrase: "What concerns me is...", cefr: "B2", category: "concern" },
  { phrase: "I tend to think that...", cefr: "B2", category: "opinion" },
  { phrase: "That's beside the point", cefr: "B2", category: "discussion" },
  { phrase: "To be honest with you...", cefr: "B2", category: "honesty" },
  { phrase: "I'm inclined to believe...", cefr: "B2", category: "opinion" },
  { phrase: "There's no denying that...", cefr: "B2", category: "agreement" },

  // C1 - Advanced
  { phrase: "It goes without saying that...", cefr: "C1", category: "emphasis" },
  { phrase: "That's not necessarily the case", cefr: "C1", category: "disagreement" },
  { phrase: "I beg to differ", cefr: "C1", category: "disagreement" },
  { phrase: "All things considered...", cefr: "C1", category: "conclusion" },
  { phrase: "By and large...", cefr: "C1", category: "generalization" },
  { phrase: "In light of recent events...", cefr: "C1", category: "context" },
  { phrase: "That's a fair assessment", cefr: "C1", category: "agreement" },
  { phrase: "I'd be remiss if I didn't mention...", cefr: "C1", category: "addition" },
  { phrase: "That's a contentious issue", cefr: "C1", category: "discussion" },
  { phrase: "For what it's worth...", cefr: "C1", category: "opinion" },

  // C2 - Proficient
  { phrase: "That's a nuanced perspective", cefr: "C2", category: "discussion" },
  { phrase: "I'm rather skeptical about...", cefr: "C2", category: "doubt" },
  { phrase: "That epitomizes the problem", cefr: "C2", category: "analysis" },
  { phrase: "It's somewhat paradoxical that...", cefr: "C2", category: "complexity" },
  { phrase: "That's inherently problematic", cefr: "C2", category: "criticism" },
  { phrase: "To put it succinctly...", cefr: "C2", category: "summary" },
  { phrase: "That's a gross oversimplification", cefr: "C2", category: "disagreement" },
  { phrase: "I'm ambivalent about that", cefr: "C2", category: "uncertainty" },
  { phrase: "That's tantamount to saying...", cefr: "C2", category: "comparison" },
  { phrase: "I'm predisposed to think...", cefr: "C2", category: "tendency" },
]

/**
 * Get phrases for a specific CEFR level
 */
export function getPhrasesByLevel(cefr: string, count: number = 3): PhraseItem[] {
  const levelPhrases = PHRASE_LIBRARY.filter((p) => p.cefr === cefr)

  // Shuffle and return random phrases
  const shuffled = [...levelPhrases].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Get mixed phrases around a CEFR level (current + slightly above)
 */
export function getMixedPhrases(cefr: string, count: number = 3): PhraseItem[] {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const currentIndex = levels.indexOf(cefr)

  // Get phrases from current level and one above
  const targetLevels = [cefr]
  if (currentIndex < levels.length - 1) {
    targetLevels.push(levels[currentIndex + 1])
  }

  const mixedPhrases = PHRASE_LIBRARY.filter((p) => targetLevels.includes(p.cefr))
  const shuffled = [...mixedPhrases].sort(() => Math.random() - 0.5)

  return shuffled.slice(0, count)
}
