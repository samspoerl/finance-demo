import { auth, type User } from '@/lib/auth'
import { headers } from 'next/headers'
import { cache } from 'react'

/**
 * The one place that reads the session cookie, so there is one place to audit
 * when the policy changes.
 *
 * There is no auth bypass here, for dev or preview. Every query in `src/lib/db`
 * is scoped by `userId`, so "skip the session check" does not mean "see the app
 * without a session" — it means run every query with an undefined owner.
 */

/** Memoized per render pass, so the cookie is decoded once and not per caller. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
)

/**
 * Expected, not exceptional: a session that expired between page render and
 * form submit. Distinct from a bare Error so callers can tell the two apart.
 */
export class AuthError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Guards a Server Action entry point. Throws rather than redirecting: a
 * `redirect()` inside an action travels back to the caller's `await`, where a
 * client-side try/catch would swallow it and the navigation would silently
 * never happen.
 *
 * Middleware has normally already created a session by the time anything calls
 * this, so in practice it fires only on a direct POST to an action id, or when
 * anonymous sign-in failed upstream.
 */
export async function requireUser(): Promise<DemoUser> {
  const session = await getSession()

  if (!session?.user) {
    throw new AuthError()
  }

  return toDemoUser(session.user)
}

/** The app's view of the signed-in user. */
export interface DemoUser {
  id: string
  name: string
}

function toDemoUser(user: User): DemoUser {
  return { id: user.id, name: user.name }
}
