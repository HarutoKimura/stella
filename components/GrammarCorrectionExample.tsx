'use client';

import { GrammarCorrectionCard, type GrammarCorrectionData } from './GrammarCorrectionCard';

/**
 * Example component demonstrating the enhanced Grammar Correction UI
 * with inline diff visualization.
 *
 * This shows how the backend should format grammar corrections for
 * the best visual feedback experience.
 */
export function GrammarCorrectionExample() {
  // Example correction matching the format from requirements
  const exampleCorrection: GrammarCorrectionData = {
    userSentence: 'Pronunciation assessment offer additional fluency, completeness, prosody scores.',
    correctedSentence: 'The pronunciation assessment offers additional fluency, completeness, and prosody scores.',
    errorTypes: ['article', 'verb-agreement', 'conjunction'],
    severity: 'minor',
    explanation: "Added article 'the', corrected verb agreement ('offer' → 'offers'), and added missing conjunction 'and'.",
  };

  const anotherExample: GrammarCorrectionData = {
    userSentence: 'I go to school yesterday and meet my friend.',
    correctedSentence: 'I went to school yesterday and met my friend.',
    errorTypes: ['tense'],
    severity: 'major',
    explanation: "Changed present tense verbs to past tense to match the time indicator 'yesterday'. Use 'went' instead of 'go' and 'met' instead of 'meet'.",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Enhanced Grammar Correction UI
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Inline diff visualization with interactive tooltips
        </p>
      </div>

      <GrammarCorrectionCard
        correction={exampleCorrection}
      />

      <GrammarCorrectionCard
        correction={anotherExample}
      />

      <div className="mt-8 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 className="text-white font-bold mb-3">Backend Data Format</h3>
        <p className="text-gray-400 text-sm mb-3">
          To use this enhanced UI, your backend should return corrections in this format:
        </p>
        <pre className="bg-black/50 p-4 rounded text-xs text-green-400 overflow-x-auto">
          {JSON.stringify(
            {
              userSentence: 'The sentence the user spoke',
              correctedSentence: 'The corrected version',
              errorTypes: ['article', 'verb-agreement'],
              severity: 'minor',
              explanation: 'Brief explanation of what was fixed',
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}

export default GrammarCorrectionExample;
