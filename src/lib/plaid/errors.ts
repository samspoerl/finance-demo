// `errors.ts` and `client.ts` are the two modules every other file in
// `src/lib/plaid/` imports, directly or transitively. Guarding both is what
// makes the directory genuinely unreachable from a client bundle rather than
// only mostly unreachable.

import 'server-only'

import { logError } from '@/lib/errors'
import axios, { AxiosResponse } from 'axios'

interface PlaidErrorResponse {
  error_type: string
  error_code: string
  error_message: string
  display_message: string | null
  request_id: string
}

/**
 * The single place that turns an opaque axios failure into a typed error
 * callers can branch on. Everything that talks to Plaid goes through here.
 *
 * **Never log the raw error or the raw response body.** An `AxiosError` holds
 * the outbound request on `.config` — `.config.data` carries `access_token`,
 * `.config.headers` carries `PLAID-SECRET` — and again on `.response.config`.
 * `plaidError` below is `error.response.data` with a type assertion and nothing
 * validating it, so an unexpected field from Plaid (or from a proxy that
 * answered instead of Plaid) would be logged verbatim. Every value logged here
 * is one this file named on purpose; keep it that way.
 *
 * The thrown `PlaidApiError` does keep the raw error as its `cause`, because
 * callers rely on it for local debugging. That is safe only as long as nothing
 * serializes the cause chain into a log or an analytics payload.
 */
export async function callPlaid<T>(
  fn: () => Promise<AxiosResponse<T>>
): Promise<T> {
  try {
    const plaidRes = await fn()
    return plaidRes.data
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const plaidError = error.response?.data as PlaidErrorResponse | undefined

      const message = plaidError?.error_code
        ? `[${plaidError.error_type}] ${plaidError.error_code}: ${plaidError.error_message}`
        : `Plaid API error: HTTP ${error.response?.status ?? 'unknown'}`

      logError(
        {
          error_type: plaidError?.error_type ?? null,
          error_code: plaidError?.error_code ?? null,
          error_message: plaidError?.error_message ?? null,
          request_id: plaidError?.request_id ?? null,
          http_status: error.response?.status ?? null,
          axios_code: error.code ?? null,
        },
        '[Plaid Error]'
      )

      throw new PlaidApiError(message, { cause: error })
    }

    // Logged as-is, deliberately: this branch is only reached when the failure
    // is not an axios error, so there is no `.config` to strip, and the unknown
    // shape is the whole value of the report.
    logError(error, '[Plaid Error] non-axios failure')

    throw new PlaidApiError('Unknown Plaid API error', {
      cause: error instanceof Error ? error : undefined,
    })
  }
}

/**
 * A failure communicating with Plaid. Thrown inside `callPlaid` and caught at
 * the action or route boundary, which turns it into a generic client message.
 */
export class PlaidApiError extends Error {
  constructor(message: string)
  constructor(message: string, options: ErrorOptions)
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PlaidApiError'
  }
}
