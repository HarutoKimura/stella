import { useState } from 'react'
import SpotlightCard from '../SpotlightCard'
import { GrammarCorrectionCard, type GrammarCorrectionData } from '../GrammarCorrectionCard'
import { ClarityFocusCard } from '../ClarityFocusCard'
import { Tooltip } from '../Tooltip'
import { diffSentences, getOriginalDiffParts, getCorrectedDiffParts } from '@/lib/diffSentences'

type Correction = {
  type: 'grammar' | 'vocab' | 'pron'
  example: string
  correction: string
}

type ClarityFocusWord = {
  word: string
  accuracy_score: number
  segment_index: number | null
  phonemes?: any
}

type Props = {
  corrections: Correction[]
  clarityFocusWords?: ClarityFocusWord[]
}

// Helper function to convert basic correction to enhanced format
function toEnhancedGrammarCorrection(correction: Correction): GrammarCorrectionData {
  // Simple heuristic to detect error types and generate explanation
  const userSentence = correction.example;
  const correctedSentence = correction.correction;

  // Detect likely error types based on common patterns
  const errorTypes: string[] = [];
  let explanation = '';

  if (userSentence.toLowerCase().includes('the') !== correctedSentence.toLowerCase().includes('the') ||
      userSentence.toLowerCase().includes(' a ') !== correctedSentence.toLowerCase().includes(' a ') ||
      userSentence.toLowerCase().includes('an ') !== correctedSentence.toLowerCase().includes('an ')) {
    errorTypes.push('article');
  }

  // Check for verb form differences
  const verbPatterns = /\b(is|are|was|were|do|does|did|have|has|had)\b/gi;
  const userVerbs = userSentence.match(verbPatterns) || [];
  const correctedVerbs = correctedSentence.match(verbPatterns) || [];
  if (userVerbs.join('') !== correctedVerbs.join('')) {
    errorTypes.push('verb-agreement');
  }

  // Check for conjunction differences
  if ((userSentence.match(/\band\b|\bor\b|\bbut\b/gi) || []).length !==
      (correctedSentence.match(/\band\b|\bor\b|\bbut\b/gi) || []).length) {
    errorTypes.push('conjunction');
  }

  // If no specific errors detected, use generic label
  if (errorTypes.length === 0) {
    errorTypes.push('grammar');
  }

  // Generate explanation
  const changes = [];
  if (errorTypes.includes('article')) changes.push('article usage');
  if (errorTypes.includes('verb-agreement')) changes.push('verb agreement');
  if (errorTypes.includes('conjunction')) changes.push('conjunction');

  explanation = changes.length > 0
    ? `Corrected ${changes.join(', ')}.`
    : 'Grammar correction applied.';

  // Determine severity based on sentence length difference
  const lengthDiff = Math.abs(correctedSentence.length - userSentence.length);
  const severity: 'minor' | 'major' = lengthDiff > 10 ? 'major' : 'minor';

  return {
    userSentence,
    correctedSentence,
    errorTypes,
    severity,
    explanation,
  };
}

export function CorrectionComparison({ corrections, clarityFocusWords = [] }: Props) {
  const [filterType, setFilterType] = useState<'all' | 'grammar' | 'vocab' | 'pron'>('all')

  const filteredCorrections = filterType === 'all'
    ? corrections
    : corrections.filter((c) => c.type === filterType)

  // Group corrections by type
  const correctionsByType = {
    grammar: corrections.filter((c) => c.type === 'grammar'),
    vocab: corrections.filter((c) => c.type === 'vocab'),
    pron: corrections.filter((c) => c.type === 'pron'),
  }

  // Show clarity focus words in pronunciation filter
  const showClarityFocus = (filterType === 'pron' || filterType === 'all') && clarityFocusWords.length > 0

  if (corrections.length === 0 && clarityFocusWords.length === 0) {
    return (
      <SpotlightCard className="!p-8" spotlightColor="rgba(34, 197, 94, 0.3)">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-green-300 text-xl font-bold mb-2">Perfect Session!</p>
          <p className="text-gray-400 text-sm">
            No errors detected during this session. Keep up the great work!
          </p>
        </div>
      </SpotlightCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            filterType === 'all'
              ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
              : 'bg-gray-500/10 text-gray-400 border border-gray-500/30 hover:bg-gray-500/20'
          }`}
        >
          All ({corrections.length})
        </button>
        <button
          onClick={() => setFilterType('pron')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            filterType === 'pron'
              ? 'bg-green-500/30 text-green-300 border border-green-500/50'
              : 'bg-gray-500/10 text-gray-400 border border-gray-500/30 hover:bg-gray-500/20'
          }`}
        >
          🗣️ Pronunciation ({correctionsByType.pron.length})
        </button>
        <button
          onClick={() => setFilterType('grammar')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            filterType === 'grammar'
              ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
              : 'bg-gray-500/10 text-gray-400 border border-gray-500/30 hover:bg-gray-500/20'
          }`}
        >
          📝 Grammar ({correctionsByType.grammar.length})
        </button>
        <button
          onClick={() => setFilterType('vocab')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            filterType === 'vocab'
              ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
              : 'bg-gray-500/10 text-gray-400 border border-gray-500/30 hover:bg-gray-500/20'
          }`}
        >
          📚 Vocabulary ({correctionsByType.vocab.length})
        </button>
      </div>

      {/* Corrections List */}
      <div className="space-y-4">
        {/* Clarity Focus - Show first when in pronunciation or all filter */}
        {showClarityFocus && (
          <ClarityFocusCard words={clarityFocusWords} />
        )}

        {filteredCorrections.length === 0 && !showClarityFocus ? (
          <SpotlightCard className="!p-6">
            <p className="text-gray-400 text-center">
              No {filterType} errors found in this session.
            </p>
          </SpotlightCard>
        ) : (
          filteredCorrections.map((correction, index) => {
            // Use enhanced grammar card for grammar corrections
            if (correction.type === 'grammar') {
              const enhancedCorrection = toEnhancedGrammarCorrection(correction);
              return (
                <GrammarCorrectionCard
                  key={index}
                  correction={enhancedCorrection}
                />
              );
            }

            // Use inline diff for vocab, simple card for pronunciation
            if (correction.type === 'vocab') {
              // Generate diff parts for vocabulary
              const diffs = diffSentences(correction.example, correction.correction);
              const originalParts = getOriginalDiffParts(diffs);
              const correctedParts = getCorrectedDiffParts(diffs);

              return (
                <SpotlightCard
                  key={index}
                  className="!p-0 overflow-hidden"
                  spotlightColor="rgba(168, 85, 247, 0.15)"
                >
                  {/* Header */}
                  <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📚</span>
                      <h3 className="text-purple-300 font-bold text-sm">Vocabulary</h3>
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="p-6 space-y-4">
                    {/* Original with errors highlighted */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">❌</span>
                        <h4 className="text-red-300 font-semibold text-sm">You said:</h4>
                      </div>
                      <div className="bg-red-900/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-white text-base leading-relaxed">
                          {originalParts.map((part, idx) => {
                            if (part.type === 'removed') {
                              return (
                                <Tooltip
                                  key={idx}
                                  content="This needs correction"
                                >
                                  <span className="text-red-400 font-medium cursor-help">
                                    {part.value}
                                  </span>
                                </Tooltip>
                              );
                            }
                            return <span key={idx}>{part.value}</span>;
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Corrected with fixes highlighted */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        <h4 className="text-green-300 font-semibold text-sm">Corrected:</h4>
                      </div>
                      <div className="bg-green-900/10 border border-green-500/30 rounded-lg p-4">
                        <p className="text-white text-base leading-relaxed">
                          {correctedParts.map((part, idx) => {
                            if (part.type === 'added') {
                              return (
                                <Tooltip
                                  key={idx}
                                  content="Correction applied"
                                >
                                  <span className="text-green-400 font-medium bg-green-500/10 px-1 rounded cursor-help">
                                    {part.value}
                                  </span>
                                </Tooltip>
                              );
                            }
                            return <span key={idx}>{part.value}</span>;
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              );
            }

            // Pronunciation corrections - keep simple side-by-side format
            return (
              <SpotlightCard
                key={index}
                className="!p-0 overflow-hidden"
                spotlightColor="rgba(34, 197, 94, 0.2)"
              >
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {/* What you said (Error) */}
                  <div className="p-6 bg-red-500/10 border-r border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">❌</span>
                      <div>
                        <h3 className="text-red-300 font-bold text-sm">What You Said</h3>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-500/20 text-green-300">
                          Pronunciation
                        </span>
                      </div>
                    </div>
                    <p className="text-white text-lg bg-red-900/20 p-3 rounded border border-red-500/30">
                      "{correction.example}"
                    </p>
                  </div>

                  {/* Correct version */}
                  <div className="p-6 bg-green-500/10">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <h3 className="text-green-300 font-bold text-sm">Should Be</h3>
                        <span className="text-xs text-gray-400 mt-1">Correct Version</span>
                      </div>
                    </div>
                    <p className="text-white text-lg bg-green-900/20 p-3 rounded border border-green-500/30">
                      "{correction.correction}"
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {filteredCorrections.length > 0 && (
        <SpotlightCard className="!p-4 !bg-gray-800/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span className="text-gray-400">
                Total Errors: <span className="text-red-300 font-semibold">{corrections.length}</span>
              </span>
              <span className="text-gray-400">
                Most Common: <span className="text-yellow-300 font-semibold">
                  {correctionsByType.grammar.length >= correctionsByType.vocab.length && correctionsByType.grammar.length >= correctionsByType.pron.length
                    ? 'Grammar'
                    : correctionsByType.vocab.length >= correctionsByType.pron.length
                      ? 'Vocabulary'
                      : 'Pronunciation'}
                </span>
              </span>
            </div>
            <span className="text-gray-500 text-xs">
              💡 Review these regularly for faster improvement
            </span>
          </div>
        </SpotlightCard>
      )}
    </div>
  )
}
