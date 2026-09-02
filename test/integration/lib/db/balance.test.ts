import * as db from '@/lib/db/balance'
import { DomainError } from '@/lib/db/errors'
import prisma from '@/lib/prisma'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAccount,
  createBalance,
  createUser,
} from '../../support/factories'

/**
 * `getNetWorthHistory` is the reason most of this file exists. Its carry-forward
 * is easy to state and easy to get subtly wrong, and the failure is silent — a
 * chart that dips whenever one account reports and the others do not.
 */

let owner: { id: string }
let stranger: { id: string }

beforeEach(async () => {
  owner = await createUser({ name: 'Owner' })
  stranger = await createUser({ name: 'Stranger' })
})

describe('getAccountBalanceHistory', () => {
  it('returns snapshots oldest first', async () => {
    const account = await createAccount(owner.id)
    await createBalance(account.id, owner.id, 300, '2026-03-01')
    await createBalance(account.id, owner.id, 100, '2026-01-01')
    await createBalance(account.id, owner.id, 200, '2026-02-01')

    const history = await db.getAccountBalanceHistory(owner.id, account.id)

    expect(history.map((h) => h.balance)).toEqual([100, 200, 300])
  })

  it("returns nothing for another user's account", async () => {
    const theirs = await createAccount(stranger.id)
    await createBalance(theirs.id, stranger.id, 100, '2026-01-01')

    const history = await db.getAccountBalanceHistory(owner.id, theirs.id)

    expect(history).toEqual([])
  })
})

describe('createManualBalance', () => {
  it('writes a manual snapshot', async () => {
    const account = await createAccount(owner.id)

    const balance = await db.createManualBalance(owner.id, {
      accountId: account.id,
      balance: 1234,
      asOfDate: new Date('2026-05-01'),
    })

    expect(balance.balance).toBe(1234)
    expect(balance.source).toBe('manual')
    expect(balance.userId).toBe(owner.id)
  })

  it("refuses another user's account", async () => {
    const theirs = await createAccount(stranger.id)

    await expect(
      db.createManualBalance(owner.id, {
        accountId: theirs.id,
        balance: 1,
        asOfDate: new Date('2026-05-01'),
      })
    ).rejects.toThrow(DomainError)
  })

  it('rejects a non-finite balance', async () => {
    const account = await createAccount(owner.id)

    await expect(
      db.createManualBalance(owner.id, {
        accountId: account.id,
        balance: Number.NaN,
        asOfDate: new Date('2026-05-01'),
      })
    ).rejects.toThrow(DomainError)
  })

  it('writes no holdings, even for an investment account', async () => {
    const account = await createAccount(owner.id, { type: 'investment' })

    await db.createManualBalance(owner.id, {
      accountId: account.id,
      balance: 500,
      asOfDate: new Date('2026-05-01'),
    })

    expect(await prisma.holding.count()).toBe(0)
  })
})

describe('updateAccountBalance', () => {
  it('updates a snapshot the user owns', async () => {
    const account = await createAccount(owner.id)
    const balance = await createBalance(account.id, owner.id, 100, '2026-01-01')

    const updated = await db.updateAccountBalance(owner.id, balance.id, {
      balance: 250,
      asOfDate: new Date('2026-01-02'),
    })

    expect(updated.balance).toBe(250)
  })

  it("refuses another user's snapshot", async () => {
    const theirs = await createAccount(stranger.id)
    const balance = await createBalance(
      theirs.id,
      stranger.id,
      100,
      '2026-01-01'
    )

    await expect(
      db.updateAccountBalance(owner.id, balance.id, {
        balance: 999,
        asOfDate: new Date('2026-01-02'),
      })
    ).rejects.toThrow(DomainError)

    const untouched = await prisma.balance.findUniqueOrThrow({
      where: { id: balance.id },
    })
    expect(untouched.balance).toBe(100)
  })
})

describe('deleteAccountBalance', () => {
  it('deletes a snapshot the user owns', async () => {
    const account = await createAccount(owner.id)
    const balance = await createBalance(account.id, owner.id, 100, '2026-01-01')

    await db.deleteAccountBalance(owner.id, balance.id)

    expect(await prisma.balance.count()).toBe(0)
  })

  it("refuses to delete another user's snapshot", async () => {
    const theirs = await createAccount(stranger.id)
    const balance = await createBalance(
      theirs.id,
      stranger.id,
      100,
      '2026-01-01'
    )

    await expect(db.deleteAccountBalance(owner.id, balance.id)).rejects.toThrow(
      DomainError
    )

    expect(await prisma.balance.count()).toBe(1)
  })
})

describe('getNetWorthHistory', () => {
  it('carries the last known balance of each account forward', async () => {
    const a = await createAccount(owner.id, { name: 'A' })
    const b = await createAccount(owner.id, { name: 'B' })

    await createBalance(a.id, owner.id, 100, '2026-01-01')
    await createBalance(b.id, owner.id, 50, '2026-02-01')

    const history = await db.getNetWorthHistory(owner.id)

    // On 2026-02-01 only B reported. A's 100 must still count, or the line
    // would dip to 50 on a day nothing actually changed.
    expect(history.map((h) => h.balance)).toEqual([100, 150])
  })

  it('negates liability balances', async () => {
    const asset = await createAccount(owner.id, { type: 'cash' })
    const card = await createAccount(owner.id, { type: 'credit card' })

    await createBalance(asset.id, owner.id, 1000, '2026-01-01')
    await createBalance(card.id, owner.id, 400, '2026-01-01')

    const history = await db.getNetWorthHistory(owner.id)

    expect(history.at(-1)?.balance).toBe(600)
  })

  it('treats an unrecognised account type as an asset', async () => {
    const account = await createAccount(owner.id, { type: 'something-new' })
    await createBalance(account.id, owner.id, 100, '2026-01-01')

    const history = await db.getNetWorthHistory(owner.id)

    expect(history.at(-1)?.balance).toBe(100)
  })

  it("excludes another user's accounts", async () => {
    const mine = await createAccount(owner.id)
    const theirs = await createAccount(stranger.id)

    await createBalance(mine.id, owner.id, 100, '2026-01-01')
    await createBalance(theirs.id, stranger.id, 900, '2026-01-01')

    const history = await db.getNetWorthHistory(owner.id)

    expect(history.at(-1)?.balance).toBe(100)
  })

  it('returns an empty series when there are no balances', async () => {
    await createAccount(owner.id)

    expect(await db.getNetWorthHistory(owner.id)).toEqual([])
  })
})
