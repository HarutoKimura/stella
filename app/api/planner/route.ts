import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { MicroPackSchema, PlannerInputSchema } from '@/lib/schema'
import { MicroPack } from '@/lib/aiContracts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = PlannerInputSchema.parse(body)

    const systemPrompt = `You generate a micro-pack (3 phrases + 1 grammar + 1 pronunciation) for an English learner at CEFR ${input.cefr}.
Choose phrases slightly above current level, practical for everyday conversation and common situations.
Return JSON exactly in this format:
{
  "targets": [
    { "phrase": "phrase 1", "cefr": "B2" },
    { "phrase": "phrase 2", "cefr": "B2" },
    { "phrase": "phrase 3", "cefr": "B2" }
  ],
  "grammar": "Grammar point to practice",
  "pron": "Pronunciation focus"
}`

    const userPrompt = `Create a micro-pack.${
      input.lastErrors?.length
        ? ` The student recently made these errors: ${input.lastErrors.join(', ')}.`
        : ''
    }${
      input.interests?.length
        ? ` Topics of interest: ${input.interests.join(', ')}.`
        : ''
    }`

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      // Note: gpt-5-nano only supports default temperature (1)
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('No content returned from OpenAI')
    }

    const microPack: MicroPack = JSON.parse(content)
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
