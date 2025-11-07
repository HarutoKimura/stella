'use client';

import {
  diffSentences,
  getOriginalDiffParts,
  getCorrectedDiffParts,
  getErrorTooltip,
  getSeverityClasses,
  getErrorTypeClasses,
  type DiffPart,
} from '@/lib/diffSentences';
import { Tooltip } from './Tooltip';
import SpotlightCard from './SpotlightCard';

export type GrammarCorrectionData = {
  userSentence: string;
  correctedSentence: string;
  errorTypes: string[];
  severity: 'minor' | 'major';
  explanation: string;
};

type Props = {
  correction: GrammarCorrectionData;
};

export function GrammarCorrectionCard({ correction }: Props) {
  const { userSentence, correctedSentence, errorTypes, severity } = correction;

  // Generate diff parts
  const diffs = diffSentences(userSentence, correctedSentence);
  const originalParts = getOriginalDiffParts(diffs);
  const correctedParts = getCorrectedDiffParts(diffs);

  const severityClasses = getSeverityClasses(severity);

  return (
    <SpotlightCard
      className="!p-0 overflow-hidden"
      spotlightColor="rgba(250, 204, 21, 0.15)"
    >
      {/* Header */}
      <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <div>
            <h3 className="text-yellow-300 font-bold text-sm">Grammar Correction</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {errorTypes.map((type, idx) => (
                <Tooltip key={idx} content={getErrorTooltip(type)}>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${getErrorTypeClasses(type)} cursor-help`}
                  >
                    {type}
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-lg text-xs font-bold border ${severityClasses.badge}`}
        >
          {severity === 'major' ? '⚠️ Major' : '⚡ Minor'}
        </span>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-4">
        {/* Original Sentence with Errors Highlighted */}
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
                      content="This part needs correction"
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

        {/* Corrected Sentence with Fixes Highlighted */}
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
