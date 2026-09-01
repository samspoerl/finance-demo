import { Prisma, TransactionType } from '@/generated/prisma/client'
import { plaidClient } from '@/lib/plaid/client'
import { callPlaid } from '@/lib/plaid/errors'
import prisma from '@/lib/prisma'
import { getDecryptedAccessToken } from '@/lib/utils/cipher'
import {
  formatPlaidDetailed,
  formatPlaidPrimary,
  getPrimaryFromDetailed,
} from '@/lib/utils/plaid-categories'
import { Transaction as PlaidTransaction, RemovedTransaction } from 'plaid'
import 'server-only'

const EXCLUDED_CATEGORIES = new Set([
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'LOAN_PAYMENTS',
])

const categoryIdCache = new Map<string, number | null>()

function classifyTransaction(
  plaidPrimary: string | null,
  description: string
): TransactionType {
  if (plaidPrimary === 'INCOME') return 'income'
  if (
    plaidPrimary &&
    EXCLUDED_CATEGORIES.has(plaidPrimary) &&
    !(plaidPrimary === 'TRANSFER_OUT' && description === 'ATM Withdrawal')
  ) {
    return 'excluded'
  }
  return 'expense'
}

/**
 * Upsert a Category row for the given Plaid detailed key and return its id.
 * The primary is resolved from the detailed key if not provided.
 */
async function resolveCategoryId(
  plaidDetailed: string | null
): Promise<number | null> {
  if (!plaidDetailed) return null

  if (categoryIdCache.has(plaidDetailed)) {
    return categoryIdCache.get(plaidDetailed)!
  }

  const plaidPrimary = getPrimaryFromDetailed(plaidDetailed)
  if (!plaidPrimary) {
    categoryIdCache.set(plaidDetailed, null)
    return null
  }

  const row = await prisma.category.upsert({
    where: { plaidDetailed },
    update: {},
    create: {
      plaidPrimary,
      plaidDetailed,
      category: formatPlaidPrimary(plaidPrimary),
      subcategory: formatPlaidDetailed(plaidPrimary, plaidDetailed),
    },
    select: { id: true },
  })
  categoryIdCache.set(plaidDetailed, row.id)
  return row.id
}

interface SyncData {
  added: PlaidTransaction[]
  modified: PlaidTransaction[]
  removed: RemovedTransaction[]
  nextCursor: string | null
}

/**
 * Paginate through all available transaction updates since the last cursor,
 * accumulating added/modified/removed across all pages.
 */
async function fetchNewSyncData(
  accessToken: string,
  initialCursor: string | null
): Promise<SyncData> {
  const added: PlaidTransaction[] = []
  const modified: PlaidTransaction[] = []
  const removed: RemovedTransaction[] = []
  let cursor: string | undefined = initialCursor ?? undefined
  let hasMore = true

  while (hasMore) {
    const response = await callPlaid(() =>
      plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
        options: {
          include_original_description: true,
          days_requested: 730,
        },
      })
    )

    added.push(...response.added)
    modified.push(...response.modified)
    removed.push(...response.removed)
    cursor = response.next_cursor
    hasMore = response.has_more
  }

  return { added, modified, removed, nextCursor: cursor ?? null }
}

async function mapPlaidTransaction(
  t: PlaidTransaction,
  connection: { id: number; userId: string },
  accountMap: Map<string, number>
) {
  const accountId = accountMap.get(t.account_id)
  if (!accountId) return null

  const description = t.original_description ?? t.name
  const plaidPrimary = t.personal_finance_category?.primary ?? null
  const plaidDetailed = t.personal_finance_category?.detailed ?? null
  const categoryId = await resolveCategoryId(plaidDetailed)

  return {
    amount: t.amount,
    authorizedDate: t.authorized_date ?? null,
    date: t.date,
    description,
    originalDescription: description,
    merchantName: t.merchant_name ?? null,
    categoryId,
    type: classifyTransaction(plaidPrimary, description),
    plaidTransactionId: t.transaction_id,
    metadata: t as unknown as Prisma.InputJsonValue,
    source: 'plaid' as const,
    userId: connection.userId,
    connectionId: connection.id,
    accountId,
  }
}

/**
 * Given an item ID, sync all transaction updates for the connection.
 * Called from the webhook handler (SYNC_UPDATES_AVAILABLE) or manually
 * from the debug connections page.
 *
 * Not a Server Action — the webhook route calls it with no session at all. The
 * entry point the client calls is `syncTransactions` in `@/lib/actions/plaid`.
 */
export async function syncTransactions(itemId: string): Promise<void> {
  // Look up the connection and its accounts
  const connection = await prisma.connection.findUniqueOrThrow({
    where: { plaidItemId: itemId },
    select: {
      id: true,
      userId: true,
      plaidAccessToken: true,
      encryptionKeyId: true,
      transactionsCursor: true,
      accounts: {
        select: { id: true, plaidAccountId: true },
      },
    },
  })

  // Build a map of plaidAccountId → internal accountId
  const accountMap = new Map<string, number>()
  for (const account of connection.accounts) {
    if (account.plaidAccountId) {
      accountMap.set(account.plaidAccountId, account.id)
    }
  }

  // Decrypt access token and fetch all transaction updates since the last cursor
  const accessToken = getDecryptedAccessToken(connection)
  const { added, modified, removed, nextCursor } = await fetchNewSyncData(
    accessToken,
    connection.transactionsCursor
  )

  // Process added transactions
  if (added.length > 0) {
    const transactionsToCreate = (
      await Promise.all(
        added.map((t) => mapPlaidTransaction(t, connection, accountMap))
      )
    ).filter((t) => t !== null)

    if (transactionsToCreate.length > 0) {
      await prisma.transaction.createMany({
        data: transactionsToCreate,
        skipDuplicates: true,
      })
    }
  }

  // Process modified transactions
  for (const t of modified) {
    const mapped = await mapPlaidTransaction(t, connection, accountMap)
    if (!mapped) continue

    await prisma.transaction.updateMany({
      where: { plaidTransactionId: mapped.plaidTransactionId },
      data: {
        amount: mapped.amount,
        authorizedDate: mapped.authorizedDate,
        date: mapped.date,
        description: mapped.description,
        originalDescription: mapped.originalDescription,
        merchantName: mapped.merchantName,
        categoryId: mapped.categoryId,
        type: mapped.type,
        accountId: mapped.accountId,
        metadata: mapped.metadata,
      },
    })
  }

  // Process removed transactions
  if (removed.length > 0) {
    const removedIds = removed.map((t) => t.transaction_id)
    await prisma.transaction.deleteMany({
      where: { plaidTransactionId: { in: removedIds } },
    })
  }

  // Persist the cursor for next sync
  await prisma.connection.update({
    where: { id: connection.id },
    data: { transactionsCursor: nextCursor },
  })
}
