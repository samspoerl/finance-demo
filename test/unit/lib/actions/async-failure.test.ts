import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Asserts that an asynchronous failure inside a Server Action settles as a
 * `ServerResult` rather than rejecting.
 *
 * The private app carried a defect this guards against: its `callServer`
 * wrapper ended with `return fn(dbUser)` — no `await` — inside its own `try`. A
 * promise returned from a `try` block settles *after* the block has exited, so a
 * rejection from the wrapped body never reached the wrapper's `catch`. Nothing
 * was logged and the caller got a rejected promise instead of a failure result.
 *
 * This app has no wrapper, so it is fixed by construction. "By construction" is
 * exactly the claim worth testing, because this class of bug reads correctly —
 * so the control block below reconstructs the broken shape and proves the
 * harness can tell the two apart.
 */

const logError = vi.fn()

vi.mock('@/lib/errors', () => ({ logError }))

class AuthError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'AuthError'
  }
}

const requireUser = vi.fn(async () => ({ id: 'user_1', name: 'Test' }))

vi.mock('@/lib/session', () => ({ requireUser, AuthError }))

const createManualAccount = vi.fn()
const updateAccount = vi.fn()

vi.mock('@/lib/db/account', () => ({
  createManualAccount,
  updateAccount,
  deleteManualAccount: vi.fn(),
}))

vi.mock('@/lib/actions/revalidate', () => ({ revalidateApp: vi.fn() }))

type AccountActions = typeof import('@/lib/actions/account')

let actions: AccountActions

const ACCOUNT = {
  name: 'Checking',
  type: 'cash',
  subtype: 'checking',
  mask: null,
  institutionId: null,
} as const

/** Rejects on a later tick, so a missing `await` is genuinely observable. */
function rejectAsynchronously(message: string) {
  return async () => {
    await Promise.resolve()
    throw new Error(message)
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.resetModules()
  actions = await import('@/lib/actions/account')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('an async failure inside a server action', () => {
  it('resolves to a ServerResult failure instead of rejecting', async () => {
    createManualAccount.mockImplementation(
      rejectAsynchronously('Neon is unreachable')
    )

    // Not `.rejects` — the whole point is that this settles, and settles as a
    // value the caller can render.
    const result = await actions.createManualAccount(ACCOUNT)

    expect(result).toEqual({
      ok: false,
      message: 'An unexpected error has occurred',
    })
  })

  it('logs the real error', async () => {
    createManualAccount.mockImplementation(
      rejectAsynchronously('Neon is unreachable')
    )

    await actions.createManualAccount(ACCOUNT)

    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Neon is unreachable' })
    )
  })

  it('never puts the raw error message in the client-visible result', async () => {
    updateAccount.mockImplementation(
      rejectAsynchronously('connect ECONNREFUSED 10.0.0.4:5432')
    )

    const result = await actions.updateAccount(7, { name: 'Renamed' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('An unexpected error has occurred')
      expect(result.message).not.toContain('ECONNREFUSED')
    }
  })

  it('does not log an expired session as a fault', async () => {
    requireUser.mockRejectedValueOnce(new AuthError())

    const result = await actions.createManualAccount(ACCOUNT)

    expect(result).toEqual({
      ok: false,
      message: 'An unexpected error has occurred',
    })
    expect(logError).not.toHaveBeenCalled()
  })
})

describe('the shape the deleted wrapper had (control)', () => {
  /**
   * `callServer`, reduced to the line that mattered. If this passed, the tests
   * above would prove nothing — they would be green for a reason other than the
   * `await`.
   */
  async function callServerAsItWas<T>(
    fn: () => Promise<{ ok: boolean; data?: T }>
  ) {
    try {
      return fn() // <- the defect: no `await`
    } catch {
      logError(new Error('handled'))
      return { ok: false, message: 'An unexpected error has occurred' }
    }
  }

  it('lets the rejection escape its own catch', async () => {
    await expect(
      callServerAsItWas(rejectAsynchronously('Neon is unreachable'))
    ).rejects.toThrow('Neon is unreachable')

    expect(logError).not.toHaveBeenCalled()
  })

  it('is fixed by the single added await', async () => {
    async function callServerFixed<T>(
      fn: () => Promise<{ ok: boolean; data?: T }>
    ) {
      try {
        return await fn()
      } catch {
        logError(new Error('handled'))
        return { ok: false, message: 'An unexpected error has occurred' }
      }
    }

    await expect(
      callServerFixed(rejectAsynchronously('Neon is unreachable'))
    ).resolves.toEqual({
      ok: false,
      message: 'An unexpected error has occurred',
    })

    expect(logError).toHaveBeenCalledTimes(1)
  })
})
