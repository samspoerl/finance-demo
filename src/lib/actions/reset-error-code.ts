'use server'

import { actionError } from '@/lib/actions/action-error'
import { revalidateApp } from '@/lib/actions/revalidate'
import prisma from '@/lib/prisma'
import { ok } from '@/lib/server-result'
import { requireUser } from '@/lib/session'

/**
 * Clear the stored Plaid error code for an item, after Link's Update Mode has
 * repaired it.
 *
 * **Scoped by `userId`, unlike the private app's version**, which matched on
 * `plaidItemId` alone. That was tolerable among a handful of trusted household
 * users; here every visitor is an anonymous stranger and the action id is
 * reachable by direct POST, so an unscoped `updateMany` would let anyone clear
 * anyone's error state by guessing an item id.
 */
export async function resetItemErrorCode(plaidItemId: string) {
  try {
    const user = await requireUser()

    const result = await prisma.connection.updateMany({
      data: { plaidErrorCode: null },
      where: { plaidItemId, userId: user.id },
    })

    revalidateApp()

    return ok(result)
  } catch (error) {
    return actionError(error)
  }
}
