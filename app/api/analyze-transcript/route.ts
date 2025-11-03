import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const AnalyzeTranscriptInputSchema = z.object({
  transcript: z.array(z.object({
    role: z.enum(['user', 'tutor']),
    text: z.string(),
  })),
  userCefrLevel: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = AnalyzeTranscriptInputSchema.parse(body)

    // Extract only user utterances
    const userUtterances = input.transcript
      .filter(t => t.role === 'user')
      .map(t => t.text)

    if (userUtterances.length === 0) {
      return NextResponse.json({
        grammar_errors: [],
        vocabulary_issues: [],
        complexity_analysis: {
          avg_sentence_length: 0,
          uses_complex_structures: false,
          sentence_variety: 'none',
        }
      })
    }

    const fullUserText = userUtterances.join('\n')

    const systemPrompt = `You are an expert English language assessor. Analyze the following transcript from a ${input.userCefrLevel} level English learner.

Identify ALL grammar errors, vocabulary issues, and assess grammatical complexity.

IMPORTANT RULES:
- Be thorough - catch ALL errors, even minor ones
- For grammar: include subject-verb agreement, tense errors, article usage, word order, etc.
- For vocabulary: identify inappropriate word choices, repetitive language, missing sophistication
- For complexity: assess sentence structure variety, clause usage, connector usage

Return JSON in this exact format:
{
  "grammar_errors": [
    {
      "text": "exact error from transcript",
      "correction": "corrected version",
      "error_type": "subject-verb agreement|tense|article|preposition|word-order|other",
      "severity": "major|minor"
    }
  ],
  "vocabulary_issues": [
    {
      "text": "exact phrase from transcript",
      "suggestion": "better alternative",
      "reason": "why this is better",
      "issue_type": "repetition|inappropriate|too-simple|missing-word"
    }
  ],
  "complexity_analysis": {
    "avg_sentence_length": number (words per sentence),
    "uses_complex_structures": boolean (subordinate clauses, relative clauses, etc.),
    "sentence_variety": "low|medium|high",
    "notes": "brief assessment of grammatical sophistication"
  }
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze this transcript:\n\n${fullUserText}`
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent analysis
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('No content returned from OpenAI')
    }

    const analysis = JSON.parse(content)

    // Ensure arrays exist
    analysis.grammar_errors = Array.isArray(analysis.grammar_errors) ? analysis.grammar_errors : []
    analysis.vocabulary_issues = Array.isArray(analysis.vocabulary_issues) ? analysis.vocabulary_issues : []

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Analyze transcript API error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze transcript' },
      { status: 500 }
    )
  }
}
