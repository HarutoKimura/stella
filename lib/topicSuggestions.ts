import { TopicSuggestion } from '@/components/TopicSuggestionCard'
import { TopicCardData } from '@/components/FloatingTopicCard'
import { TranscriptTurn } from './sessionStore'

/**
 * Detects if user is struggling in conversation based on transcript patterns
 */
export function detectConversationStruggle(transcript: TranscriptTurn[]): boolean {
  if (transcript.length < 4) return false

  const recentTurns = transcript.slice(-6) // Last 6 turns
  const userTurns = recentTurns.filter((t) => t.role === 'user')

  if (userTurns.length < 2) return false

  // Check for short responses (indicating struggle)
  const shortResponseCount = userTurns.filter((turn) => {
    const wordCount = turn.text.trim().split(/\s+/).length
    return wordCount < 5
  }).length

  // Check for repeated filler words
  const fillerWords = ['um', 'uh', 'hmm', 'well', 'like', 'you know']
  const fillerCount = userTurns.reduce((count, turn) => {
    const text = turn.text.toLowerCase()
    return count + fillerWords.filter((filler) => text.includes(filler)).length
  }, 0)

  // Check for silence patterns (very short or generic responses)
  const genericResponses = ['yes', 'no', 'okay', 'ok', 'i see', 'sure', 'i dont know']
  const genericCount = userTurns.filter((turn) => {
    const text = turn.text.toLowerCase().trim()
    return genericResponses.some((generic) => text === generic || text === generic + '.')
  }).length

  // Trigger if user shows signs of struggle
  return shortResponseCount >= 2 || fillerCount >= 3 || genericCount >= 2
}

/**
 * Generates topic suggestions based on user's CEFR level
 */
export function generateTopicSuggestions(cefr: string): TopicSuggestion[] {
  const topicsByLevel: Record<string, TopicSuggestion[]> = {
    A1: [
      {
        title: 'Daily Routine',
        description: 'Talk about what you do every day - morning routine, meals, bedtime',
        icon: '🌅',
        cefr: 'A1',
      },
      {
        title: 'Family & Friends',
        description: 'Describe your family members and close friends',
        icon: '👨‍👩‍👧‍👦',
        cefr: 'A1',
      },
      {
        title: 'Favorite Foods',
        description: 'Share what foods you like and dislike',
        icon: '🍱',
        cefr: 'A1',
      },
      {
        title: 'Weather Today',
        description: "Discuss today's weather and your favorite season",
        icon: '🌤️',
        cefr: 'A1',
      },
    ],
    A2: [
      {
        title: 'Weekend Plans',
        description: 'Talk about your plans for the upcoming weekend',
        icon: '🎯',
        cefr: 'A2',
      },
      {
        title: 'Hobbies & Interests',
        description: 'Share your hobbies and what you enjoy doing in free time',
        icon: '🎨',
        cefr: 'A2',
      },
      {
        title: 'Last Vacation',
        description: 'Describe a recent trip or vacation you took',
        icon: '✈️',
        cefr: 'A2',
      },
      {
        title: 'Shopping Experience',
        description: 'Talk about your last shopping trip or favorite store',
        icon: '🛍️',
        cefr: 'A2',
      },
    ],
    B1: [
      {
        title: 'Career Goals',
        description: 'Discuss your career aspirations and professional interests',
        icon: '💼',
        cefr: 'B1',
      },
      {
        title: 'Technology Impact',
        description: 'Share your thoughts on how technology affects daily life',
        icon: '📱',
        cefr: 'B1',
      },
      {
        title: 'Cultural Differences',
        description: 'Compare cultural practices between different countries',
        icon: '🌍',
        cefr: 'B1',
      },
      {
        title: 'Personal Challenge',
        description: 'Describe a challenge you overcame and what you learned',
        icon: '🎖️',
        cefr: 'B1',
      },
    ],
    B2: [
      {
        title: 'Social Issues',
        description: 'Discuss a social issue you care about and potential solutions',
        icon: '⚖️',
        cefr: 'B2',
      },
      {
        title: 'Work-Life Balance',
        description: 'Share your perspective on maintaining healthy work-life balance',
        icon: '⚖️',
        cefr: 'B2',
      },
      {
        title: 'Education System',
        description: 'Analyze strengths and weaknesses of education systems',
        icon: '🎓',
        cefr: 'B2',
      },
      {
        title: 'Environmental Concerns',
        description: 'Discuss environmental issues and sustainable living practices',
        icon: '♻️',
        cefr: 'B2',
      },
    ],
    C1: [
      {
        title: 'Ethical Dilemmas',
        description: 'Explore complex ethical questions in modern society',
        icon: '🤔',
        cefr: 'C1',
      },
      {
        title: 'Global Economics',
        description: 'Analyze economic trends and their societal implications',
        icon: '📊',
        cefr: 'C1',
      },
      {
        title: 'Innovation & Future',
        description: 'Debate the role of innovation in shaping future society',
        icon: '🚀',
        cefr: 'C1',
      },
      {
        title: 'Political Philosophy',
        description: 'Discuss different political ideologies and governance systems',
        icon: '🏛️',
        cefr: 'C1',
      },
    ],
    C2: [
      {
        title: 'Philosophical Concepts',
        description: 'Engage with abstract philosophical ideas and theories',
        icon: '🧠',
        cefr: 'C2',
      },
      {
        title: 'Literary Analysis',
        description: 'Critically analyze literary works and artistic movements',
        icon: '📚',
        cefr: 'C2',
      },
      {
        title: 'Scientific Breakthroughs',
        description: 'Examine recent scientific discoveries and their implications',
        icon: '🔬',
        cefr: 'C2',
      },
      {
        title: 'Cultural Criticism',
        description: 'Provide nuanced critique of contemporary cultural phenomena',
        icon: '🎭',
        cefr: 'C2',
      },
    ],
  }

  // Return topics for the specified level, or B1 as default
  return topicsByLevel[cefr] || topicsByLevel['B1']
}

/**
 * Creates a prompt for the AI tutor based on selected topic
 */
export function createTopicPrompt(topic: TopicSuggestion): string {
  return `Let's discuss: ${topic.title}. ${topic.description}`
}

/**
 * Generates floating topic cards with example sentences based on CEFR level
 * Returns 2-3 cards at a time to avoid overwhelming the user
 */
export function generateFloatingTopicCards(cefr: string): TopicCardData[] {
  const cardsByLevel: Record<string, TopicCardData[]> = {
    A1: [
      {
        id: 'a1-daily-routine',
        topic: 'Daily Routine',
        exampleSentence: 'I usually wake up at 7 AM and have breakfast with my family',
        icon: '🌅',
        cefr: 'A1',
      },
      {
        id: 'a1-favorite-food',
        topic: 'Favorite Food',
        exampleSentence: 'My favorite food is sushi because it tastes fresh and delicious',
        icon: '🍱',
        cefr: 'A1',
      },
      {
        id: 'a1-weather',
        topic: 'Weather',
        exampleSentence: 'Today is sunny and warm. I like this kind of weather',
        icon: '🌤️',
        cefr: 'A1',
      },
    ],
    A2: [
      {
        id: 'a2-weekend',
        topic: 'Weekend Plans',
        exampleSentence: 'This weekend, I plan to visit a museum with my friends',
        icon: '🎯',
        cefr: 'A2',
      },
      {
        id: 'a2-hobbies',
        topic: 'Your Hobbies',
        exampleSentence: 'In my free time, I enjoy reading mystery novels and playing guitar',
        icon: '🎨',
        cefr: 'A2',
      },
      {
        id: 'a2-vacation',
        topic: 'Last Vacation',
        exampleSentence: 'Last summer, I traveled to Kyoto and visited many beautiful temples',
        icon: '✈️',
        cefr: 'A2',
      },
    ],
    B1: [
      {
        id: 'b1-career',
        topic: 'Career Goals',
        exampleSentence: 'I hope to become a software engineer and work on innovative projects',
        icon: '💼',
        cefr: 'B1',
      },
      {
        id: 'b1-technology',
        topic: 'Technology Impact',
        exampleSentence: 'Smartphones have changed how we communicate and access information',
        icon: '📱',
        cefr: 'B1',
      },
      {
        id: 'b1-culture',
        topic: 'Cultural Differences',
        exampleSentence: 'In Japan, we bow when greeting, while in America, people shake hands',
        icon: '🌍',
        cefr: 'B1',
      },
    ],
    B2: [
      {
        id: 'b2-social',
        topic: 'Social Issues',
        exampleSentence: 'I believe education inequality is a serious problem that needs addressing',
        icon: '⚖️',
        cefr: 'B2',
      },
      {
        id: 'b2-balance',
        topic: 'Work-Life Balance',
        exampleSentence: 'Companies should encourage flexible hours to help employees manage stress',
        icon: '⚖️',
        cefr: 'B2',
      },
      {
        id: 'b2-environment',
        topic: 'Environment',
        exampleSentence: 'We need to reduce plastic consumption and invest in renewable energy',
        icon: '♻️',
        cefr: 'B2',
      },
    ],
    C1: [
      {
        id: 'c1-ethics',
        topic: 'Ethical Dilemmas',
        exampleSentence: 'AI development raises complex questions about privacy and autonomy',
        icon: '🤔',
        cefr: 'C1',
      },
      {
        id: 'c1-economics',
        topic: 'Global Economics',
        exampleSentence: 'Economic globalization has both benefits and drawbacks for developing nations',
        icon: '📊',
        cefr: 'C1',
      },
      {
        id: 'c1-innovation',
        topic: 'Innovation',
        exampleSentence: 'Technological disruption is reshaping traditional industries at an unprecedented pace',
        icon: '🚀',
        cefr: 'C1',
      },
    ],
    C2: [
      {
        id: 'c2-philosophy',
        topic: 'Philosophy',
        exampleSentence: 'Existentialist thought challenges our assumptions about meaning and purpose',
        icon: '🧠',
        cefr: 'C2',
      },
      {
        id: 'c2-literature',
        topic: 'Literature',
        exampleSentence: 'Postmodern literature often deconstructs narrative conventions and reader expectations',
        icon: '📚',
        cefr: 'C2',
      },
      {
        id: 'c2-science',
        topic: 'Science',
        exampleSentence: 'Quantum computing could revolutionize cryptography and computational modeling',
        icon: '🔬',
        cefr: 'C2',
      },
    ],
  }

  const allCards = cardsByLevel[cefr] || cardsByLevel['B1']

  // Randomly select 2-3 cards to show
  const shuffled = [...allCards].sort(() => Math.random() - 0.5)
  const numCards = Math.floor(Math.random() * 2) + 2 // 2 or 3 cards

  return shuffled.slice(0, numCards)
}
