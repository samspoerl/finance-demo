import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Relative, not aliased: tsconfig maps one alias per top-level *directory*, and
// `proxy.ts` is a lone file at the root of `src/`. A single-file alias just to
// spell this import differently is not worth the exception.
import { proxy } from '../../src/proxy'

/**
 * The proxy's one job is to turn "no session" into "session" before the page
 * renders. It decides whether that worked by reading the sign-in response, and
 * the interesting failures are the ones where that response is a lie.
 *
 * Vercel's deployment protection is the worked example. The sign-in call is made
 * by the server, so it carries none of the browser's credentials and is refused
 * even when the visitor is authenticated in the tab — and the refusal arrives as
 * `401` *with* a `Set-Cookie: _vercel_sso_nonce=…`. The original check was
 * `setCookies.length === 0`, which reads that as a successful sign-in, replays
 * an SSO nonce as though it were a session, and logs nothing. The control block
 * at the bottom reconstructs that check and proves these tests can tell the two
 * apart.
 */

const SESSION_COOKIE =
  '__Secure-better-auth.session_token=abc123; Path=/; HttpOnly; Secure; SameSite=Lax'

const SSO_NONCE =
  '_vercel_sso_nonce=909dd8ef; Max-Age=3600; Path=/; Secure; HttpOnly; SameSite=Lax'

/** A sign-in response, described by what it sets rather than by how it is built. */
function signInResponse({
  status = 200,
  cookies = [] as string[],
} = {}): Response {
  const headers = new Headers()
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response('{}', { status, headers })
}

/** `{ user: … }` is what `hasValidSession` reads; `null` means signed out. */
const noSession = () => new Response('null', { status: 200 })

/**
 * Answers the proxy's two internal calls by path, so a test states only the one
 * it cares about.
 */
function mockFetch(signIn: Response, getSession: () => Response = noSession) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    return url.includes('/sign-in/anonymous') ? signIn : getSession()
  })
}

function requestWithCookie(cookie?: string) {
  return new NextRequest('https://preview.example.com/', {
    headers: cookie ? { cookie } : {},
  })
}

let errors: string[]

beforeEach(() => {
  errors = []
  vi.spyOn(console, 'error').mockImplementation((message: string) => {
    errors.push(String(message))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('a sign-in refused by something in front of the app', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      mockFetch(signInResponse({ status: 401, cookies: [SSO_NONCE] }))
    )
  })

  it('is not mistaken for a session just because it set a cookie', async () => {
    const response = await proxy(requestWithCookie('_vercel_jwt=xyz'))

    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('never replays the gateway cookie onto the request', async () => {
    const response = await proxy(requestWithCookie('_vercel_jwt=xyz'))

    // The header the render would read. An SSO nonce arriving here as though it
    // were a session is the whole defect.
    const replayed = response.headers.get('x-middleware-override-headers')
    expect(replayed ?? '').not.toContain('cookie')
  })

  it('says so in the log, with the status and what was actually set', async () => {
    await proxy(requestWithCookie('_vercel_jwt=xyz'))

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('401')
    expect(errors[0]).toContain('_vercel_sso_nonce')
  })
})

describe('a sign-in that genuinely succeeded', () => {
  it('replays the session cookie onto the response', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(signInResponse({ cookies: [SESSION_COOKIE] }))
    )

    const response = await proxy(requestWithCookie())

    expect(response.headers.getSetCookie()).toEqual([SESSION_COOKIE])
    expect(errors).toEqual([])
  })

  it('accepts the unprefixed cookie name too, as served over http locally', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        signInResponse({ cookies: ['better-auth.session_token=abc; Path=/'] })
      )
    )

    const response = await proxy(requestWithCookie())

    expect(response.headers.getSetCookie()).toHaveLength(1)
    expect(errors).toEqual([])
  })

  it('is skipped entirely when the cookie already resolves to a user', async () => {
    const fetchMock = mockFetch(
      signInResponse({ cookies: [SESSION_COOKIE] }),
      () => new Response(JSON.stringify({ user: { id: 'user_1' } }))
    )
    vi.stubGlobal('fetch', fetchMock)

    await proxy(requestWithCookie('__Secure-better-auth.session_token=live'))

    const calls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(calls.some((url) => url.includes('/sign-in/anonymous'))).toBe(false)
  })
})

describe('a sign-in that set no cookie at all (database down)', () => {
  it('still falls through to the signed-out render, and logs', async () => {
    vi.stubGlobal('fetch', mockFetch(signInResponse({ status: 500 })))

    const response = await proxy(requestWithCookie())

    expect(response.headers.getSetCookie()).toEqual([])
    expect(errors[0]).toContain('500')
    expect(errors[0]).toContain('none')
  })
})

describe('the check as it was (control)', () => {
  /**
   * If this passed, the tests above would prove nothing — they would be green
   * for a reason other than the guard.
   */
  const acceptedByTheOldCheck = (setCookies: string[]) => setCookies.length > 0

  it('reads the protection 401 as a successful sign-in', () => {
    expect(acceptedByTheOldCheck([SSO_NONCE])).toBe(true)
  })

  it('cannot tell an SSO nonce from a session cookie', () => {
    expect(acceptedByTheOldCheck([SSO_NONCE])).toBe(
      acceptedByTheOldCheck([SESSION_COOKIE])
    )
  })
})
