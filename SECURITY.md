# Security Policy

## Overview

This document outlines the security measures implemented in the Stella AI English Tutor application to protect user data and prevent abuse.

## Security Features

### 1. Rate Limiting

**Protection Against:** API abuse, DoS attacks, excessive OpenAI costs

All API routes are protected with rate limiting using Upstash Redis (with in-memory fallback):

- **AI Routes** (`/api/tutor`, `/api/planner`, `/api/recommendations`, `/api/analyze-transcript`): 10 requests/minute
- **Token Generation** (`/api/realtime-token`): 5 requests/minute
- **File Uploads** (`/api/transcribe`, `/api/pronunciation-assessment`): 20 requests/minute
- **API Operations** (database writes): 30 requests/minute
- **Read Operations**: 100 requests/minute

Rate limits are enforced per user ID (when authenticated) or per IP address (for anonymous requests).

### 2. Input Validation

**Protection Against:** Injection attacks, resource exhaustion, XSS

All user inputs are validated using Zod schemas:

- **Text inputs**: Maximum 5,000 characters
- **File uploads**: Maximum 25MB, restricted to audio formats only
- **Arrays**: Limited to reasonable sizes (e.g., max 50 targets per session)
- **UUIDs**: Validated as proper UUID format

### 3. Authentication & Authorization

**Protection Against:** Unauthorized access, privilege escalation

- Supabase Auth handles all authentication
- Every API route verifies the authenticated user via `supabase.auth.getUser()`
- User IDs are validated against their auth tokens before database operations
- Service role client is restricted to server-side only with runtime checks

### 4. Row Level Security (RLS)

**Protection Against:** Data leaks, unauthorized database access

All Supabase tables have RLS enabled with policies ensuring:
- Users can only view their own data
- Users can only insert/update records linked to their account
- Policies use `auth.uid()` to match against `users.auth_user_id`

Tables with RLS:
- `users`, `sessions`, `targets`, `errors`, `fluency_snapshots`
- `progress_metrics`, `weekly_progress`, `cefr_trajectory`
- `recommended_actions`, `feedback_tips`, `accent_tests`
- `coach_sessions`, `conversation_sessions`, `clarity_focus_items`
- `weekly_insights`, `user_progress`

### 5. CSRF Protection

**Protection Against:** Cross-site request forgery

Middleware validates:
- Referer header matches the request host for POST/PUT/DELETE/PATCH
- Invalid referers are blocked with 403 status
- GET requests are exempt (safe methods)

### 6. Security Headers

**Protection Against:** Clickjacking, MIME sniffing, XSS

HTTP security headers configured in `next.config.ts`:
- `Strict-Transport-Security`: Forces HTTPS
- `X-Frame-Options: DENY`: Prevents clickjacking
- `X-Content-Type-Options: nosniff`: Prevents MIME sniffing
- `X-XSS-Protection`: Enables browser XSS filters
- `Referrer-Policy`: Limits referrer information leakage
- `Permissions-Policy`: Restricts browser features

### 7. Environment Variable Protection

**Protection Against:** Secret exposure, misconfiguration

- Type-safe environment validation using Zod (`lib/env.ts`)
- Server-only variables never exposed to client
- Build-time validation catches missing required variables
- Runtime checks prevent accidental client-side usage

### 8. File Upload Security

**Protection Against:** Malicious file uploads, storage exhaustion

File upload validation for `/api/transcribe`:
- Maximum size: 25MB (OpenAI limit)
- Allowed formats: webm, wav, mp3, mp4, m4a, ogg, flac
- MIME type validation
- Rate limiting on upload endpoints

## Setting Up Rate Limiting (Optional but Recommended)

For production deployments, set up Upstash Redis for distributed rate limiting:

1. Create a free account at [https://console.upstash.com](https://console.upstash.com)
2. Create a new Redis database
3. Copy the REST URL and token
4. Add to your `.env.local`:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token-here
   ```

If not configured, the app falls back to in-memory rate limiting (not recommended for multi-instance deployments).

## Database Security Checklist

Before going to production, run this migration to ensure all RLS policies are in place:

```bash
# From Supabase SQL Editor, run:
sql/migrations/009_add_missing_rls.sql
```

Verify RLS is enabled:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;
```

Should return no rows (all tables have RLS enabled).

## Monitoring & Alerts

### Recommended Monitoring

1. **OpenAI Usage**
   - Set up billing alerts in OpenAI dashboard
   - Monitor daily spending
   - Alert on unusual spikes

2. **Supabase**
   - Monitor RLS bypass attempts (check logs for service role usage)
   - Track failed auth attempts
   - Monitor database connection pool

3. **Vercel/Hosting**
   - Monitor 429 (rate limit) responses
   - Track 403 (CSRF/auth) errors
   - Set up error alerting

### Log Analysis

Check for suspicious patterns:
```bash
# High rate limit hits from single IP
grep "429" vercel-logs.json | jq '.ip' | sort | uniq -c | sort -rn

# Failed auth attempts
grep "Unauthorized" vercel-logs.json | jq '.ip' | sort | uniq -c

# CSRF blocks
grep "Invalid request origin" vercel-logs.json
```

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **DO NOT** open a public issue
2. Email: [your-security-email@domain.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and provide a fix timeline.

## Security Best Practices for Developers

### API Routes

```typescript
// ✅ GOOD: Rate limiting + auth + validation
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }} = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const identifier = getRateLimitIdentifier(req, user.id)
  const { success } = await ratelimit.api.limit(identifier)
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json()
  const input = MySchema.parse(body) // Zod validation
  // ... rest of logic
}

// ❌ BAD: No protection
export async function POST(req: NextRequest) {
  const body = await req.json()
  // Direct database write without validation
  await supabase.from('table').insert(body)
}
```

### Environment Variables

```typescript
// ✅ GOOD: Use validated env
import { serverEnv } from '@/lib/env'
const apiKey = serverEnv.OPENAI_API_KEY

// ❌ BAD: Direct access, no validation
const apiKey = process.env.OPENAI_API_KEY // Could be undefined
```

### Service Role Client

```typescript
// ✅ GOOD: Only when absolutely necessary, with checks
export async function adminDeleteUser(userId: string, adminId: string) {
  // Verify admin permissions first
  if (!isAdmin(adminId)) throw new Error('Unauthorized')

  const client = createServiceRoleClient()
  await client.from('users').delete().eq('id', userId)
}

// ❌ BAD: Bypassing RLS without reason
const client = createServiceRoleClient()
const data = await client.from('users').select('*') // Exposes all users!
```

## Version History

- **v1.1.0** (2025-11-11): Added rate limiting, CSRF protection, input validation, RLS policies
- **v1.0.0** (2025-10-01): Initial release with basic authentication

## License

See LICENSE file for details.
