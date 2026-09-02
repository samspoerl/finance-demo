import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertPlaidSandbox,
  hasPlaidCredentials,
} from '../../integration/support/plaid'

/**
 * Covers the Plaid half of `test/integration/support/plaid.ts`, and lives in
 * the unit suite for the same reason the database guard's tests do: it is the
 * check standing between a test run and real, billable Plaid items against real
 * institutions — where `plaidItemRemove` in a teardown would revoke the owner's
 * actual bank connections. It should be verified on every `pnpm run ci`, not
 * only when someone runs the suite it protects.
 *
 * See `./guard.test.ts` for why these sit under `test/unit/integration-support/`
 * rather than mirroring a `src/` path.
 */

let original: { env?: string; production?: string }

beforeEach(() => {
  original = {
    env: process.env.PLAID_ENV,
    production: process.env.PLAID_PRODUCTION_SECRET,
  }
})

afterEach(() => {
  restore('PLAID_ENV', original.env)
  restore('PLAID_PRODUCTION_SECRET', original.production)
})

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

describe('assertPlaidSandbox', () => {
  it('accepts the sandbox with no production secret present', () => {
    process.env.PLAID_ENV = 'sandbox'
    delete process.env.PLAID_PRODUCTION_SECRET

    expect(() => assertPlaidSandbox()).not.toThrow()
  })

  it('refuses production', () => {
    process.env.PLAID_ENV = 'production'
    delete process.env.PLAID_PRODUCTION_SECRET

    expect(() => assertPlaidSandbox()).toThrow(/must be "sandbox"/)
  })

  it('refuses an unset PLAID_ENV rather than defaulting', () => {
    delete process.env.PLAID_ENV
    delete process.env.PLAID_PRODUCTION_SECRET

    expect(() => assertPlaidSandbox()).toThrow(/\(unset\)/)
  })

  /**
   * Not redundant with the check above: a production secret in the environment
   * means a live credential is one edited line away from being the one used.
   */
  it('refuses the sandbox when a production secret is also present', () => {
    process.env.PLAID_ENV = 'sandbox'
    process.env.PLAID_PRODUCTION_SECRET = 'not-a-real-secret'

    expect(() => assertPlaidSandbox()).toThrow(/PLAID_PRODUCTION_SECRET is set/)
  })

  it('never puts the production secret in the error message', () => {
    process.env.PLAID_ENV = 'sandbox'
    process.env.PLAID_PRODUCTION_SECRET = 'canary-secret-value'

    expect(() => assertPlaidSandbox()).not.toThrow(/canary-secret-value/)
  })
})

describe('hasPlaidCredentials', () => {
  const keys = ['PLAID_CLIENT_ID', 'PLAID_SANDBOX_SECRET'] as const
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  })

  afterEach(() => {
    for (const key of keys) restore(key, saved[key])
  })

  it('is true only when both credentials are present', () => {
    process.env.PLAID_CLIENT_ID = 'id'
    process.env.PLAID_SANDBOX_SECRET = 'secret'
    expect(hasPlaidCredentials()).toBe(true)
  })

  // The fork / Dependabot case: repository secrets are unavailable, so the
  // Plaid specs skip instead of failing the run.
  it('is false when the secret is missing', () => {
    process.env.PLAID_CLIENT_ID = 'id'
    delete process.env.PLAID_SANDBOX_SECRET
    expect(hasPlaidCredentials()).toBe(false)
  })

  it('is false when the client id is missing', () => {
    delete process.env.PLAID_CLIENT_ID
    process.env.PLAID_SANDBOX_SECRET = 'secret'
    expect(hasPlaidCredentials()).toBe(false)
  })
})
