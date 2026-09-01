/**
 * The one error type `src/lib/db/*` throws deliberately.
 *
 * The data layer returns raw data and throws on failure — there is no
 * `ServerResult` below it. But not every failure is the same kind of thing, and
 * the action layer has to tell two of them apart:
 *
 * - A **`DomainError`** is an expected outcome the caller can act on, and its
 *   `message` is written to be shown to the user: "Account not found",
 *   "Holdings are required for investment accounts". `src/lib/actions/*` turns
 *   these into `err(error.message)`, unchanged, and does not report them.
 * - **Anything else** — a Prisma failure, a bug — is a fault. The action layer
 *   logs it and returns the generic `'An unexpected error has occurred'`, so no
 *   raw error detail ever reaches the client.
 *
 * That split is what lets the data layer stay `ServerResult`-free while the
 * user-facing messages the old `callServer` + `err()` code produced survive
 * verbatim. **Only put a message in a `DomainError` if it is safe to show a
 * user** — it will be.
 */
import 'server-only'

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}
