import { DomainError } from '@/lib/db/errors'
import { logError } from '@/lib/errors'
import { err, type ServerResult } from '@/lib/server-result'
import { AuthError } from '@/lib/session'

/**
 * Maps a thrown error onto the `ServerResult` failure the client expects. Every
 * `catch` block in `src/lib/actions/*` ends with `return actionError(e)`.
 *
 * Deliberately a plain mapping function, not a wrapper: it does not
 * authenticate and it takes no callback, so the `requireUser()` call stays
 * visible in each action rather than hidden behind a helper. It also cannot
 * swallow a rejection the way a callback wrapper can, since the `await` lives
 * at the call site.
 *
 * - `DomainError` — expected and user-safe, so its message passes through
 *   verbatim and nothing is reported.
 * - `AuthError` — an expired session, not a fault; generic message, no report.
 * - Everything else is logged and collapses to the generic message. **Raw error
 *   details never reach the client.**
 */
export function actionError(error: unknown): ServerResult<never> {
  if (error instanceof DomainError) {
    return err(error.message)
  }

  if (!(error instanceof AuthError)) {
    logError(error)
  }

  return err('An unexpected error has occurred')
}
