# 🫧 Floating Bubble Feature

Visual, non-intrusive correction and feedback system for the AI English Tutor.

## Features

### Bubble Types

1. **📝 Grammar Corrections** (Red)
   - Shows when user makes a grammar mistake
   - Example: "I go to store" → "I went to the store"

2. **📚 Vocabulary Corrections** (Blue)
   - Shows when user uses wrong vocabulary
   - Example: "a information" → "information (uncountable)"

3. **🗣️ Pronunciation Tips** (Green)
   - Shows pronunciation guidance
   - Example: "schedule" → "/ˈskedʒuːl/ or /ˈʃedjuːl/"

4. **🎯 Target Phrases** (Yellow)
   - Reminds user to try target phrases
   - Shows success when target is used
   - Example: "Try using: 'How was your day?'"

5. **⚠️ Recurring Errors** (Orange)
   - Highlights mistakes made 2+ times
   - Shows count badge
   - Example: "Common Mistake (3x)"

## How It Works

### Architecture

```
User speaks/types
    ↓
Realtime API / Tutor API
    ↓
Detects error/target usage
    ↓
bubbleHelpers.showCorrection()
    ↓
Bubble Store (Zustand)
    ↓
<FloatingBubble> component
    ↓
Animated bubble appears on screen
```

### Components

**`lib/bubbleStore.ts`**
- Zustand store managing active bubbles
- Auto-removes after 8 seconds
- Max 3 bubbles at once

**`components/FloatingBubble.tsx`**
- Individual bubble component
- Glassmorphism design
- Smooth animations (slide in, float, fade out)
- Click to dismiss

**`components/BubbleContainer.tsx`**
- Renders all active bubbles
- Manages positioning

**`lib/bubbleHelpers.ts`**
- Helper functions to trigger bubbles
- `showCorrection()`, `showTargetReminder()`, etc.

**`lib/realtimeBubbleIntegration.ts`**
- Integrates with Realtime API
- Checks for recurring errors in database
- Triggers appropriate bubble type

## Usage

### Trigger a Correction Bubble

```typescript
import { bubbleHelpers } from '@/lib/bubbleHelpers'

bubbleHelpers.showCorrection(
  'grammar',
  'I go to store yesterday',
  'I went to the store yesterday'
)
```

### Trigger a Target Phrase Reminder

```typescript
bubbleHelpers.showTargetReminder('How was your day?')
```

### Trigger a Recurring Error Bubble

```typescript
bubbleHelpers.showRecurringError(
  'vocab',
  'a information',
  'information',
  3  // count
)
```

### Trigger Target Success

```typescript
bubbleHelpers.showTargetSuccess('How was your day?')
```

## Testing

Click the **"🧪 Test Bubbles"** button in the bottom-left corner of `/free_conversation` to see demo bubbles.

## Visual Design

- **Glassmorphism**: Semi-transparent with backdrop blur
- **Color-coded**: Different colors for different types
- **Animations**:
  - Slide in from right (300ms ease-out)
  - Progress bar shows time remaining
  - Fade out on dismiss
- **Positioning**: Fixed right side, stacked vertically
- **Auto-dismiss**: 8 seconds or click to close

## Integration Points

### 1. Realtime API (Voice Mode)
When AI tutor calls functions:
```typescript
// In realtime event handler
case 'function_call':
  if (call.name === 'add_correction') {
    handleRealtimeCorrection(call.arguments, userId)
  }
```

### 2. Tutor API (Text Mode)
After receiving response:
```typescript
const response = await fetch('/api/tutor', { ... })
const data = await response.json()

if (data.corrections?.length > 0) {
  bubbleHelpers.showCorrections(data.corrections)
}
```

### 3. Database Integration
Check for recurring errors:
```typescript
import { checkRecurringErrors } from '@/lib/realtimeBubbleIntegration'

await checkRecurringErrors(userId, correction)
// Shows recurring bubble if count >= 2
```

## Customization

### Adjust Bubble Timing

In `lib/bubbleStore.ts`:
```typescript
// Auto-remove after 8 seconds
setTimeout(() => {
  // ...
}, 8000)  // Change this value
```

### Adjust Max Bubbles

In `lib/bubbleStore.ts`:
```typescript
// Limit to max 3 bubbles at once
if (newBubbles.length > 3) {  // Change this number
  newBubbles.shift()
}
```

### Adjust Animation Speed

In `components/FloatingBubble.tsx`:
```typescript
className={`... transition-all duration-300 ...`}
//                              ^^^^^^^ Change duration
```

### Adjust Positioning

In `components/FloatingBubble.tsx`:
```typescript
const topPosition = 100 + index * 120
//                  ^^^   ^^^^^^ ^^
//                  Start Y-offset  Spacing between bubbles
```

## Future Enhancements

- [ ] Sound effects on bubble appearance
- [ ] Different animation styles (bounce, scale, rotate)
- [ ] Confetti animation on target phrase success
- [ ] Swipe to dismiss gesture
- [ ] Bubble history/replay
- [ ] User preference to disable bubbles
- [ ] Different positions (top, bottom, left)
- [ ] Bubble grouping for related corrections

## Accessibility

- Click anywhere on bubble to dismiss
- Progress bar shows remaining time
- High contrast colors
- Large touch targets (entire bubble is clickable)

## Performance

- Lightweight (< 2KB gzipped)
- No external dependencies
- CSS animations (hardware accelerated)
- Auto-cleanup prevents memory leaks

---

**Status**: ✅ Implemented & Ready to Test

**Demo**: Click "🧪 Test Bubbles" button on `/free_conversation`
