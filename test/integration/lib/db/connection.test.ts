import * as db from '@/lib/db/connection'
import prisma from '@/lib/prisma'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAccount,
  createBalance,
  createConnection,
  createInstitution,
  createTransaction,
  createUser,
} from '../../support/factories'

/**
 * `deleteConnection` is the most dangerous function in `src/lib/db`. Its whole
 * contract is that `Balance` and `Transaction` rows survive the connection that
 * produced them — disconnecting a bank detaches its history, it does not erase
 * it.
 *
 * A unit test with a mocked Prisma cannot check that — `updateMany` versus
 * `deleteMany` is one word, and a mock would happily record either. Only a real
 * database with real cascade rules can. That is most of why this suite exists.
 */

let owner: { id: string }
let stranger: { id: string }

beforeEach(async () => {
  owner = await createUser({ name: 'Owner' })
  stranger = await createUser({ name: 'Stranger' })
})

describe('getConnectionInternalById', () => {
  it('returns the connection for its owner', async () => {
    const connection = await createConnection(owner.id)

    const result = await db.getConnectionInternalById(owner.id, connection.id)

    expect(result.id).toBe(connection.id)
  })

  it("throws for another user's connection", async () => {
    const theirs = await createConnection(stranger.id)

    await expect(
      db.getConnectionInternalById(owner.id, theirs.id)
    ).rejects.toThrow()
  })
})

describe('deleteConnection', () => {
  /**
   * The standing constraint, asserted directly. `Balance` and `Transaction`
   * rows are detached from the connection — `connectionId` set to null — and
   * never deleted.
   */
  it('keeps every balance and transaction row, detached', async () => {
    const connection = await createConnection(owner.id)
    const account = await createAccount(owner.id, {
      connectionId: connection.id,
      connectionType: 'plaid',
    })
    await createBalance(account.id, owner.id, 100, '2026-01-01')
    await createBalance(account.id, owner.id, 200, '2026-02-01')
    await createTransaction(owner.id, account.id, {
      connectionId: connection.id,
    })
    await prisma.balance.updateMany({
      where: { accountId: account.id },
      data: { connectionId: connection.id },
    })

    await db.deleteConnection(owner.id, connection.id)

    const balances = await prisma.balance.findMany({
      where: { accountId: account.id },
      orderBy: { asOfDate: 'asc' },
    })
    expect(balances.map((b) => b.balance)).toEqual([100, 200])
    expect(balances.every((b) => b.connectionId === null)).toBe(true)

    const transactions = await prisma.transaction.findMany({
      where: { accountId: account.id },
    })
    expect(transactions).toHaveLength(1)
    expect(transactions[0].connectionId).toBeNull()
  })

  it('demotes the accounts to manual instead of deleting them', async () => {
    const connection = await createConnection(owner.id)
    const account = await createAccount(owner.id, {
      name: 'Checking',
      connectionId: connection.id,
      connectionType: 'plaid',
    })

    await db.deleteConnection(owner.id, connection.id)

    const result = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    })
    expect(result.name).toBe('Checking')
    expect(result.connectionId).toBeNull()
    expect(result.plaidAccountId).toBeNull()
    expect(result.connectionType).toBe('manual')
  })

  it('removes the connection row itself', async () => {
    const connection = await createConnection(owner.id)

    await db.deleteConnection(owner.id, connection.id)

    expect(
      await prisma.connection.findUnique({ where: { id: connection.id } })
    ).toBeNull()
  })

  /**
   * The module claims the `$transaction` cannot commit unless the caller owns
   * the connection, because the bracketing `account.updateMany` and
   * `connection.delete` are both scoped by `userId`. The middle `updateMany`s
   * filter on `connectionId` alone, so if that claim were wrong this would
   * detach a stranger's balances. It is the reason to test the failure path and
   * not just the happy one.
   */
  it("leaves another user's connection and its rows completely untouched", async () => {
    const institution = await createInstitution()
    const theirs = await createConnection(stranger.id, {
      institutionId: institution.id,
    })
    const theirAccount = await createAccount(stranger.id, {
      connectionId: theirs.id,
      connectionType: 'plaid',
    })
    await createBalance(theirAccount.id, stranger.id, 500, '2026-01-01')
    await prisma.balance.updateMany({
      where: { accountId: theirAccount.id },
      data: { connectionId: theirs.id },
    })

    await expect(db.deleteConnection(owner.id, theirs.id)).rejects.toThrow()

    expect(
      await prisma.connection.findUnique({ where: { id: theirs.id } })
    ).not.toBeNull()

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: theirAccount.id },
    })
    expect(account.connectionId).toBe(theirs.id)
    expect(account.connectionType).toBe('plaid')

    const balances = await prisma.balance.findMany({
      where: { accountId: theirAccount.id },
    })
    expect(balances).toHaveLength(1)
    expect(balances[0].connectionId).toBe(theirs.id)
  })
})
