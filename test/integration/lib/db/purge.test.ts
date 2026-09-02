import * as db from '@/lib/db/purge'
import prisma from '@/lib/prisma'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAccount,
  createBalance,
  createConnection,
  createUser,
} from '../../support/factories'

/**
 * The purge acts across every user at once, so a wrong predicate deletes other
 * people's data rather than merely failing. These tests pin both directions:
 * what it reaps, and what it must leave alone.
 */

const DAY = 24 * 60 * 60 * 1000

/** Better Auth writes these rows; the factories do not, so build them here. */
async function createSession(userId: string, updatedAt: Date) {
  return prisma.session.create({
    data: {
      userId,
      token: `token-${userId}-${updatedAt.getTime()}`,
      expiresAt: new Date(Date.now() + 7 * DAY),
      updatedAt,
    },
  })
}

async function backdateUser(userId: string, createdAt: Date) {
  await prisma.user.update({ where: { id: userId }, data: { createdAt } })
}

let cutoff: Date

beforeEach(() => {
  cutoff = new Date(Date.now() - 7 * DAY)
})

describe('findIdleUsers', () => {
  it('reaps a user whose newest session predates the cutoff', async () => {
    const user = await createUser()
    await backdateUser(user.id, new Date(Date.now() - 30 * DAY))
    await createSession(user.id, new Date(Date.now() - 10 * DAY))

    const idle = await db.findIdleUsers(cutoff)

    expect(idle.map((u) => u.id)).toEqual([user.id])
  })

  it('spares a user with a session touched after the cutoff', async () => {
    const user = await createUser()
    await backdateUser(user.id, new Date(Date.now() - 30 * DAY))
    await createSession(user.id, new Date(Date.now() - 1 * DAY))

    expect(await db.findIdleUsers(cutoff)).toEqual([])
  })

  it('spares a user whose sessions are mixed but one is recent', async () => {
    const user = await createUser()
    await backdateUser(user.id, new Date(Date.now() - 30 * DAY))
    await createSession(user.id, new Date(Date.now() - 20 * DAY))
    await createSession(user.id, new Date(Date.now() - 2 * DAY))

    expect(await db.findIdleUsers(cutoff)).toEqual([])
  })

  /**
   * The regression the `createdAt` clause exists for. A user created seconds
   * ago has no session row yet, so `sessions: { none: ... }` matches them — and
   * without the age check the purge would delete a visitor mid-signup.
   */
  it('spares a brand-new user who has no session row yet', async () => {
    await createUser()

    expect(await db.findIdleUsers(cutoff)).toEqual([])
  })

  it('reaps an old user who never got a session row', async () => {
    const user = await createUser()
    await backdateUser(user.id, new Date(Date.now() - 30 * DAY))

    const idle = await db.findIdleUsers(cutoff)

    expect(idle.map((u) => u.id)).toEqual([user.id])
  })

  it('returns the connections whose Plaid items must be revoked first', async () => {
    const user = await createUser()
    await backdateUser(user.id, new Date(Date.now() - 30 * DAY))
    const connection = await createConnection(user.id)

    const [idle] = await db.findIdleUsers(cutoff)

    expect(idle.connections).toHaveLength(1)
    expect(idle.connections[0].plaidItemId).toBe(connection.plaidItemId)
    expect(idle.connections[0].plaidAccessToken).toBeTruthy()
  })
})

describe('deleteUsers', () => {
  it('cascades to the accounts and balances underneath', async () => {
    const user = await createUser()
    const account = await createAccount(user.id)
    await createBalance(account.id, user.id, 100, '2026-01-01')

    const deleted = await db.deleteUsers([user.id])

    expect(deleted).toBe(1)
    expect(await prisma.account.count()).toBe(0)
    expect(await prisma.balance.count()).toBe(0)
  })

  it("leaves another user's rows untouched", async () => {
    const doomed = await createUser()
    const survivor = await createUser()
    await createAccount(doomed.id)
    await createAccount(survivor.id)

    await db.deleteUsers([doomed.id])

    const remaining = await prisma.account.findMany({
      select: { userId: true },
    })
    expect(remaining.map((a) => a.userId)).toEqual([survivor.id])
  })

  it('is a no-op for an empty list', async () => {
    await createUser()

    expect(await db.deleteUsers([])).toBe(0)
    expect(await prisma.user.count()).toBe(1)
  })
})
