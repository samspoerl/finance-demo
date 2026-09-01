'use server'

import { actionError } from '@/lib/actions/action-error'
import { revalidateApp } from '@/lib/actions/revalidate'
import * as db from '@/lib/db/transaction'
import { ok, ServerResult } from '@/lib/server-result'
import { requireUser } from '@/lib/session'
import { AllTransactionsPageDto, CategoryDto } from '@/lib/types'
import { z } from 'zod'

/**
 * Authenticated adapter over `@/lib/db/transaction`. See
 * `@/lib/actions/account` for the pattern.
 *
 * `getAllTransactions` is a read that stays an action because the transactions
 * table renders its first page from the server fetch and asks for later pages
 * one click at a time. `getCategories` is shared reference data, still guarded
 * for the same reason as `getInstitutions`.
 */

/**
 * The private app forwarded this payload to Prisma as given and documented the
 * hole: a Server Action id is reachable by direct POST, so a hand-crafted body
 * could carry `amount`, `accountId`, or `userId` and Prisma would apply them.
 * A TypeScript type is erased at runtime and stops none of that.
 *
 * Parsing here closes it. `.strict()` is the load-bearing part — without it an
 * unknown key passes through untouched, which is exactly the attack.
 */
const transactionUpdateSchema = z
  .object({
    description: z.string().trim().min(1).max(200).optional(),
    merchantName: z.string().trim().max(200).nullable().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    type: z.enum(['income', 'expense', 'excluded']).optional(),
  })
  .strict()

export async function getAllTransactions(
  page: number
): Promise<ServerResult<AllTransactionsPageDto>> {
  try {
    const user = await requireUser()
    return ok(await db.getAllTransactions(user.id, page))
  } catch (error) {
    return actionError(error)
  }
}

export async function getCategories(): Promise<ServerResult<CategoryDto[]>> {
  try {
    await requireUser()
    return ok(await db.getCategories())
  } catch (error) {
    return actionError(error)
  }
}

export async function updateTransaction(
  transactionId: number,
  data: db.TransactionUpdateDto
): Promise<ServerResult<void>> {
  try {
    const user = await requireUser()

    const parsed = transactionUpdateSchema.safeParse(data)
    if (!parsed.success) {
      return { ok: false, message: 'Invalid transaction update' }
    }

    await db.updateTransaction(user.id, transactionId, parsed.data)
    revalidateApp()
    return ok()
  } catch (error) {
    return actionError(error)
  }
}
