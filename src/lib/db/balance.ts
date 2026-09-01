import { DomainError } from '@/lib/db/errors'
import prisma from '@/lib/prisma'
import { balanceSelect } from '@/lib/select-schemas'
import { BalanceDto, ManualBalanceCreateDto } from '@/lib/types'
import { normalizeBalance } from '@/lib/utils/account-balance'
import 'server-only'

/**
 * Balance reads and writes. Pure Prisma, `userId` as a parameter —
 * authentication and `ServerResult` wrapping live in `@/lib/actions/balance`.
 *
 * Every query is scoped by `userId`, either on the `Balance` row itself or
 * through the owning `Account`, which is checked for ownership before any write.
 *
 * **Holdings are not written here.** The private app's `createManualBalance`
 * could carry holding rows in the same transaction, and its `createManualHolding`
 * wrote a `Balance` equal to the sum of an account's holdings. Both are gone:
 * an account's value is its `Balance`, holdings only describe what is inside it,
 * and neither is derived from the other.
 */

export interface BalanceUpdateDto {
  balance: number
  asOfDate: Date
}

/** Every snapshot for one account, oldest first, for the history chart. */
export async function getAccountBalanceHistory(userId: string, id: number) {
  const balances = await prisma.balance.findMany({
    select: {
      id: true,
      asOfDate: true,
      balance: true,
    },
    where: {
      accountId: id,
      account: { userId },
    },
    orderBy: { asOfDate: 'asc' },
  })

  return balances.map((snapshot) => ({
    id: snapshot.id,
    asOfDate: snapshot.asOfDate,
    balance: snapshot.balance,
  }))
}

/** Write a manual balance snapshot against an account the user owns. */
export async function createManualBalance(
  userId: string,
  data: ManualBalanceCreateDto
): Promise<BalanceDto> {
  const account = await prisma.account.findUnique({
    select: { id: true },
    where: { id: data.accountId, userId },
  })

  if (!account) {
    throw new DomainError('Account not found')
  }

  if (!Number.isFinite(data.balance)) {
    throw new DomainError('Enter a valid balance')
  }

  return prisma.balance.create({
    select: balanceSelect,
    data: {
      accountId: data.accountId,
      asOfDate: data.asOfDate,
      balance: data.balance,
      source: 'manual',
      userId,
    },
  })
}

export async function updateAccountBalance(
  userId: string,
  id: number,
  data: BalanceUpdateDto
) {
  const existingBalance = await prisma.balance.findFirst({
    where: { id, userId },
    select: { id: true },
  })

  if (!existingBalance) {
    throw new DomainError('Balance not found')
  }

  return prisma.balance.update({ where: { id }, data })
}

export async function deleteAccountBalance(userId: string, id: number) {
  const existingBalance = await prisma.balance.findFirst({
    where: { id, userId },
    select: { id: true },
  })

  if (!existingBalance) {
    throw new DomainError('Balance not found')
  }

  await prisma.balance.delete({ where: { id } })

  return { id }
}

/**
 * Net worth over time: at each date any account was snapshotted, the sum of
 * every account's most recent balance as of that date.
 *
 * The carry-forward is the point. Accounts are snapshotted on different days,
 * so summing only the balances written on a given date would make net worth
 * lurch every time one account reported and the others did not.
 *
 * Liability balances are negated by `normalizeBalance` so they subtract.
 */
export async function getNetWorthHistory(userId: string) {
  const balances = await prisma.balance.findMany({
    select: {
      accountId: true,
      balance: true,
      asOfDate: true,
      account: { select: { type: true } },
    },
    where: { account: { userId } },
    orderBy: [{ asOfDate: 'asc' }, { id: 'asc' }],
  })

  const updatesByDate = new Map<
    number,
    Array<{ accountId: number; adjusted: number }>
  >()

  for (const b of balances) {
    const key = b.asOfDate.getTime()
    const adjusted = normalizeBalance(b.balance, b.account.type)
    const existing = updatesByDate.get(key) ?? []
    existing.push({ accountId: b.accountId, adjusted })
    updatesByDate.set(key, existing)
  }

  const sortedDates = Array.from(updatesByDate.keys()).sort((a, b) => a - b)
  const latestByAccount = new Map<number, number>()
  const history: { balance: number; asOfDate: Date }[] = []

  for (const dateTs of sortedDates) {
    for (const update of updatesByDate.get(dateTs) ?? []) {
      latestByAccount.set(update.accountId, update.adjusted)
    }

    let total = 0
    for (const v of latestByAccount.values()) {
      total += v
    }

    history.push({ balance: total, asOfDate: new Date(dateTs) })
  }

  return history
}
