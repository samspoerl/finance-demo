import * as db from '@/lib/db/account'
import { DomainError } from '@/lib/db/errors'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAccount,
  createBalance,
  createConnection,
  createInstitution,
  createUser,
} from '../../support/factories'

/**
 * `src/lib/db/account.ts` says scoping is the whole job of the file. These are
 * the tests that hold it to that: every read is checked against a second user's
 * data sitting in the same tables, because a `where` clause that quietly matches
 * too much is invisible in a unit test with a mocked Prisma and obvious here.
 *
 * That matters more here than it did in the private app. There, a leak exposed
 * one household member's accounts to another; here every user is a stranger.
 */

let owner: { id: string }
let stranger: { id: string }

beforeEach(async () => {
  owner = await createUser({ name: 'Owner' })
  stranger = await createUser({ name: 'Stranger' })
})

describe('getAccounts', () => {
  it("never returns another user's account", async () => {
    await createAccount(owner.id, { name: 'Mine' })
    await createAccount(stranger.id, { name: 'Theirs' })

    const accounts = await db.getAccounts(owner.id)

    expect(accounts.map((a) => a.name)).toEqual(['Mine'])
  })

  it('attaches only the most recent balance snapshot', async () => {
    const account = await createAccount(owner.id)
    await createBalance(account.id, owner.id, 100, '2026-01-01')
    await createBalance(account.id, owner.id, 250, '2026-02-01')

    const [result] = await db.getAccounts(owner.id)

    expect(result.currentBalance).toBe(250)
    expect(result.currentBalanceAsOfDate).toEqual(new Date('2026-02-01'))
  })

  it('reports a null balance for an account with no snapshots', async () => {
    await createAccount(owner.id)

    const [result] = await db.getAccounts(owner.id)

    expect(result.currentBalance).toBeNull()
    expect(result.currentBalanceAsOfDate).toBeNull()
  })

  it('prefers the institution name over the Plaid name', async () => {
    const institution = await createInstitution({
      name: 'Chosen',
      plaidInstitutionName: 'From Plaid',
    })
    await createAccount(owner.id, { institutionId: institution.id })

    const [result] = await db.getAccounts(owner.id)

    expect(result.institutionName).toBe('Chosen')
  })

  it('falls back to the Plaid institution name', async () => {
    const institution = await createInstitution({
      plaidInstitutionName: 'From Plaid',
    })
    await createAccount(owner.id, { institutionId: institution.id })

    const [result] = await db.getAccounts(owner.id)

    expect(result.institutionName).toBe('From Plaid')
  })
})

describe('getAccountById', () => {
  it('returns the account with its latest balance', async () => {
    const account = await createAccount(owner.id, { name: 'Mine' })
    await createBalance(account.id, owner.id, 42, '2026-01-01')

    const result = await db.getAccountById(owner.id, account.id)

    expect(result.name).toBe('Mine')
    expect(result.currentBalance).toBe(42)
  })

  it("throws DomainError for another user's account", async () => {
    const theirs = await createAccount(stranger.id)

    await expect(db.getAccountById(owner.id, theirs.id)).rejects.toThrow(
      DomainError
    )
  })
})

describe('createManualAccount', () => {
  it('creates a manual account owned by the caller', async () => {
    const account = await db.createManualAccount(owner.id, {
      name: 'Cash',
      type: 'cash',
      subtype: 'checking',
      mask: '1234',
      institutionId: null,
    })

    expect(account.userId).toBe(owner.id)
    expect(account.connectionType).toBe('manual')
  })
})

describe('updateAccount', () => {
  it('updates a manual account', async () => {
    const account = await createAccount(owner.id, { name: 'Before' })

    const updated = await db.updateAccount(owner.id, account.id, {
      name: 'After',
    })

    expect(updated.name).toBe('After')
  })

  it("refuses another user's account", async () => {
    const theirs = await createAccount(stranger.id, { name: 'Theirs' })

    await expect(
      db.updateAccount(owner.id, theirs.id, { name: 'Hijacked' })
    ).rejects.toThrow(DomainError)
  })

  it('ignores institutionId on a connected account', async () => {
    const connection = await createConnection(owner.id)
    const institution = await createInstitution()
    const account = await createAccount(owner.id, {
      connectionId: connection.id,
      connectionType: 'plaid',
    })

    const updated = await db.updateAccount(owner.id, account.id, {
      institutionId: institution.id,
    })

    expect(updated.institutionId).toBeNull()
  })

  it('allows institutionId on a manual account', async () => {
    const institution = await createInstitution()
    const account = await createAccount(owner.id)

    const updated = await db.updateAccount(owner.id, account.id, {
      institutionId: institution.id,
    })

    expect(updated.institutionId).toBe(institution.id)
  })
})

describe('deleteManualAccount', () => {
  it('deletes a manual account', async () => {
    const account = await createAccount(owner.id)

    await db.deleteManualAccount(owner.id, account.id)

    expect(await db.getAccounts(owner.id)).toEqual([])
  })

  it("refuses another user's account", async () => {
    const theirs = await createAccount(stranger.id)

    await expect(db.deleteManualAccount(owner.id, theirs.id)).rejects.toThrow(
      DomainError
    )
  })

  it('refuses a Plaid-connected account', async () => {
    const connection = await createConnection(owner.id)
    const account = await createAccount(owner.id, {
      connectionId: connection.id,
      connectionType: 'plaid',
    })

    await expect(db.deleteManualAccount(owner.id, account.id)).rejects.toThrow(
      DomainError
    )
  })
})

describe('getAccountSummaries', () => {
  it("never returns another user's account", async () => {
    await createAccount(owner.id, { name: 'Mine' })
    await createAccount(stranger.id, { name: 'Theirs' })

    const summaries = await db.getAccountSummaries(owner.id)

    expect(summaries.map((s) => s.name)).toEqual(['Mine'])
  })

  it('reports the newest balance and defaults a balance-less account to 0', async () => {
    const withBalance = await createAccount(owner.id, { name: 'Funded' })
    await createBalance(withBalance.id, owner.id, 10, '2026-01-01')
    await createBalance(withBalance.id, owner.id, 75, '2026-03-01')
    await createAccount(owner.id, { name: 'Empty' })

    const summaries = await db.getAccountSummaries(owner.id)
    const byName = Object.fromEntries(summaries.map((s) => [s.name, s.balance]))

    expect(byName).toEqual({ Funded: 75, Empty: 0 })
  })

  it('omits holdings for non-investment accounts', async () => {
    await createAccount(owner.id, { type: 'cash' })

    const [summary] = await db.getAccountSummaries(owner.id)

    expect(summary.holdings).toBeUndefined()
  })
})
