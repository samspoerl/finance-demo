// Verifies, against the value actually handed to the logger rather than by
// reading the code, that no Plaid credential leaves `callPlaid`.
//
// `test/integration/lib/plaid/errors.test.ts` makes the same assertion against a
// real AxiosError from a real failed request, which is stronger evidence. This
// file exists because that one needs Plaid credentials and skips without them —
// on a fork or Dependabot PR it is the only leak coverage that runs.

import type { InternalAxiosRequestConfig } from 'axios'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const logError = vi.fn()
vi.mock('@/lib/errors', () => ({ logError }))

const { callPlaid, PlaidApiError } = await import('@/lib/plaid/errors')

const FAKE_ACCESS_TOKEN = 'access-sandbox-LEAK-CANARY-TOKEN-0001'
const FAKE_PLAID_SECRET = 'PLAID-SECRET-LEAK-CANARY-0002'
const FAKE_CLIENT_ID = 'PLAID-CLIENT-ID-LEAK-CANARY-0003'

/** Everything that must never appear in a logged payload. */
const CREDENTIALS = [FAKE_ACCESS_TOKEN, FAKE_PLAID_SECRET, FAKE_CLIENT_ID]

const PLAID_ERROR_BODY = {
  error_type: 'ITEM_ERROR',
  error_code: 'ITEM_LOGIN_REQUIRED',
  error_message: 'the login details of this item have changed',
  display_message: 'Please reconnect your account.',
  request_id: 'req-canary-0004',
}

function makeAxiosError(status: number, data: unknown): AxiosError {
  // A real AxiosError, so `axios.isAxiosError` passes and the shape matches
  // what the Plaid SDK actually throws.
  const headers = new AxiosHeaders({
    'PLAID-CLIENT-ID': FAKE_CLIENT_ID,
    'PLAID-SECRET': FAKE_PLAID_SECRET,
    'Plaid-Version': '2020-09-14',
    'Content-Type': 'application/json',
  })

  const config = {
    url: 'https://sandbox.plaid.com/accounts/balance/get',
    method: 'post',
    headers,
    // The SDK serializes the request body before sending; this is where the
    // access token lives on the wire.
    data: JSON.stringify({ access_token: FAKE_ACCESS_TOKEN }),
  } as unknown as InternalAxiosRequestConfig

  const request = {
    // `.request` is raw http client state and carries the same material.
    _header: `POST /accounts/balance/get HTTP/1.1\r\nPLAID-SECRET: ${FAKE_PLAID_SECRET}\r\n\r\n`,
    path: '/accounts/balance/get',
  }

  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    request,
    {
      status,
      statusText: 'Bad Request',
      data,
      headers: new AxiosHeaders(),
      config,
    }
  )
}

/** Serializes a logged value as deeply as any log sink plausibly would. */
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

/** Everything `logError` was handed across all calls, serialized. */
function loggedPayload(): string {
  return logError.mock.calls.map((call) => serializeDeeply(call)).join('\n')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('callPlaid', () => {
  it('returns the response data when the call succeeds', async () => {
    const result = await callPlaid(
      async () =>
        ({
          data: { accounts: [] },
        }) as never
    )

    expect(result).toEqual({ accounts: [] })
    expect(logError).not.toHaveBeenCalled()
  })

  it('throws a PlaidApiError carrying the Plaid error code', async () => {
    const failing = () =>
      Promise.reject(makeAxiosError(400, PLAID_ERROR_BODY)) as never

    await expect(callPlaid(failing)).rejects.toBeInstanceOf(PlaidApiError)
    await expect(callPlaid(failing)).rejects.toThrow(
      '[ITEM_ERROR] ITEM_LOGIN_REQUIRED: the login details of this item have changed'
    )
  })

  it('falls back to the HTTP-status message when the body is not a Plaid error', async () => {
    const failing = () =>
      Promise.reject(makeAxiosError(502, '<html>Bad Gateway</html>')) as never

    await expect(callPlaid(failing)).rejects.toThrow(
      'Plaid API error: HTTP 502'
    )
  })

  it('logs no Plaid credential', async () => {
    await expect(
      callPlaid(
        () => Promise.reject(makeAxiosError(400, PLAID_ERROR_BODY)) as never
      )
    ).rejects.toThrow()

    const payload = loggedPayload()
    for (const credential of CREDENTIALS) {
      expect(payload).not.toContain(credential)
    }
  })

  it('does not log an unexpected field from a Plaid response body', async () => {
    await expect(
      callPlaid(
        () =>
          Promise.reject(
            makeAxiosError(400, {
              ...PLAID_ERROR_BODY,
              // Plaid does not send this. If the body were logged verbatim it
              // would ride along.
              surprise_field: 'SURPRISE-CANARY-0005',
            })
          ) as never
      )
    ).rejects.toThrow()

    expect(loggedPayload()).not.toContain('SURPRISE-CANARY-0005')
  })

  it('does not log a non-Plaid response body', async () => {
    // A proxy or WAF answering instead of Plaid. `plaidError` is only a type
    // assertion, so nothing narrows this shape.
    await expect(
      callPlaid(
        () =>
          Promise.reject(
            makeAxiosError(403, { blocked_by: 'WAF-CANARY-0006' })
          ) as never
      )
    ).rejects.toThrow()

    expect(loggedPayload()).not.toContain('WAF-CANARY-0006')
  })

  /**
   * The control. If `callPlaid` were reverted to logging the raw error, would
   * this file notice? It has to, or the assertions above mean nothing.
   */
  it('control: the raw AxiosError does carry the credentials', () => {
    const payload = serializeDeeply(makeAxiosError(400, PLAID_ERROR_BODY))

    for (const credential of CREDENTIALS) {
      expect(payload).toContain(credential)
    }
  })

  it('wraps a non-axios failure as a PlaidApiError', async () => {
    await expect(
      callPlaid(() => Promise.reject(new Error('socket hang up')) as never)
    ).rejects.toThrow('Unknown Plaid API error')
  })
})
