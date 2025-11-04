import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/accent-test
 *
 * Performs comprehensive accent assessment:
 * 1. Uses Azure Speech API for pronunciation/fluency analysis
 * 2. Uses OpenAI to generate EGI scores (English Grading Index)
 * 3. Saves results to accent_tests table
 *
 * Expected FormData:
 * - audio: WAV audio file (10-20 seconds)
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Accent Test API] Request received')

    // Validate Azure credentials
    const apiKey = process.env.AZURE_SPEECH_KEY
    const region = process.env.AZURE_SPEECH_REGION

    if (!apiKey || !region) {
      console.error('[Accent Test API] Missing Azure credentials')
      return NextResponse.json(
        { error: 'Azure Speech credentials not configured' },
        { status: 500 }
      )
    }

    // Authenticate user
    const supabase = await createServerSupabaseClient()
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
      .select('id, cefr_level')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // CONTEXT MEMORY: Query recent feedback history (last 30 days)
    const { data: historicalFeedback } = await supabase
      .from('feedback_tips')
      .select('category, original_sentence, corrected_sentence, tip, severity, created_at')
      .eq('user_id', userProfile.id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    console.log('[Accent Test API] Historical feedback found:', historicalFeedback?.length || 0)

    // Aggregate recurring patterns
    const recurringIssues = historicalFeedback?.reduce((acc: any, tip: any) => {
      const key = tip.category
      if (!acc[key]) {
        acc[key] = { count: 0, examples: [] }
      }
      acc[key].count++
      if (acc[key].examples.length < 2) {
        acc[key].examples.push(tip.tip)
      }
      return acc
    }, {}) || {}

    // Parse form data
    const formData = await req.formData()
    const audio = formData.get('audio')

    console.log('[Accent Test API] Form data:', {
      hasAudio: !!audio,
      audioType: audio?.constructor.name,
      audioSize: audio instanceof File ? audio.size : 'N/A',
      audioMimeType: audio instanceof File ? audio.type : 'N/A',
      audioName: audio instanceof File ? audio.name : 'N/A',
    })

    if (!audio || !(audio instanceof File)) {
      console.error('[Accent Test API] Invalid audio file')
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    if (audio.size === 0) {
      console.error('[Accent Test API] Empty audio file')
      return NextResponse.json(
        { error: 'Audio file is empty' },
        { status: 400 }
      )
    }

    // Check minimum size (at least 10KB for meaningful audio)
    if (audio.size < 10000) {
      console.error('[Accent Test API] Audio file too small:', audio.size)
      return NextResponse.json(
        { error: 'Audio file too small. Please record at least 5 seconds of speech.' },
        { status: 400 }
      )
    }

    // STEP 1: Azure Speech Pronunciation Assessment
    console.log('[Accent Test API] Starting Azure Speech assessment...')

    const arrayBuffer = await audio.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log('[Accent Test API] Audio buffer details:', {
      byteLength: buffer.length,
      mimeType: audio.type
    })

    const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region)
    speechConfig.speechRecognitionLanguage = 'en-US'

    // Configure for unscripted assessment (open-ended speech)
    const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
      '', // Empty reference text for unscripted
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      false // No miscue detection for unscripted
    )

    // Enable prosody assessment if available
    try {
      if (typeof (pronunciationConfig as any).enableProsodyAssessment === 'function') {
        (pronunciationConfig as any).enableProsodyAssessment()
      }
    } catch (e) {
      console.log('[Accent Test API] Prosody assessment not available')
    }

    // Use buffer directly with fromWavFileInput - it accepts Buffer in Node.js
    console.log('[Accent Test API] Creating audio config from buffer...')
    const audioConfig = sdk.AudioConfig.fromWavFileInput(buffer as any)
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
    pronunciationConfig.applyTo(recognizer)

    // Perform recognition
    console.log('[Accent Test API] Starting recognition...')
    const result = await new Promise<sdk.SpeechRecognitionResult>(
      (resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            recognizer.close()
            console.log('[Accent Test API] Recognition completed:', {
              reason: result.reason,
              text: result.text,
            })
            resolve(result)
          },
          (error) => {
            recognizer.close()
            console.error('[Accent Test API] Recognition error:', error)
            reject(error)
          }
        )
      }
    )

    if (result.reason !== sdk.ResultReason.RecognizedSpeech) {
      console.error('[Accent Test API] Speech not recognized:', {
        reason: result.reason,
        reasonText: sdk.ResultReason[result.reason],
        audioSize: audio.size,
        audioType: audio.type
      })

      // Get detailed error information
      const errorDetails = result.errorDetails
      console.error('[Accent Test API] Error details:', errorDetails)

      let errorMessage = 'Could not recognize speech in the audio. '

      if (result.reason === sdk.ResultReason.NoMatch) {
        errorMessage += 'Please ensure you are speaking clearly and loudly enough. Try recording in a quieter environment.'
      } else if (result.reason === sdk.ResultReason.Canceled) {
        errorMessage += 'Recognition was canceled. ' + (errorDetails || 'Please try again.')
      } else {
        errorMessage += 'Please try again with a longer recording (10-15 seconds).'
      }

      return NextResponse.json(
        {
          error: errorMessage,
          reason: sdk.ResultReason[result.reason],
          details: errorDetails,
          hints: [
            'Speak clearly and naturally',
            'Ensure microphone is working properly',
            'Record in a quiet environment',
            'Speak for at least 10 seconds'
          ]
        },
        { status: 400 }
      )
    }

    // Extract Azure scores
    const pronunciationResult =
      sdk.PronunciationAssessmentResult.fromResult(result)

    const detailsJson = result.properties.getProperty(
      sdk.PropertyId.SpeechServiceResponse_JsonResult
    )
    const details = JSON.parse(detailsJson)

    const azureScores = {
      pronunciation: pronunciationResult.pronunciationScore,
      accuracy: pronunciationResult.accuracyScore,
      fluency: pronunciationResult.fluencyScore,
      completeness: pronunciationResult.completenessScore,
      prosody: details.NBest?.[0]?.PronunciationAssessment?.ProsodyScore || null,
    }

    const recognizedText = result.text
    const words = details.NBest?.[0]?.Words || []

    // Extract word-level pronunciation issues (words with score < 60)
    const pronunciationIssues = words
      .filter((word: any) => {
        const pronScore = word.PronunciationAssessment?.AccuracyScore || 100
        return pronScore < 60
      })
      .map((word: any) => ({
        word: word.Word,
        score: word.PronunciationAssessment?.AccuracyScore || 0,
        phonemes: word.Phonemes?.map((p: any) => ({
          phoneme: p.Phoneme,
          score: p.PronunciationAssessment?.AccuracyScore || 0
        })) || []
      }))

    console.log('[Accent Test API] Azure scores:', azureScores)
    console.log('[Accent Test API] Recognized text:', recognizedText)
    console.log('[Accent Test API] Pronunciation issues found:', pronunciationIssues.length)

    // STEP 2: OpenAI Analysis for EGI Scores
    console.log('[Accent Test API] Starting OpenAI analysis...')

    const openaiPrompt = `You are an expert English speech coach and assessment engine. Analyze the following speech data and provide comprehensive feedback that actually teaches, not just measures.

**Recognized Speech Text:**
"${recognizedText}"

**Azure Pronunciation Assessment Scores (0-100):**
- Pronunciation: ${azureScores.pronunciation}
- Accuracy: ${azureScores.accuracy}
- Fluency: ${azureScores.fluency}
- Completeness: ${azureScores.completeness}
- Prosody: ${azureScores.prosody || 'N/A'}

**Word Count:** ${words.length}

**Current CEFR Level:** ${userProfile.cefr_level}

**Word-Level Pronunciation Issues (Azure detected ${pronunciationIssues.length} mispronounced words):**
${pronunciationIssues.length > 0 ? pronunciationIssues.map((issue: any) =>
  `- "${issue.word}" (score: ${issue.score}/100)${issue.phonemes.length > 0 ?
    `\n  Problematic phonemes: ${issue.phonemes.filter((p: any) => p.score < 60).map((p: any) => `${p.phoneme} (${p.score})`).join(', ')}` : ''}`
).join('\n') : 'None - good pronunciation overall'}

**Historical Patterns (Context Memory - Last 30 days):**
${Object.keys(recurringIssues).length > 0 ?
  Object.entries(recurringIssues).map(([category, data]: [string, any]) =>
    `- ${category.toUpperCase()}: ${data.count} issue(s) detected previously\n  Past tips: ${data.examples.join('; ')}`
  ).join('\n') :
  'No previous feedback history available (first test or new user)'}

${historicalFeedback && historicalFeedback.length > 0 ?
  '\n**Important**: If you notice similar patterns repeating, mention: "Last time, you had trouble with [issue]. Let\'s work on this again."' :
  ''}

**Task Part 1: Quantitative Assessment**
1. Evaluate the grammar quality (sentence structure, tense usage, articles, prepositions)
2. Evaluate vocabulary richness and appropriateness
3. Assess overall confidence and communication effectiveness
4. Calculate an overall EGI score (0-100) combining:
   - Pronunciation (25%)
   - Fluency (20%)
   - Grammar (25%)
   - Vocabulary (20%)
   - Confidence (10%)
5. Estimate the CEFR level (A1-C2)

**Task Part 2: Semantic Feedback (This is what makes you better than Elsa!)**
Identify up to 3 specific, actionable linguistic issues in the transcript:

For each issue:
- Extract the exact sentence/phrase with the problem
- Provide the corrected, natural-sounding version
- Give ONE specific, actionable tip (not generic advice)
- Categorize: grammar, vocabulary, pronunciation, fluency, idiom, or structure
- Rate severity using these pedagogical rules:

**Severity Rating (Pedagogically Consistent):**
- **HIGH** (affects intelligibility or core grammar):
  * Wrong verb tense (past/present confusion, e.g., "I go yesterday")
  * Missing or wrong articles (the/a/an, e.g., "I am student")
  * Subject-verb agreement errors (e.g., "He go to school")
  * Wrong prepositions that change meaning (e.g., "interested of" → "interested in")
  * Plural/singular confusion affecting meaning

- **MEDIUM** (stylistic, but affects naturalness):
  * Awkward word choice where meaning is clear but sounds non-native
  * Unnatural phrasing (grammatically correct but not idiomatic)
  * Missing collocations or fixed expressions
  * Word order issues that don't obscure meaning
  * Redundant or overly formal expressions

- **LOW** (minor issues, doesn't impede communication):
  * Slight pronunciation variations that are still understandable
  * Minor filler word overuse (um, uh, like)
  * Small pause or fluency issues
  * Advanced vocabulary mistakes (using B1 word instead of C1 equivalent)

Focus on:
- Grammar mistakes that sound unnatural to native speakers
- Word choice that could be more natural or precise
- Sentence structures that could be simplified or improved
- Common non-native patterns (e.g., "go to abroad" → "go abroad")
- Missing articles, wrong prepositions, awkward phrasing
- **Pronunciation issues with phoneme guidance** (NEW!):
  * If Azure detected mispronounced words (listed above), include pronunciation feedback
  * Use IPA phonetics for clear guidance (e.g., /ˈɪn.trə.stɪŋ/ not /ˈɪntrestɪŋ/)
  * Link pronunciation to common L1 transfer errors (e.g., Japanese speakers: R/L confusion, TH sounds)
  * Make it actionable: "Focus on the /ð/ sound in 'this' - place tongue between teeth"

Return ONLY a valid JSON object with this exact structure:
{
  "pronunciation_score": <number 0-100>,
  "fluency_score": <number 0-100>,
  "grammar_score": <number 0-100>,
  "vocabulary_score": <number 0-100>,
  "confidence_score": <number 0-100>,
  "egi_score": <number 0-100>,
  "cefr_level": "<A1|A2|B1|B2|C1|C2>",
  "feedback": {
    "strengths": ["<strength 1>", "<strength 2>"],
    "improvements": ["<improvement 1>", "<improvement 2>"],
    "next_steps": "<brief suggestion for improvement>"
  },
  "semantic_feedback": [
    {
      "category": "<grammar|vocabulary|pronunciation|fluency|idiom|structure>",
      "original": "<exact sentence or phrase with issue>",
      "corrected": "<natural, corrected version>",
      "tip": "<one specific, actionable tip - be concrete!>",
      "explanation": "<why this correction matters - 1 sentence>",
      "severity": "<low|medium|high>"
    }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert English language assessment engine. Return only valid JSON.',
        },
        {
          role: 'user',
          content: openaiPrompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const aiResponse = completion.choices[0].message.content
    if (!aiResponse) {
      throw new Error('OpenAI returned empty response')
    }

    const egiAnalysis = JSON.parse(aiResponse)
    console.log('[Accent Test API] EGI Analysis:', egiAnalysis)

    // STEP 3: Save to Database
    console.log('[Accent Test API] Saving to database...')

    // Round all scores to integers (database expects int, not float)
    const roundedScores = {
      egi_score: Math.round(egiAnalysis.egi_score),
      pronunciation_score: Math.round(egiAnalysis.pronunciation_score),
      fluency_score: Math.round(egiAnalysis.fluency_score),
      grammar_score: Math.round(egiAnalysis.grammar_score),
      vocabulary_score: Math.round(egiAnalysis.vocabulary_score),
      confidence_score: Math.round(egiAnalysis.confidence_score),
    }

    console.log('[Accent Test API] Rounded scores:', roundedScores)

    const { data: accentTest, error: insertError } = await supabase
      .from('accent_tests')
      .insert({
        user_id: userProfile.id,
        egi_score: roundedScores.egi_score,
        cefr_level: egiAnalysis.cefr_level,
        pronunciation_score: roundedScores.pronunciation_score,
        fluency_score: roundedScores.fluency_score,
        grammar_score: roundedScores.grammar_score,
        vocabulary_score: roundedScores.vocabulary_score,
        confidence_score: roundedScores.confidence_score,
        azure_pronunciation: azureScores.pronunciation,
        azure_accuracy: azureScores.accuracy,
        azure_fluency: azureScores.fluency,
        azure_completeness: azureScores.completeness,
        azure_prosody: azureScores.prosody,
        recognized_text: recognizedText,
        audio_duration_ms: Math.round(result.duration / 10000), // Convert from ticks to ms
        ai_feedback: egiAnalysis.feedback,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Accent Test API] Database insert error:', insertError)
      throw insertError
    }

    console.log('[Accent Test API] Successfully saved accent test:', accentTest.id)

    // STEP 3.5: Save Semantic Feedback Tips to Database
    const semanticFeedback = egiAnalysis.semantic_feedback || []
    console.log('[Accent Test API] Saving semantic feedback tips:', semanticFeedback.length)

    if (semanticFeedback.length > 0) {
      const feedbackTips = semanticFeedback.map((tip: any) => ({
        accent_test_id: accentTest.id,
        user_id: userProfile.id,
        category: tip.category,
        original_sentence: tip.original,
        corrected_sentence: tip.corrected,
        tip: tip.tip,
        explanation: tip.explanation,
        severity: tip.severity,
      }))

      const { error: feedbackError } = await supabase
        .from('feedback_tips')
        .insert(feedbackTips)

      if (feedbackError) {
        console.error('[Accent Test API] Failed to save feedback tips:', feedbackError)
        // Don't fail the whole request if feedback tips fail
      } else {
        console.log('[Accent Test API] Successfully saved', feedbackTips.length, 'feedback tips')

        // STEP 3.6: Update user_progress table for dashboard
        try {
          const { error: progressError } = await supabase.rpc('update_user_progress')
          if (progressError) {
            console.error('[Accent Test API] Failed to update progress:', progressError)
          } else {
            console.log('[Accent Test API] Progress dashboard updated successfully')
          }
        } catch (progressUpdateError) {
          console.error('[Accent Test API] Error updating progress:', progressUpdateError)
          // Don't fail the request if progress update fails
        }
      }
    }

    // STEP 4: Return results (use rounded scores for consistency)
    return NextResponse.json({
      success: true,
      test_id: accentTest.id,
      egi_score: roundedScores.egi_score,
      cefr_level: egiAnalysis.cefr_level,
      scores: {
        pronunciation: roundedScores.pronunciation_score,
        fluency: roundedScores.fluency_score,
        grammar: roundedScores.grammar_score,
        vocabulary: roundedScores.vocabulary_score,
        confidence: roundedScores.confidence_score,
      },
      azure_scores: azureScores,
      recognized_text: recognizedText,
      feedback: egiAnalysis.feedback,
      semantic_feedback: semanticFeedback,
    })
  } catch (error) {
    console.error('[Accent Test API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to assess accent',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
