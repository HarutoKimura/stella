import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Fallback in-memory store for development (when Upstash is not configured)
class InMemoryStore {
  private store = new Map<string, { count: number; reset: number }>()

  async limit(key: string, limit: number, windowMs: number): Promise<{ success: boolean }> {
    const now = Date.now()
    const record = this.store.get(key)

    if (!record || now > record.reset) {
      this.store.set(key, { count: 1, reset: now + windowMs })
      return { success: true }
    }

    if (record.count >= limit) {
      return { success: false }
    }

    record.count++
    return { success: true }
  }
}

const inMemoryStore = new InMemoryStore()

// Check if Upstash is configured
const isUpstashConfigured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

let redis: Redis | null = null

if (isUpstashConfigured) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

/**
 * Rate limiting configurations for different API endpoint types
 */
export const ratelimit = {
  /**
   * Strict rate limiting for expensive AI operations
   * - 10 requests per minute
   * - Use for: /api/tutor, /api/planner, /api/recommendations, /api/analyze-transcript
   */
  ai: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
      })
    : {
        limit: async (identifier: string) => {
          console.warn('[Rate Limit] Using in-memory store (Upstash not configured)')
          return inMemoryStore.limit(identifier, 10, 60000)
        },
      },

  /**
   * Moderate rate limiting for API operations with database writes
   * - 30 requests per minute
   * - Use for: /api/summarize, /api/session/create, /api/targets/add
   */
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        analytics: true,
      })
    : {
        limit: async (identifier: string) => {
          console.warn('[Rate Limit] Using in-memory store (Upstash not configured)')
          return inMemoryStore.limit(identifier, 30, 60000)
        },
      },

  /**
   * Lenient rate limiting for read operations
   * - 100 requests per minute
   * - Use for: GET endpoints like /api/insights, /api/recommendations (GET)
   */
  read: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        analytics: true,
      })
    : {
        limit: async (identifier: string) => {
          console.warn('[Rate Limit] Using in-memory store (Upstash not configured)')
          return inMemoryStore.limit(identifier, 100, 60000)
        },
      },

  /**
   * Moderate rate limiting for token generation
   * - 20 requests per minute (increased for development/testing)
   * - Use for: /api/realtime-token
   */
  token: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        analytics: true,
      })
    : {
        limit: async (identifier: string) => {
          console.warn('[Rate Limit] Using in-memory store (Upstash not configured)')
          return inMemoryStore.limit(identifier, 20, 60000)
        },
      },

  /**
   * Strict rate limiting for file uploads
   * - 20 requests per minute
   * - Use for: /api/transcribe, /api/pronunciation-assessment
   */
  upload: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        analytics: true,
      })
    : {
        limit: async (identifier: string) => {
          console.warn('[Rate Limit] Using in-memory store (Upstash not configured)')
          return inMemoryStore.limit(identifier, 20, 60000)
        },
      },
}

/**
 * Helper function to get identifier from request
 * Uses user ID if authenticated, otherwise falls back to IP
 */
export function getRateLimitIdentifier(req: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`
  }

  // Try to get IP from various headers (Vercel provides x-forwarded-for)
  const forwardedFor = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'

  return `ip:${ip}`
}
