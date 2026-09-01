'use server'

import { actionError } from '@/lib/actions/action-error'
import { revalidateApp } from '@/lib/actions/revalidate'
import * as db from '@/lib/db/balance'
import { ok, ServerResult } from '@/lib/server-result'
import { requireUser } from '@/lib/session'
import { BalanceDto, ManualBalanceCreateDto } from '@/lib/types'

/**
 * Authenticated adapter over `@/lib/db/balance`. See `@/lib/actions/account`
 * for the pattern.
 *
 * The db layer throws `DomainError` with user-facing strings ("Account not
 * found", "Enter a valid balance") and `actionError` passes them through
 * unchanged, so those messages are load-bearing.
 *
 * `createManualHolding` and `getInvestmentManualBalanceHoldings` are gone with
 * the holdings/balance coupling — holdings describe an account, they do not
 * value it.
 */

export async function createManualBalance(
  data: ManualBalanceCreateDto
): Promise<ServerResult<BalanceDto>> {
  try {
    const user = await requireUser()
    const balance = await db.createManualBalance(user.id, data)
    revalidateApp()
    return ok(balance)
  } catch (error) {
    return actionError(error)
  }
}

export async function updateAccountBalance(
  id: number,
  data: db.BalanceUpdateDto
) {
  try {
    const user = await requireUser()
    const balance = await db.updateAccountBalance(user.id, id, data)
    revalidateApp()
    return ok(balance)
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteAccountBalance(id: number) {
  try {
    const user = await requireUser()
    const deleted = await db.deleteAccountBalance(user.id, id)
    revalidateApp()
    return ok(deleted)
  } catch (error) {
    return actionError(error)
  }
}
