/**
 * Goal-Based Progression System
 *
 * This system breaks down big goals into achievable milestones
 * to maintain user motivation and track meaningful progress.
 */

export type GoalCategory = 'work' | 'travel' | 'exam' | 'social' | 'academic'

export type BigGoal = {
  id: string
  category: GoalCategory
  title: string
  description: string
  icon: string
  estimatedWeeks: number
  milestones: Milestone[]
}

export type Milestone = {
  id: string
  title: string
  description: string
  order: number
  requiredPhrases: string[]
  requiredSkills?: SkillCheck[]
  rewards: Reward[]
}

export type SkillCheck = {
  type: 'wpm' | 'accuracy' | 'fluency' | 'session_count'
  target: number
  description: string
}

export type Reward = {
  type: 'badge' | 'unlock' | 'boost'
  value: string
  description: string
}

export type UserGoalProgress = {
  bigGoalId: string
  currentMilestoneIndex: number
  completedMilestones: string[]
  phrasesLearned: string[]
  skillsAchieved: Record<string, number>
  progressPercentage: number
  startedAt: string
  estimatedCompletionDate?: string
}

/**
 * Predefined Big Goals with Milestone Breakdown
 */
export const BIG_GOALS: BigGoal[] = [
  {
    id: 'job_interview',
    category: 'work',
    title: 'Ace Your Job Interview',
    description: 'Master professional English for confident interviews',
    icon: '💼',
    estimatedWeeks: 6,
    milestones: [
      {
        id: 'professional_intro',
        title: 'Professional Introduction',
        description: 'Introduce yourself confidently',
        order: 1,
        requiredPhrases: [
          'I have experience in',
          'I specialize in',
          'My background is in',
        ],
        requiredSkills: [
          { type: 'session_count', target: 3, description: 'Practice 3 sessions' },
        ],
        rewards: [
          { type: 'badge', value: 'first_impression', description: 'First Impression Master' },
        ],
      },
      {
        id: 'talk_experience',
        title: 'Describe Your Experience',
        description: 'Talk about past roles and achievements',
        order: 2,
        requiredPhrases: [
          'I was responsible for',
          'I worked closely with',
          'I successfully completed',
          'I led a team that',
        ],
        requiredSkills: [
          { type: 'wpm', target: 120, description: 'Speak at 120 WPM' },
        ],
        rewards: [
          { type: 'badge', value: 'experience_storyteller', description: 'Experience Storyteller' },
        ],
      },
      {
        id: 'answer_questions',
        title: 'Answer Common Questions',
        description: 'Respond to behavioral and technical questions',
        order: 3,
        requiredPhrases: [
          'For example',
          'In that situation',
          'What I learned was',
          'The challenge was',
        ],
        requiredSkills: [
          { type: 'accuracy', target: 90, description: '90% grammar accuracy' },
          { type: 'session_count', target: 5, description: 'Practice 5 sessions' },
        ],
        rewards: [
          { type: 'badge', value: 'question_master', description: 'Question Master' },
          { type: 'unlock', value: 'mock_interview', description: 'Unlock Mock Interview Mode' },
        ],
      },
      {
        id: 'ask_questions',
        title: 'Ask Smart Questions',
        description: 'Show interest and engagement',
        order: 4,
        requiredPhrases: [
          'Could you tell me more about',
          'What does success look like',
          'How would you describe',
          'What are the main challenges',
        ],
        rewards: [
          { type: 'badge', value: 'curious_mind', description: 'Curious Mind' },
        ],
      },
      {
        id: 'interview_ready',
        title: 'Interview Ready!',
        description: 'Full mock interview simulation',
        order: 5,
        requiredPhrases: [],
        requiredSkills: [
          { type: 'wpm', target: 130, description: 'Speak at 130 WPM' },
          { type: 'fluency', target: 85, description: '85% fluency score' },
        ],
        rewards: [
          { type: 'badge', value: 'interview_champion', description: '🏆 Interview Champion' },
          { type: 'boost', value: 'confidence_100', description: 'Interview Confidence: 100%' },
        ],
      },
    ],
  },
  {
    id: 'travel_adventure',
    category: 'travel',
    title: 'Travel with Confidence',
    description: 'Navigate airports, hotels, and restaurants like a pro',
    icon: '✈️',
    estimatedWeeks: 4,
    milestones: [
      {
        id: 'airport_basics',
        title: 'Airport Navigation',
        description: 'Check-in, security, and boarding',
        order: 1,
        requiredPhrases: [
          'Where is the gate for',
          'I need to check in',
          'Is this seat taken',
        ],
        rewards: [
          { type: 'badge', value: 'frequent_flyer', description: 'Frequent Flyer' },
        ],
      },
      {
        id: 'hotel_checkin',
        title: 'Hotel Check-in',
        description: 'Book and communicate at hotels',
        order: 2,
        requiredPhrases: [
          'I have a reservation under',
          'Could I have a wake-up call',
          'Is breakfast included',
        ],
        rewards: [
          { type: 'badge', value: 'hotel_pro', description: 'Hotel Pro' },
        ],
      },
      {
        id: 'restaurant_ordering',
        title: 'Restaurant Dining',
        description: 'Order food and communicate preferences',
        order: 3,
        requiredPhrases: [
          'Could I see the menu',
          'I would like to order',
          'Could we have the bill',
          'Is this gluten-free',
        ],
        rewards: [
          { type: 'badge', value: 'foodie', description: 'Foodie Explorer' },
        ],
      },
      {
        id: 'asking_directions',
        title: 'Getting Around',
        description: 'Ask for and understand directions',
        order: 4,
        requiredPhrases: [
          'How do I get to',
          'Is it within walking distance',
          'Could you point me toward',
        ],
        rewards: [
          { type: 'badge', value: 'navigator', description: 'City Navigator' },
          { type: 'unlock', value: 'travel_scenarios', description: 'Unlock Travel Scenarios' },
        ],
      },
    ],
  },
  {
    id: 'business_meetings',
    category: 'work',
    title: 'Lead Business Meetings',
    description: 'Facilitate and participate in professional meetings',
    icon: '📊',
    estimatedWeeks: 8,
    milestones: [
      {
        id: 'email_communication',
        title: 'Email Mastery',
        description: 'Write professional emails',
        order: 1,
        requiredPhrases: [
          'I am writing to',
          'Please find attached',
          'Looking forward to hearing from you',
          'Thank you for your time',
        ],
        rewards: [
          { type: 'badge', value: 'email_pro', description: 'Email Professional' },
        ],
      },
      {
        id: 'meeting_participation',
        title: 'Active Meeting Participation',
        description: 'Contribute meaningfully in meetings',
        order: 2,
        requiredPhrases: [
          'I would like to add',
          'Building on that point',
          'From my perspective',
          'Could we discuss',
        ],
        rewards: [
          { type: 'badge', value: 'meeting_contributor', description: 'Meeting Contributor' },
        ],
      },
      {
        id: 'present_ideas',
        title: 'Present Your Ideas',
        description: 'Deliver clear presentations',
        order: 3,
        requiredPhrases: [
          'Today I will be presenting',
          'The key takeaway is',
          'Let me walk you through',
          'In conclusion',
        ],
        requiredSkills: [
          { type: 'wpm', target: 140, description: 'Speak at 140 WPM' },
        ],
        rewards: [
          { type: 'badge', value: 'presenter', description: 'Confident Presenter' },
        ],
      },
      {
        id: 'lead_meetings',
        title: 'Lead Meetings',
        description: 'Facilitate and manage discussions',
        order: 4,
        requiredPhrases: [
          'Let us move on to',
          'Could we table this for now',
          'To summarize our discussion',
          'What are the next steps',
        ],
        rewards: [
          { type: 'badge', value: 'meeting_leader', description: '🏆 Meeting Leader' },
          { type: 'boost', value: 'leadership_unlocked', description: 'Leadership Communication Unlocked' },
        ],
      },
    ],
  },
  {
    id: 'ielts_speaking',
    category: 'exam',
    title: 'IELTS Speaking Band 7+',
    description: 'Achieve high scores in IELTS Speaking test',
    icon: '📚',
    estimatedWeeks: 10,
    milestones: [
      {
        id: 'part1_basics',
        title: 'Part 1: Introduction',
        description: 'Answer personal questions fluently',
        order: 1,
        requiredPhrases: [
          'I come from',
          'In my free time',
          'I have been studying',
        ],
        requiredSkills: [
          { type: 'wpm', target: 130, description: 'Speak at 130 WPM' },
        ],
        rewards: [
          { type: 'badge', value: 'ielts_starter', description: 'IELTS Starter' },
        ],
      },
      {
        id: 'part2_long_turn',
        title: 'Part 2: Long Turn',
        description: 'Speak for 2 minutes on a topic',
        order: 2,
        requiredPhrases: [
          'I would like to talk about',
          'This reminds me of',
          'The reason why',
          'Looking back on',
        ],
        requiredSkills: [
          { type: 'fluency', target: 80, description: '80% fluency' },
          { type: 'session_count', target: 10, description: '10 practice sessions' },
        ],
        rewards: [
          { type: 'badge', value: 'long_speaker', description: 'Long-form Speaker' },
        ],
      },
      {
        id: 'part3_discussion',
        title: 'Part 3: Discussion',
        description: 'Analyze and discuss complex topics',
        order: 3,
        requiredPhrases: [
          'In my opinion',
          'On the other hand',
          'It depends on',
          'Research suggests that',
        ],
        requiredSkills: [
          { type: 'accuracy', target: 92, description: '92% grammar accuracy' },
        ],
        rewards: [
          { type: 'badge', value: 'critical_thinker', description: 'Critical Thinker' },
        ],
      },
      {
        id: 'exam_ready',
        title: 'Band 7+ Ready',
        description: 'Full exam simulation',
        order: 4,
        requiredPhrases: [],
        requiredSkills: [
          { type: 'wpm', target: 150, description: 'Speak at 150 WPM' },
          { type: 'fluency', target: 90, description: '90% fluency' },
          { type: 'accuracy', target: 95, description: '95% accuracy' },
        ],
        rewards: [
          { type: 'badge', value: 'ielts_champion', description: '🏆 IELTS Champion' },
          { type: 'boost', value: 'band7_ready', description: 'Band 7+ Ready!' },
        ],
      },
    ],
  },
  {
    id: 'casual_conversation',
    category: 'social',
    title: 'Casual Conversation Master',
    description: 'Chat naturally about everyday topics',
    icon: '💬',
    estimatedWeeks: 6,
    milestones: [
      {
        id: 'small_talk',
        title: 'Small Talk',
        description: 'Start and maintain casual conversations',
        order: 1,
        requiredPhrases: [
          'How is it going',
          'What have you been up to',
          'That sounds interesting',
        ],
        rewards: [
          { type: 'badge', value: 'social_butterfly', description: 'Social Butterfly' },
        ],
      },
      {
        id: 'share_opinions',
        title: 'Share Opinions',
        description: 'Express your thoughts naturally',
        order: 2,
        requiredPhrases: [
          'I think that',
          'I am not sure about',
          'That makes sense',
          'I agree with you',
        ],
        rewards: [
          { type: 'badge', value: 'opinion_sharer', description: 'Opinion Sharer' },
        ],
      },
      {
        id: 'tell_stories',
        title: 'Tell Stories',
        description: 'Share experiences engagingly',
        order: 3,
        requiredPhrases: [
          'The other day',
          'You would not believe',
          'Long story short',
          'Anyway',
        ],
        rewards: [
          { type: 'badge', value: 'storyteller', description: 'Natural Storyteller' },
          { type: 'unlock', value: 'casual_mode', description: 'Unlock Casual Mode' },
        ],
      },
    ],
  },
]

/**
 * Calculate user's progress toward their big goal
 */
export function calculateGoalProgress(
  bigGoalId: string,
  masteredPhrases: string[],
  userStats: {
    wpm?: number
    accuracy?: number
    fluency?: number
    sessionCount: number
  }
): UserGoalProgress {
  const bigGoal = BIG_GOALS.find((g) => g.id === bigGoalId)
  if (!bigGoal) {
    throw new Error(`Goal ${bigGoalId} not found`)
  }

  const completedMilestones: string[] = []
  let currentMilestoneIndex = 0

  // Check each milestone for completion
  bigGoal.milestones.forEach((milestone, index) => {
    let isComplete = true

    // Check if required phrases are mastered
    const phrasesMet = milestone.requiredPhrases.every((phrase) =>
      masteredPhrases.includes(phrase)
    )
    if (!phrasesMet) {
      isComplete = false
    }

    // Check if skill requirements are met
    if (milestone.requiredSkills) {
      milestone.requiredSkills.forEach((skill) => {
        const actualValue = userStats[skill.type] || 0
        if (actualValue < skill.target) {
          isComplete = false
        }
      })
    }

    if (isComplete) {
      completedMilestones.push(milestone.id)
      currentMilestoneIndex = Math.max(currentMilestoneIndex, index + 1)
    }
  })

  const progressPercentage = Math.round(
    (completedMilestones.length / bigGoal.milestones.length) * 100
  )

  return {
    bigGoalId,
    currentMilestoneIndex,
    completedMilestones,
    phrasesLearned: masteredPhrases,
    skillsAchieved: {
      wpm: userStats.wpm || 0,
      accuracy: userStats.accuracy || 0,
      fluency: userStats.fluency || 0,
      session_count: userStats.sessionCount,
    },
    progressPercentage,
    startedAt: new Date().toISOString(),
    estimatedCompletionDate: calculateEstimatedCompletion(
      bigGoal.estimatedWeeks,
      progressPercentage
    ),
  }
}

function calculateEstimatedCompletion(
  estimatedWeeks: number,
  progressPercentage: number
): string {
  if (progressPercentage === 0) {
    const date = new Date()
    date.setDate(date.getDate() + estimatedWeeks * 7)
    return date.toISOString()
  }

  // Adjust based on current progress
  const weeksRemaining = Math.ceil(
    (estimatedWeeks * (100 - progressPercentage)) / 100
  )
  const date = new Date()
  date.setDate(date.getDate() + weeksRemaining * 7)
  return date.toISOString()
}

/**
 * Get next actionable step for the user
 */
export function getNextStep(
  bigGoalId: string,
  progress: UserGoalProgress
): {
  milestone: Milestone
  nextAction: string
  progress: string
} | null {
  const bigGoal = BIG_GOALS.find((g) => g.id === bigGoalId)
  if (!bigGoal) return null

  const currentMilestone = bigGoal.milestones[progress.currentMilestoneIndex]
  if (!currentMilestone) return null

  // Find which requirement is not met
  const unmetPhrase = currentMilestone.requiredPhrases.find(
    (phrase) => !progress.phrasesLearned.includes(phrase)
  )

  if (unmetPhrase) {
    return {
      milestone: currentMilestone,
      nextAction: `Practice using "${unmetPhrase}" in conversation`,
      progress: `${currentMilestone.requiredPhrases.filter((p) =>
        progress.phrasesLearned.includes(p)
      ).length}/${currentMilestone.requiredPhrases.length} phrases`,
    }
  }

  // Check skill requirements
  if (currentMilestone.requiredSkills) {
    const unmetSkill = currentMilestone.requiredSkills.find(
      (skill) => (progress.skillsAchieved[skill.type] || 0) < skill.target
    )

    if (unmetSkill) {
      return {
        milestone: currentMilestone,
        nextAction: unmetSkill.description,
        progress: `${progress.skillsAchieved[unmetSkill.type] || 0}/${unmetSkill.target}`,
      }
    }
  }

  return null
}
