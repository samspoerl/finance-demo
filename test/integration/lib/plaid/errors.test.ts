import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasPlaidCredentials } from '../../support/plaid'

/**
 * Credential-leak regression, run against a **real** `AxiosError`.
 *
 * `test/unit/lib/plaid/errors.test.ts` covers the same ground, but has to
 * construct the axios error by hand — so it proves the redaction works on the
 * shape the test author believed axios produces. This file gets the shape axios
 * and the Plaid SDK actually produce, from a real failed request, with a real
 * `PLAID-SECRET` on `.config.headers` and a real access token serialized into
 * `.config.data`. Those are the two credentials that must never reach a log.
 *
 * The private app wrote this against Sentry. The sink changed, the property did
 * not: Vercel logs are a third-party destination too, and `logError` is the one
 * door everything goes through.
 *
 * The canary token below is deliberately distinctive so a leak is unambiguous;
 * the secret is the real one from the environment, asserted absent and never
 * printed.
 */

const logError = vi.fn()

vi.mock('@/lib/errors', () => ({ logError }))

/** Recognisable in any serialization, and not a real Plaid token. */
const CANARY_TOKEN = 'access-sandbox-CANARY-LEAK-DETECTOR-0000'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/**
 * Everything a log serializer could plausibly reach: own enumerable properties,
 * plus `toJSON` if one is defined. `AxiosError.prototype.toJSON` exists and
 * *includes* `config`, which is exactly the hazard.
 */
function serializeDeeply(value: unknown): string {
  const parts: string[] = []

  if (value instanceof Error) {
    parts.push(value.name, value.message, value.stack ?? '')
  }

  const seen = new WeakSet<object>()
  parts.push(
    JSON.stringify(value, (_key, v: unknown) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]'
        seen.add(v)
      }
      return v
    }) ?? ''
  )

  const maybeToJson = (value as { toJSON?: () => unknown })?.toJSON
  if (typeof maybeToJson === 'function') {
    parts.push(JSON.stringify(maybeToJson.call(value)) ?? '')
  }

  if (typeof value === 'object' && value !== null) {
    for (const key of Object.getOwnPropertyNames(value)) {
      parts.push(key)
      try {
        parts.push(String((value as Record<string, unknown>)[key]))
      } catch {
        // A throwing getter is not a leak.
      }
    }
  }

  return parts.join('\n')
}

describe.skipIf(!hasPlaidCredentials())('callPlaid', () => {
  it('normalizes a real Plaid failure into a typed PlaidApiError', async () => {
    const { callPlaid, PlaidApiError } = await import('@/lib/plaid/errors')
    const { plaidClient } = await import('@/lib/plaid/client')

    const promise = callPlaid(() =>
      plaidClient.accountsGet({ access_token: CANARY_TOKEN })
    )

    await expect(promise).rejects.toBeInstanceOf(PlaidApiError)
    await expect(promise).rejects.toThrow(/INVALID_ACCESS_TOKEN/)
  })

  it('logs the structured Plaid fields', async () => {
    const { callPlaid } = await import('@/lib/plaid/errors')
    const { plaidClient } = await import('@/lib/plaid/client')

    await expect(
      callPlaid(() => plaidClient.accountsGet({ access_token: CANARY_TOKEN }))
    ).rejects.toThrow()

    expect(logError).toHaveBeenCalledTimes(1)
    const logged = logError.mock.calls[0][0] as Record<string, unknown>

    expect(logged.error_code).toBe('INVALID_ACCESS_TOKEN')
    expect(logged.error_type).toBe('INVALID_INPUT')
    expect(logged.request_id).toBeTruthy()
  })

  /**
   * The actual security assertion. What reaches `logError` must be a plain
   * object of fields this codebase named — no `config`, no `request`, no
   * `response` — so no serializer, present or future, can walk from it to the
   * credentials.
   */
  it('logs neither the access token nor the Plaid secret', async () => {
    const { callPlaid } = await import('@/lib/plaid/errors')
    const { plaidClient } = await import('@/lib/plaid/client')

    await expect(
      callPlaid(() => plaidClient.accountsGet({ access_token: CANARY_TOKEN }))
    ).rejects.toThrow()

    expect(logError).toHaveBeenCalledTimes(1)
    const logged = logError.mock.calls[0][0]

    expect(logged).not.toHaveProperty('config')
    expect(logged).not.toHaveProperty('request')
    expect(logged).not.toHaveProperty('response')
    expect(logged).not.toHaveProperty('isAxiosError')

    const serialized = serializeDeeply(logged)
    expect(serialized).not.toContain(CANARY_TOKEN)
    expect(serialized).not.toContain(process.env.PLAID_SANDBOX_SECRET!)
    expect(serialized).not.toContain(process.env.PLAID_CLIENT_ID!)
  })

  /**
   * The control. If the code under test were reverted to logging the raw
   * `AxiosError`, would this file notice? It has to, or the assertions above
   * mean nothing — so prove the same serializer *does* find the credentials on
   * the error the redaction protects against.
   */
  it('control: the raw AxiosError does carry both credentials', async () => {
    const { plaidClient } = await import('@/lib/plaid/client')

    const raw = await plaidClient
      .accountsGet({ access_token: CANARY_TOKEN })
      .then(
        () => {
          throw new Error('expected the request to fail')
        },
        (error: unknown) => error
      )

    const serialized = serializeDeeply(raw)

    expect(serialized).toContain(CANARY_TOKEN)
    expect(serialized).toContain(process.env.PLAID_SANDBOX_SECRET!)
  })

  it("keeps the raw AxiosError as the thrown error's cause, for callers", async () => {
    const { callPlaid } = await import('@/lib/plaid/errors')
    const { plaidClient } = await import('@/lib/plaid/client')

    const error = await callPlaid(() =>
      plaidClient.accountsGet({ access_token: CANARY_TOKEN })
    ).then(
      () => {
        throw new Error('expected the request to fail')
      },
      (e: unknown) => e as Error
    )

    // Deliberate: callers branch on this, and only what is *logged* was
    // narrowed. Pinned so the distinction stays intentional.
    expect(error.cause).toBeDefined()
  })
})
