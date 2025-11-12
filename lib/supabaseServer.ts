import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Server client (use in server components and API routes)
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Service role client (bypasses RLS) - USE WITH EXTREME CAUTION
 *
 * SECURITY WARNING:
 * - This client bypasses all Row Level Security policies
 * - Only use when absolutely necessary (e.g., admin operations, background jobs)
 * - Never expose this client or its methods to client-side code
 * - Always validate user permissions before using
 *
 * @throws Error if called from client-side
 */
export function createServiceRoleClient() {
  // Prevent accidental client-side usage
  if (typeof window !== 'undefined') {
    throw new Error(
      'SECURITY ERROR: Service role client cannot be used on the client side. ' +
      'This would expose the service role key and bypass all security policies.'
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
      'This key should only be used server-side for admin operations.'
    )
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
