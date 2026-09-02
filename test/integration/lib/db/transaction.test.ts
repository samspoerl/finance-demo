import * as db from '@/lib/db/transaction'
import prisma from '@/lib/prisma'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAccount,
  createCategory,
  createTransaction,
  createUser,
} from '../../support/factories'

let owner: { id: string }
let stranger: { id: string }
let ownerAccount: { id: number }
let strangerAccount: { id: number }

beforeEach(async () => {
  owner = await createUser({ name: 'Owner' })
  stranger = await createUser({ name: 'Stranger' })
  ownerAccount = await createAccount(owner.id, { name: 'Mine' })
  strangerAccount = await createAccount(stranger.id, { name: 'Theirs' })
})

describe('getRecentTransactions', () => {
  it("never returns another user's transactions", async () => {
    await createTransaction(owner.id, ownerAccount.id, { description: 'Mine' })
    await createTransaction(stranger.id, strangerAccount.id, {
      description: 'Theirs',
    })

    const result = await db.getRecentTransactions(owner.id)

    expect(result.map((t) => t.description)).toEqual(['Mine'])
  })

  /**
   * Plaid's convention is positive = debit; the UI's is positive = credit. The
   * flip happens in the mapper, not the query, so it is worth pinning that a
   * real round trip through Postgres preserves it.
   */
  it('flips the sign from the Plaid convention to the UI convention', async () => {
    await createTransaction(owner.id, ownerAccount.id, { amount: 25 })

    const [result] = await db.getRecentTransactions(owner.id)

    expect(result.amount).toBe(-25)
  })

  it('returns the newest first and caps at ten', async () => {
    for (let day = 1; day <= 12; day++) {
      await createTransaction(owner.id, ownerAccount.id, {
        date: `2026-01-${String(day).padStart(2, '0')}`,
        description: `Day ${day}`,
      })
    }

    const result = await db.getRecentTransactions(owner.id)

    expect(result).toHaveLength(10)
    expect(result[0].description).toBe('Day 12')
    expect(result.at(-1)?.description).toBe('Day 3')
  })
})

describe('getAccountTransactions', () => {
  it('returns only the requested account', async () => {
    const other = await createAccount(owner.id, { name: 'Other' })
    await createTransaction(owner.id, ownerAccount.id, { description: 'Here' })
    await createTransaction(owner.id, other.id, { description: 'Elsewhere' })

    const result = await db.getAccountTransactions(owner.id, ownerAccount.id)

    expect(result.map((t) => t.description)).toEqual(['Here'])
  })

  it("returns nothing for another user's account", async () => {
    await createTransaction(stranger.id, strangerAccount.id)

    const result = await db.getAccountTransactions(owner.id, strangerAccount.id)

    expect(result).toEqual([])
  })
})

describe('getAllTransactions', () => {
  it('pages through the user`s transactions and reports the total', async () => {
    for (let n = 0; n < 3; n++) {
      await createTransaction(owner.id, ownerAccount.id, {
        description: `T${n}`,
      })
    }
    await createTransaction(stranger.id, strangerAccount.id)

    const page = await db.getAllTransactions(owner.id, 0)

    expect(page.transactions).toHaveLength(3)
    // The stranger's row must not be counted either.
    expect(page.total).toBe(3)
  })

  it('returns an empty page past the end', async () => {
    await createTransaction(owner.id, ownerAccount.id)

    const page = await db.getAllTransactions(owner.id, 1)

    expect(page.transactions).toEqual([])
    expect(page.total).toBe(1)
  })
})

describe('getCategories', () => {
  it('returns shared reference data, unscoped by design', async () => {
    await createCategory({ subcategory: 'Coffee' })
    await createCategory({ subcategory: 'Alcohol' })

    const result = await db.getCategories()

    expect(result.map((c) => c.subcategory)).toEqual(['Alcohol', 'Coffee'])
  })
})

describe('updateTransaction', () => {
  it('updates a transaction the user owns', async () => {
    const transaction = await createTransaction(owner.id, ownerAccount.id, {
      description: 'Old',
    })

    await db.updateTransaction(owner.id, transaction.id, {
      description: 'New',
    })

    const result = await prisma.transaction.findUniqueOrThrow({
      where: { id: transaction.id },
    })
    expect(result.description).toBe('New')
  })

  it('clears the category when categoryId is null', async () => {
    const category = await createCategory()
    const transaction = await createTransaction(owner.id, ownerAccount.id, {
      categoryId: category.id,
    })

    await db.updateTransaction(owner.id, transaction.id, { categoryId: null })

    const result = await prisma.transaction.findUniqueOrThrow({
      where: { id: transaction.id },
    })
    expect(result.categoryId).toBeNull()
  })

  /**
   * `updateMany` with a `userId` filter matches zero rows rather than throwing,
   * so this is silent — the caller gets no error and nothing changes. Pinned so
   * the silence is a documented property and not a surprise: it is the reason
   * the action layer cannot distinguish "not yours" from "no such row", and the
   * reason a future `update` (singular) here would be a behaviour change.
   */
  it("silently changes nothing for another user's transaction", async () => {
    const theirs = await createTransaction(stranger.id, strangerAccount.id, {
      description: 'Theirs',
    })

    await expect(
      db.updateTransaction(owner.id, theirs.id, { description: 'Hijacked' })
    ).resolves.toBeUndefined()

    const result = await prisma.transaction.findUniqueOrThrow({
      where: { id: theirs.id },
    })
    expect(result.description).toBe('Theirs')
  })
})

describe('getTransactionsForHistory', () => {
  it('returns raw Plaid-convention amounts, not the display-flipped ones', async () => {
    await createTransaction(owner.id, ownerAccount.id, {
      amount: 40,
      date: '2026-03-10',
    })

    const [raw] = await db.getTransactionsForHistory(
      owner.id,
      new Date('2026-01-01')
    )
    const [displayed] = await db.getRecentTransactions(owner.id)

    // The whole point of this function: the two disagree, deliberately.
    expect(raw.amount).toBe(40)
    expect(displayed.amount).toBe(-40)
  })

  it('excludes transactions before the cutoff', async () => {
    await createTransaction(owner.id, ownerAccount.id, { date: '2025-12-31' })
    await createTransaction(owner.id, ownerAccount.id, { date: '2026-01-02' })

    const rows = await db.getTransactionsForHistory(
      owner.id,
      new Date('2026-01-01')
    )

    expect(rows.map((r) => r.date)).toEqual(['2026-01-02'])
  })

  it("never returns another user's transactions", async () => {
    await createTransaction(owner.id, ownerAccount.id, { date: '2026-02-01' })
    await createTransaction(stranger.id, strangerAccount.id, {
      date: '2026-02-01',
    })

    const rows = await db.getTransactionsForHistory(
      owner.id,
      new Date('2026-01-01')
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].accountId).toBe(ownerAccount.id)
  })
})
