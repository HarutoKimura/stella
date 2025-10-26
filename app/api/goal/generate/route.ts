import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * AI-Powered Personalized Goal Generation
 *
 * Takes user's goal description + CEFR level → Generates custom milestones
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, cefr_level, native_language')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const { goalDescription, timeline, currentSkills } = body

    // Build AI prompt for personalized goal generation
    const systemPrompt = `You are an expert English learning curriculum designer. Your job is to create personalized learning goals and milestones for learners.

Given a learner's goal, create a structured learning path with 4-6 achievable milestones.

Each milestone should:
- Be specific and measurable
- Build progressively (easier → harder)
- Include 3-5 key phrases to master
- Include skill targets (WPM, accuracy, fluency) appropriate for their CEFR level
- Have realistic session count requirements

CEFR Level Guidelines:
- A1: WPM 60-80, Accuracy 70-75%, Fluency 60-70%
- A2: WPM 80-100, Accuracy 75-80%, Fluency 70-75%
- B1: WPM 100-120, Accuracy 80-85%, Fluency 75-80%
- B2: WPM 120-140, Accuracy 85-90%, Fluency 80-85%
- C1: WPM 140-160, Accuracy 90-95%, Fluency 85-90%
- C2: WPM 160+, Accuracy 95%+, Fluency 90%+

Return ONLY valid JSON in this exact format:
{
  "title": "Goal title (concise, motivating)",
  "description": "Brief description of what they'll achieve",
  "estimatedWeeks": <number>,
  "icon": "<emoji>",
  "milestones": [
    {
      "title": "Milestone name",
      "description": "What they'll learn",
      "order": 1,
      "requiredPhrases": ["phrase 1", "phrase 2", "phrase 3"],
      "requiredSkills": [
        { "type": "wpm", "target": 100, "description": "Speak at 100 WPM" },
        { "type": "session_count", "target": 3, "description": "Practice 3 sessions" }
      ],
      "rewards": [
        { "type": "badge", "value": "badge_id", "description": "Badge Name" }
      ]
    }
  ]
}`

    const userPrompt = `Create a personalized English learning goal for:

**Learner Profile:**
- CEFR Level: ${userProfile.cefr_level}
- Native Language: ${userProfile.native_language || 'Japanese'}
- Current Skills: ${currentSkills || 'Not specified'}

**Their Goal:**
"${goalDescription}"

**Timeline:** ${timeline || 'Flexible - learner wants to progress steadily'}

**Requirements:**
1. Create 4-6 progressive milestones
2. Start with fundamentals, build to mastery
3. Each milestone should feel achievable (1-2 weeks per milestone)
4. Phrases should be practical and relevant to their goal
5. Adjust difficulty based on ${userProfile.cefr_level} level
6. Make it motivating and specific to THEIR goal

Generate the personalized learning path now.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Slightly creative for personalization
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('No content returned from OpenAI')
    }

    const personalizedGoal = JSON.parse(content)

    // Validate structure
    if (!personalizedGoal.title || !personalizedGoal.milestones || !Array.isArray(personalizedGoal.milestones)) {
      throw new Error('Invalid goal structure from AI')
    }

    // Generate unique goal ID
    const goalId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store in database
    const { data: goalData, error: insertError } = await supabase
      .from('custom_goals')
      .insert({
        id: goalId,
        user_id: userProfile.id,
        title: personalizedGoal.title,
        description: personalizedGoal.description,
        icon: personalizedGoal.icon || '🎯',
        estimated_weeks: personalizedGoal.estimatedWeeks || 6,
        milestones: personalizedGoal.milestones,
        original_description: goalDescription,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to save goal:', insertError)
      throw new Error('Failed to save custom goal')
    }

    // Update user's selected goal
    await supabase
      .from('users')
      .update({ goal_id: goalId })
      .eq('id', userProfile.id)

    return NextResponse.json({
      goalId,
      goal: personalizedGoal,
      message: 'Your personalized learning path has been created!',
    })

  } catch (error) {
    console.error('Goal generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate personalized goal' },
      { status: 500 }
    )
  }
}
