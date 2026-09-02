import { TransactionType } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import {
  categorySelect,
  transactionWithCategorySelect,
} from '@/lib/select-schemas'
import { ALL_TRANSACTIONS_PAGE_SIZE } from '@/lib/types/income-statement'
import { changeSign } from '@/lib/utils/converters'
import 'server-only'

/**
 * Transaction reads and the one editable-fields write. Pure Prisma, `userId` as
 * a parameter — authentication and `ServerResult` wrapping live in
 * `@/lib/actions/transaction`.
 *
 * There is no `delete` or `deleteMany` here and none should be added: Plaid's
 * `/transactions/sync` cursor only moves forward, so history deleted locally
 * does not come back. The `updateMany` in `updateTransaction` is a *scoped
 * single-row update*, not a bulk one — it matches on the primary key and the
 * owner together, which `update` cannot express in one call. Never widen that
 * `where`.
 *
 * `TransactionUpdateDto` is a compile-time constraint only; the action layer
 * parses the payload with Zod before it reaches here, because a Server Action
 * id is reachable by direct POST and Prisma would otherwise apply whatever
 * fields a hand-crafted body carried.
 *
 * Amounts on every read are flipped from Plaid's convention (positive = debit)
 * to the UI's (positive = credit / income). The write path never touches
 * `amount`.
 *
 * `getCategories` is the deliberate exception to the `userId`-first rule: the
 * category taxonomy is shared reference data with no owner. Authentication is
 * still enforced by `requireUser()` in the action.
 */

export interface TransactionUpdateDto {
  description?: string
  merchantName?: string | null
  categoryId?: number | null
  type?: TransactionType
}

/** The 10 most recent transactions across all accounts, for the summary list. */
export async function getRecentTransactions(userId: string) {
  const transactions = await prisma.transaction.findMany({
    select: {
      ...transactionWithCategorySelect,
      account: { select: { name: true } },
    },
    where: { userId },
    orderBy: { date: 'desc' },
    take: 10,
  })
  return transactions.map((t) => ({ ...t, amount: changeSign(t.amount) }))
}

/** All transactions for one account, newest first. */
export async function getAccountTransactions(
  userId: string,
  accountId: number
) {
  const transactions = await prisma.transaction.findMany({
    select: transactionWithCategorySelect,
    where: { accountId, userId },
    orderBy: { date: 'desc' },
  })
  return transactions.map((t) => ({ ...t, amount: changeSign(t.amount) }))
}

/** A page of transactions across all accounts, newest first. */
export async function getAllTransactions(userId: string, page: number) {
  const [transactions, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      select: {
        ...transactionWithCategorySelect,
        account: { select: { name: true } },
      },
      where: { userId },
      orderBy: { date: 'desc' },
      skip: page * ALL_TRANSACTIONS_PAGE_SIZE,
      take: ALL_TRANSACTIONS_PAGE_SIZE,
    }),
    prisma.transaction.count({ where: { userId } }),
  ])
  return {
    transactions: transactions.map((t) => ({
      ...t,
      amount: changeSign(t.amount),
    })),
    total,
  }
}

/**
 * The ledger behind the reconstructed net worth chart, from `since` onward.
 *
 * **Returns raw Plaid-convention amounts — positive is money leaving the
 * account — unlike every other read in this file, which flips the sign for
 * display.** `reconstructNetWorthHistory` runs the account arithmetic in
 * reverse and expects the convention the balances were produced under. Flipping
 * here to match its neighbours would invert the whole chart, silently and
 * smoothly.
 */
export async function getTransactionsForHistory(userId: string, since: Date) {
  return prisma.transaction.findMany({
    select: { accountId: true, date: true, amount: true },
    where: {
      userId,
      // `date` is a `YYYY-MM-DD` string, which sorts and compares lexically in
      // exactly the same order as chronologically.
      date: { gte: since.toISOString().slice(0, 10) },
    },
    orderBy: { date: 'desc' },
  })
}

/** Shared reference data — the one function here with no `userId`. */
export async function getCategories() {
  return prisma.category.findMany({
    select: categorySelect,
    orderBy: [{ plaidPrimary: 'asc' }, { subcategory: 'asc' }],
  })
}

/**
 * Update editable fields on a transaction the user owns. A null `categoryId`
 * clears the category.
 */
export async function updateTransaction(
  userId: string,
  transactionId: number,
  data: TransactionUpdateDto
) {
  await prisma.transaction.updateMany({
    where: { id: transactionId, userId },
    data,
  })
}
