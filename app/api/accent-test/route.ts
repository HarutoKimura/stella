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

    console.log('[Accent Test API] Azure scores:', azureScores)
    console.log('[Accent Test API] Recognized text:', recognizedText)

    // STEP 2: OpenAI Analysis for EGI Scores
    console.log('[Accent Test API] Starting OpenAI analysis...')

    const openaiPrompt = `You are an English assessment engine for language learners. Analyze the following speech assessment data and provide a comprehensive EGI (English Grading Index) evaluation.

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

**Task:**
1. Evaluate the grammar quality based on the text (look for sentence structure, tense usage, etc.)
2. Evaluate vocabulary richness and appropriateness
3. Assess overall confidence and communication effectiveness
4. Calculate an overall EGI score (0-100) that combines:
   - Pronunciation (25%)
   - Fluency (20%)
   - Grammar (25%)
   - Vocabulary (20%)
   - Confidence (10%)
5. Estimate the CEFR level (A1-C2) based on all factors
6. Provide brief feedback on strengths and areas for improvement

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
  }
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
