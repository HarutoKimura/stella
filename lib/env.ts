import { z } from 'zod'

/**
 * Environment variable validation
 *
 * This module validates all required environment variables at build/runtime
 * and provides type-safe access to them throughout the application.
 *
 * Benefits:
 * - Catches missing env vars early (at build time)
 * - Prevents accidental client-side exposure of secrets
 * - Provides TypeScript types for all env vars
 * - Documents which env vars are required vs optional
 */

// Server-side environment variables (NEVER exposed to client)
const serverSchema = z.object({
  // OpenAI API key (required)
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Supabase service role key (required for admin operations)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Azure Speech (optional - only needed for pronunciation features)
  AZURE_SPEECH_KEY: z.string().optional(),
  AZURE_SPEECH_REGION: z.string().optional(),

  // Upstash Redis (optional - falls back to in-memory rate limiting)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // OpenAI Organization (optional)
  OPENAI_ORGANIZATION: z.string().optional(),

  // Next.js app URL (optional - auto-detected in most cases)
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

// Client-side environment variables (exposed via NEXT_PUBLIC_ prefix)
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
})

/**
 * Validate server-side environment variables
 * Call this at the top of server-side files (API routes, server components)
 */
export function validateServerEnv() {
  try {
    return serverSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      throw new Error(
        `❌ Invalid server environment variables:\n${missingVars.join('\n')}\n\n` +
          'Please check your .env.local file and ensure all required variables are set.'
      )
    }
    throw error
  }
}

/**
 * Validate client-side environment variables
 * Call this at the top of client-side files or in _app.tsx
 */
export function validateClientEnv() {
  try {
    return clientSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      throw new Error(
        `❌ Invalid client environment variables:\n${missingVars.join('\n')}\n\n` +
          'Please check your .env.local file and ensure NEXT_PUBLIC_* variables are set.'
      )
    }
    throw error
  }
}

/**
 * Type-safe server environment (use in API routes and server components)
 * @throws Error if environment validation fails
 */
export const serverEnv = (() => {
  // Only validate on server-side
  if (typeof window === 'undefined') {
    return validateServerEnv()
  }
  return {} as z.infer<typeof serverSchema>
})()

/**
 * Type-safe client environment (use in client components)
 * @throws Error if environment validation fails
 */
export const clientEnv = validateClientEnv()

/**
 * Check if optional features are enabled
 */
export const features = {
  azureSpeech: Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
  upstashRedis: Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ),
}
