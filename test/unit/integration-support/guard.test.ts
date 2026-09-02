import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertLocalDatabase } from '../../integration/support/guard'

/**
 * Covers `test/integration/support/guard.ts`.
 *
 * A deliberate deviation from the "specs mirror the `src/` path of what they
 * cover" rule: the guard is test-support code, not app code, so there is no
 * `src/` path to mirror — hence `test/unit/integration-support/`, which mirrors
 * `test/integration/support/` instead.
 *
 * It lives in the **unit** suite on purpose. The guard is the thing standing
 * between `TRUNCATE TABLE ... CASCADE` and a year of irreplaceable `Balance`
 * rows, and it is pure logic over `process.env` with no database of its own. Put
 * here, it is verified by every `pnpm run ci` — including on a machine that never
 * starts Docker and never runs the suite it protects. Put in the integration
 * suite, the one check nobody can afford to skip would be the one that only runs
 * when the risky thing is already running.
 *
 * These cases are the control for the whole harness: `test/integration/
 * harness.test.ts` asserts the suite reaches the local database, but that would
 * also pass if the guard were a no-op. This asserts it refuses everything else.
 */

const LOCAL_URL =
  'postgresql://postgres:postgres@localhost:5433/personal_finance_demo_test?schema=public'

/** Shaped like the real thing in `.env`, with an obviously-fake host and credential. */
const NEON_URL =
  'postgresql://neondb_owner:not-a-real-password@ep-fake-host-00000000-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'

let original: { database?: string; direct?: string }

beforeEach(() => {
  original = {
    database: process.env.DATABASE_URL,
    direct: process.env.DIRECT_URL,
  }
})

afterEach(() => {
  restore('DATABASE_URL', original.database)
  restore('DIRECT_URL', original.direct)
})

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

describe('assertLocalDatabase', () => {
  it('accepts the local Docker Postgres', () => {
    process.env.DATABASE_URL = LOCAL_URL
    process.env.DIRECT_URL = LOCAL_URL

    expect(() => assertLocalDatabase()).not.toThrow()
  })

  it('accepts 127.0.0.1 as well as localhost', () => {
    const loopback = LOCAL_URL.replace('localhost', '127.0.0.1')
    process.env.DATABASE_URL = loopback
    process.env.DIRECT_URL = loopback

    expect(() => assertLocalDatabase()).not.toThrow()
  })

  it('refuses a Neon DATABASE_URL', () => {
    process.env.DATABASE_URL = NEON_URL
    process.env.DIRECT_URL = LOCAL_URL

    expect(() => assertLocalDatabase()).toThrow(/DATABASE_URL must point at/)
  })

  // `prisma.config.ts` runs `migrate deploy` against DIRECT_URL, so a guard that
  // only checked DATABASE_URL would leave the migration free to hit production.
  it('refuses a Neon DIRECT_URL even when DATABASE_URL is local', () => {
    process.env.DATABASE_URL = LOCAL_URL
    process.env.DIRECT_URL = NEON_URL

    expect(() => assertLocalDatabase()).toThrow(/DIRECT_URL must point at/)
  })

  // The host check alone is not enough: a developer may well run their own
  // Postgres on localhost, and it would be full of real rows.
  it('refuses a different database on localhost', () => {
    const otherDb = LOCAL_URL.replace(
      'personal_finance_demo_test',
      'personal_finance_app'
    )
    process.env.DATABASE_URL = otherDb
    process.env.DIRECT_URL = otherDb

    expect(() => assertLocalDatabase()).toThrow(/must point at the local/)
  })

  it('refuses an unset URL', () => {
    delete process.env.DATABASE_URL
    process.env.DIRECT_URL = LOCAL_URL

    expect(() => assertLocalDatabase()).toThrow(/\(unset\)/)
  })

  it('never puts the rejected password in the error message', () => {
    process.env.DATABASE_URL = NEON_URL
    process.env.DIRECT_URL = LOCAL_URL

    expect(() => assertLocalDatabase()).toThrow(/:\*\*\*@/)
    expect(() => assertLocalDatabase()).not.toThrow(/not-a-real-password/)
  })
})
