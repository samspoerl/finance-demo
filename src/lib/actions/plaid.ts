'use server'

import { actionError } from '@/lib/actions/action-error'
import { revalidateApp } from '@/lib/actions/revalidate'
import { createLinkToken as plaidCreateLinkToken } from '@/lib/plaid/link-token'
import { saveInitialBalances as plaidSaveInitialBalances } from '@/lib/plaid/save-initial-balances'
import { syncTransactions as plaidSyncTransactions } from '@/lib/plaid/sync-transactions'
import prisma from '@/lib/prisma'
import { connectionInternalSelect } from '@/lib/select-schemas'
import { ok, ServerResult } from '@/lib/server-result'
import { requireUser } from '@/lib/session'
import { getDecryptedAccessToken } from '@/lib/utils/cipher'
import { LinkTokenCreateResponse } from 'plaid'

/**
 * Server Action entry points for the Plaid flows a client component invokes.
 *
 * `src/lib/plaid/` below this file is plain server-side code: no `'use server'`,
 * no session lookup, explicit arguments. This module is the only Plaid surface
 * exposed as an action id, which makes it the only place an unauthenticated
 * POST can arrive — and the only file to audit when asking "what Plaid work can
 * a browser trigger?".
 *
 * Access tokens are decrypted here, immediately before the Plaid call, and are
 * never part of any returned value.
 */

/**
 * Passing a `connectionId` launches Link in Update Mode for that connection,
 * which requires the item's access token. The lookup is scoped to the caller's
 * `userId`, so a forged `connectionId` cannot open Update Mode against someone
 * else's item.
 */
export async function createLinkToken(
  connectionId?: number
): Promise<ServerResult<LinkTokenCreateResponse>> {
  try {
    const user = await requireUser()

    let accessToken: string | undefined
    if (connectionId) {
      const connection = await prisma.connection.findUniqueOrThrow({
        where: { id: connectionId, userId: user.id },
        select: connectionInternalSelect,
      })
      accessToken = getDecryptedAccessToken(connection)
    }

    const linkToken = await plaidCreateLinkToken({
      clientUserId: user.id,
      accessToken,
    })

    return ok(linkToken)
  } catch (error: unknown) {
    return actionError(error)
  }
}

/**
 * Called fire-and-forget after `exchangeAndCreateConnection` has persisted the
 * encrypted token, so this only ever runs against an item whose token is at
 * rest.
 */
export async function saveInitialBalances(plaidItemId: string): Promise<void> {
  await requireUser()
  await plaidSaveInitialBalances(plaidItemId)
  revalidateApp()
}

/**
 * Run a `/transactions/sync` pass. Called once right after a connection is
 * created, to activate the SYNC_UPDATES_AVAILABLE webhook. The webhook handler
 * calls `@/lib/plaid/sync-transactions` directly instead — it has no session,
 * and is authenticated by Plaid's JWT.
 */
export async function syncTransactions(plaidItemId: string): Promise<void> {
  await requireUser()
  await plaidSyncTransactions(plaidItemId)
  revalidateApp()
}
