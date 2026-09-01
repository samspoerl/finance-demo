import { NextResponse, type NextRequest } from 'next/server'

/**
 * Creates the anonymous demo session, and is the only place that can: a Server
 * Component cannot set a cookie, so this cannot live in the page where the rest
 * of the session reads happen. Running before the render also means the first
 * page view already has a user to scope queries to.
 */
export async function proxy(request: NextRequest) {
  if (await hasValidSession(request)) {
    return NextResponse.next()
  }

  const response = await fetch(
    new URL('/api/auth/sign-in/anonymous', request.url),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Without this the session records "Next.js Proxy" as the agent, since
        // this call — not the browser — is what reaches Better Auth.
        'user-agent': request.headers.get('user-agent') ?? 'unknown',
      },
      body: '{}',
    }
  )

  const setCookies = response.headers.getSetCookie()

  if (setCookies.length === 0) {
    // Rate-limited, or the database is down. Falling through renders the
    // signed-out state, which beats a 500 on a demo someone just opened.
    console.error(
      `Anonymous sign-in failed: ${response.status} ${response.statusText}`
    )
    return NextResponse.next()
  }

  // Replay onto the request as well as the response, or the render happening
  // right now still sees no session and the first page view is signed out.
  //
  // Replacing by name rather than appending is the whole trick: the request
  // that lands here often already carries a *stale* cookie of the same name,
  // and Better Auth reads the first occurrence. Appending would leave the dead
  // one in front and the render would still be signed out.
  const headers = new Headers(request.headers)
  const pairs = setCookies.map((cookie) => cookie.split(';')[0])
  const names = new Set(pairs.map((pair) => pair.split('=')[0].trim()))
  const kept = (headers.get('cookie') ?? '')
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .filter((cookie) => !names.has(cookie.split('=')[0].trim()))

  headers.set('cookie', [...kept, ...pairs].join('; '))

  const next = NextResponse.next({ request: { headers } })
  for (const cookie of setCookies) {
    next.headers.append('set-cookie', cookie)
  }
  return next
}

/**
 * Asks Better Auth whether the cookie actually resolves to a user, rather than
 * checking that a cookie is merely present.
 *
 * The distinction is load-bearing here in a way it isn't in a normal app. The
 * purge job deletes idle demo users, and session cookies outlive the rows they
 * point at — so a returning visitor arrives with a well-formed cookie for a
 * user that no longer exists. A presence check passes it, sign-in is skipped,
 * and because there is no sign-in UI to fall back on the page is permanently
 * dead for that browser. The same thing happens after any database reset.
 *
 * Costs one internal request per navigation, which is why the matcher below is
 * narrowed to documents.
 */
async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get('cookie')

  if (!cookie) {
    return false
  }

  try {
    const response = await fetch(
      new URL('/api/auth/get-session', request.url),
      { headers: { cookie } }
    )

    if (!response.ok) {
      return false
    }

    const session = await response.json()
    return Boolean(session?.user)
  } catch (error) {
    // Treating a failed check as "no session" would mint a duplicate user on
    // every blip. Treat it as valid and let the page's own guard decide.
    console.error('Session validation failed:', error)
    return true
  }
}

export const config = {
  // Documents only. Excluding `api` matters twice over: this proxy calls two of
  // those routes, and matching them would recurse. The trailing clause drops
  // anything with a file extension, which is every static asset.
  matcher: ['/((?!api|_next/static|_next/image|.*\\.).*)'],
}
