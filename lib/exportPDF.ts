/**
 * Export session review as PDF using browser print functionality
 */

type TranscriptTurn = {
  role: 'user' | 'tutor'
  text: string
  timestamp: number
}

type Correction = {
  type: 'grammar' | 'vocab' | 'pron'
  example: string
  correction: string
}

type SessionExportData = {
  sessionId: string
  startedAt: string
  endedAt: string | null
  studentTurns: number
  tutorTurns: number
  transcript: TranscriptTurn[]
  corrections: Correction[]
  usedTargets: string[]
  missedTargets: string[]
}

export function exportSessionToPDF(data: SessionExportData) {
  // Create a new window with printable content
  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    alert('Please allow popups to export PDF')
    return
  }

  const sessionDate = new Date(data.startedAt).toLocaleDateString()
  const sessionTime = new Date(data.startedAt).toLocaleTimeString()
  const duration = data.endedAt
    ? Math.round((new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()) / 1000 / 60)
    : 0

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Session Review - ${sessionDate}</title>
  <style>
    @media print {
      @page {
        margin: 1cm;
      }
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    h1 {
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
    }

    h2 {
      color: #475569;
      margin-top: 30px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 5px;
    }

    .metadata {
      background: #f1f5f9;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #1e293b;
    }

    .turn {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .turn-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 5px;
    }

    .turn-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .user-icon {
      background: #dbeafe;
      border: 2px solid #3b82f6;
    }

    .tutor-icon {
      background: #f3e8ff;
      border: 2px solid #a855f7;
    }

    .turn-role {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
      color: #64748b;
    }

    .turn-content {
      padding: 15px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-left: 40px;
    }

    .error-turn {
      border-left: 4px solid #ef4444;
    }

    .correction-box {
      margin-top: 15px;
      padding: 15px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
    }

    .correction-item {
      margin-bottom: 10px;
    }

    .correction-label {
      font-size: 12px;
      font-weight: bold;
      color: #991b1b;
      margin-bottom: 3px;
    }

    .correction-text {
      font-size: 14px;
      color: #1f2937;
    }

    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
      page-break-inside: avoid;
    }

    .comparison-box {
      padding: 15px;
      border-radius: 8px;
    }

    .wrong-box {
      background: #fef2f2;
      border: 2px solid #fecaca;
    }

    .correct-box {
      background: #f0fdf4;
      border: 2px solid #bbf7d0;
    }

    .box-label {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .wrong-label {
      color: #dc2626;
    }

    .correct-label {
      color: #16a34a;
    }

    .phrase-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .phrase-tag {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }

    .used-phrase {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    .missed-phrase {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde047;
    }

    @media print {
      body {
        padding: 0;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <h1>English Practice Session Review</h1>

  <div class="metadata">
    <strong>Session Date:</strong> ${sessionDate} at ${sessionTime}<br>
    <strong>Duration:</strong> ${duration} minutes<br>
    <strong>Session ID:</strong> ${data.sessionId}
  </div>

  <h2>Session Statistics</h2>
  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Your Turns</div>
      <div class="stat-value">${data.studentTurns}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Tutor Turns</div>
      <div class="stat-value">${data.tutorTurns}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Phrases Used</div>
      <div class="stat-value" style="color: #16a34a">${data.usedTargets.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Corrections</div>
      <div class="stat-value" style="color: #dc2626">${data.corrections.length}</div>
    </div>
  </div>

  ${
    data.usedTargets.length > 0 || data.missedTargets.length > 0
      ? `
  <h2>Target Phrases</h2>
  ${
    data.usedTargets.length > 0
      ? `
  <div style="margin-bottom: 15px">
    <strong style="color: #16a34a">✓ Successfully Used (${data.usedTargets.length}):</strong>
    <div class="phrase-list">
      ${data.usedTargets.map((phrase) => `<span class="phrase-tag used-phrase">${phrase}</span>`).join('')}
    </div>
  </div>
  `
      : ''
  }
  ${
    data.missedTargets.length > 0
      ? `
  <div style="margin-bottom: 15px">
    <strong style="color: #f59e0b">⚠ Missed (${data.missedTargets.length}):</strong>
    <div class="phrase-list">
      ${data.missedTargets.map((phrase) => `<span class="phrase-tag missed-phrase">${phrase}</span>`).join('')}
    </div>
  </div>
  `
      : ''
  }
  `
      : ''
  }

  ${
    data.corrections.length > 0
      ? `
  <h2>Corrections (${data.corrections.length})</h2>
  ${data.corrections
    .map(
      (corr, idx) => `
  <div class="comparison-grid">
    <div class="comparison-box wrong-box">
      <div class="box-label wrong-label">❌ What You Said</div>
      <div class="correction-text">"${corr.example}"</div>
    </div>
    <div class="comparison-box correct-box">
      <div class="box-label correct-label">✅ Should Be</div>
      <div class="correction-text">"${corr.correction}"</div>
    </div>
  </div>
  `
    )
    .join('')}
  `
      : '<p style="color: #16a34a"><strong>🎉 Perfect! No errors detected in this session.</strong></p>'
  }

  <h2>Full Transcript (${data.transcript.length} turns)</h2>
  ${data.transcript
    .map(
      (turn, idx) => `
  <div class="turn">
    <div class="turn-header">
      <div class="turn-icon ${turn.role === 'user' ? 'user-icon' : 'tutor-icon'}">
        ${turn.role === 'user' ? '👤' : '🤖'}
      </div>
      <span class="turn-role">${turn.role === 'user' ? 'You' : 'AI Tutor'}</span>
    </div>
    <div class="turn-content ${
      turn.role === 'user' && data.corrections.some((c) => turn.text.includes(c.example)) ? 'error-turn' : ''
    }">
      ${turn.text}
    </div>
  </div>
  `
    )
    .join('')}

  <div class="no-print" style="margin-top: 30px; text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px;">
    <p><strong>Ready to export?</strong></p>
    <button onclick="window.print()" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer; margin-right: 10px;">
      🖨️ Print / Save as PDF
    </button>
    <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer;">
      ✕ Close
    </button>
  </div>

  <script>
    // Auto-print after a short delay (optional)
    // setTimeout(() => window.print(), 500);
  </script>
</body>
</html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}
