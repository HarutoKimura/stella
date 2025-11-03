import { Correction } from './sessionStore'

/**
 * Parse corrections from tutor's text response
 *
 * Looks for common correction patterns:
 * 1. Explicit: "Wrong: ... Correct: ..." or "❌ ... ✅ ..."
 * 2. Direct corrections: "You said '...' but it should be '...'"
 * 3. Structured feedback: Multiple correction patterns in one message
 */
export function parseCorrections(tutorText: string, userText?: string): Correction[] {
  const corrections: Correction[] = []

  // Pattern 1: "You said '...' but it should be '...'" or similar
  const pattern1 = /(?:you said|you meant to say)\s+['""]([^'"""]+)['""].*?(?:should be|correct is|try|say)\s+['""]([^'"""]+)['"]/gi
  let match1
  while ((match1 = pattern1.exec(tutorText)) !== null) {
    corrections.push({
      type: 'grammar', // Default to grammar
      example: match1[1].trim(),
      correction: match1[2].trim(),
    })
  }

  // Pattern 2: "❌ Wrong: ... ✅ Correct: ..." or "Wrong: ... Correct: ..."
  const pattern2 = /(?:❌|wrong|incorrect)[\s:]+['""]?([^'""\n]+)['""]?.*?(?:✅|correct|right|use)[\s:]+['""]?([^'""\n]+)['""]?/gi
  let match2
  while ((match2 = pattern2.exec(tutorText)) !== null) {
    corrections.push({
      type: 'grammar',
      example: match2[1].trim(),
      correction: match2[2].trim(),
    })
  }

  // Pattern 3: "Let me stop you there" followed by explanation
  const pattern3 = /let me stop you there[.,]?\s+(?:you said\s+)?['""]?([^'""\n]+?)['""]?\s+(?:but\s+)?(?:it\s+)?should be\s+['""]?([^'""\n]+?)['""]?[.,]/i
  const match3 = pattern3.exec(tutorText)
  if (match3) {
    corrections.push({
      type: 'grammar',
      example: match3[1].trim(),
      correction: match3[2].trim(),
    })
  }

  // Pattern 4: Pronunciation corrections - "say it like: ..."
  const pattern4 = /(?:pronounce|say it like|it sounds like)\s+['""]?([^'""\n]+?)['""]?/gi
  let match4
  while ((match4 = pattern4.exec(tutorText)) !== null) {
    if (userText) {
      corrections.push({
        type: 'pron',
        example: userText.trim(),
        correction: match4[1].trim(),
      })
    }
  }

  // Pattern 5: Vocabulary corrections - "Instead of X, use Y"
  const pattern5 = /instead of\s+['""]?([^'""\n]+?)['""]?,?\s+(?:use|say|try)\s+['""]?([^'""\n]+?)['""]?/gi
  let match5
  while ((match5 = pattern5.exec(tutorText)) !== null) {
    corrections.push({
      type: 'vocab',
      example: match5[1].trim(),
      correction: match5[2].trim(),
    })
  }

  // Pattern 6: "Not X, but Y" pattern
  const pattern6 = /not\s+['""]?([^'""\n]+?)['""]?,?\s+(?:but|rather)\s+['""]?([^'""\n]+?)['""]?[.,]/gi
  let match6
  while ((match6 = pattern6.exec(tutorText)) !== null) {
    corrections.push({
      type: 'grammar',
      example: match6[1].trim(),
      correction: match6[2].trim(),
    })
  }

  return corrections
}

/**
 * Determine if the tutor's message contains a correction
 */
export function containsCorrection(tutorText: string): boolean {
  const correctionKeywords = [
    'let me stop you',
    'wrong',
    'incorrect',
    'should be',
    'correct is',
    'instead of',
    'not ',
    '❌',
    '✅',
    'try again',
    'you meant',
  ]

  const lowerText = tutorText.toLowerCase()
  return correctionKeywords.some((keyword) => lowerText.includes(keyword))
}
