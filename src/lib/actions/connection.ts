'use server'

import { actionError } from '@/lib/actions/action-error'
import { revalidateApp } from '@/lib/actions/revalidate'
import * as db from '@/lib/db/connection'
import { plaidClient } from '@/lib/plaid/client'
import { plaidItemRemove } from '@/lib/plaid/item'
import { err, ok, ServerResult } from '@/lib/server-result'
import { requireUser } from '@/lib/session'
import { getDecryptedAccessToken } from '@/lib/utils/cipher'

/**
 * Authenticated adapter over `@/lib/db/connection` — see
 * `@/lib/actions/account` for the pattern.
 *
 * More than the five-line adapter, deliberately: the flow is Plaid-then-Prisma
 * and `src/lib/db/*` is pure Prisma. The access token is decrypted at this
 * boundary, immediately before the Plaid call, and is never part of a returned
 * value.
 */

function getPlaidErrorCode(error: unknown): string | null {
  if (
    error != null &&
    typeof error === 'object' &&
    'response' in error &&
    error.response != null &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data != null &&
    typeof error.response.data === 'object' &&
    'error_code' in error.response.data &&
    typeof error.response.data.error_code === 'string'
  ) {
    return error.response.data.error_code
  }
  return null
}

/**
 * Revoke a Plaid item, confirm the revoke, then delete the connection locally.
 *
 * **The ordering is the safety property.** Moving the local delete ahead of the
 * Plaid call would strand a live, billable item with no token left to revoke it
 * with. The confirmation step calls `plaidClient.itemGet` directly rather than
 * `plaidItemGet`, because it needs the raw axios error to read `error_code` and
 * `callPlaid` would already have collapsed it into a message string.
 */
export async function deleteConnection(
  connectionId: number
): Promise<ServerResult<void>> {
  try {
    const user = await requireUser()

    const connection = await db.getConnectionInternalById(user.id, connectionId)
    const accessToken = getDecryptedAccessToken(connection)

    await plaidItemRemove(accessToken)

    try {
      await plaidClient.itemGet({ access_token: accessToken })
      return err(
        'Connection could not be confirmed as removed by Plaid. Please try again.'
      )
    } catch (error) {
      if (getPlaidErrorCode(error) !== 'ITEM_NOT_FOUND') {
        return err(
          'An unexpected error occurred while confirming removal with Plaid.'
        )
      }
    }

    await db.deleteConnection(user.id, connectionId)
    revalidateApp()

    return ok()
  } catch (error) {
    return actionError(error)
  }
}
