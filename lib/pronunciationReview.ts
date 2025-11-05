/**
 * Background pronunciation review processing
 * Extracts problem words from existing pronunciation assessment data
 */

/**
 * Trigger background pronunciation review processing for a session
 * This extracts problem words from the session's pronunciation assessment data
 * and generates native TTS audio for practice
 */
export async function triggerPronunciationReview(sessionId: string): Promise<void> {
  try {
    console.log(`[Pronunciation Review] Extracting problem words for session ${sessionId}`)

    // Call the extract endpoint to process existing assessment data
    // This runs asynchronously and doesn't block the UI
    fetch('/api/pronunciation-review/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => {
        if (res.ok) {
          return res.json()
        }
        throw new Error(`HTTP ${res.status}`)
      })
      .then((data) => {
        console.log('[Pronunciation Review] Extraction completed:', data)
        if (data.problemsFound > 0) {
          console.log(`[Pronunciation Review] Found ${data.problemsFound} problem words`)
        }
      })
      .catch((err) => {
        console.error('[Pronunciation Review] Extraction failed:', err)
      })

    console.log('[Pronunciation Review] Background extraction triggered (running async)')
  } catch (error) {
    console.error('[Pronunciation Review] Failed to trigger review:', error)
    // Don't throw - this is a background process that shouldn't block the user
  }
}
