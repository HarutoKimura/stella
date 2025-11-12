import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Security middleware for API routes
 *
 * Provides:
 * - CSRF protection via Referer header validation
 * - Origin validation for state-changing operations
 */
export function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl

  // Only apply to API routes
  if (pathname.startsWith('/api/')) {
    // CSRF Protection: Validate referer for state-changing operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const referer = request.headers.get('referer')
      const host = request.headers.get('host')

      // Allow requests from the same origin or no referer (for API clients)
      if (referer) {
        try {
          const refererUrl = new URL(referer)
          const requestHost = host || request.nextUrl.host

          // Check if referer is from the same domain
          if (refererUrl.host !== requestHost) {
            console.warn('[Security] Blocked request with invalid referer:', {
              referer: refererUrl.host,
              expected: requestHost,
              path: pathname,
            })

            return NextResponse.json(
              { error: 'Invalid request origin' },
              { status: 403 }
            )
          }
        } catch (error) {
          // Invalid referer URL
          console.warn('[Security] Blocked request with malformed referer:', referer)
          return NextResponse.json(
            { error: 'Invalid referer header' },
            { status: 403 }
          )
        }
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
