import { fetchBalancesForConnection } from '@/lib/plaid/fetch-balances-for-connection'
import prisma from '@/lib/prisma'
import { connectionWithAccountsInternalSelect } from '@/lib/select-schemas'
import 'server-only'

/**
 * Fetch and persist an initial balance snapshot for a newly connected Plaid item.
 * Called fire-and-forget after a successful Plaid Link flow — by which point
 * the item's access token is already encrypted and persisted, which is why this
 * can look the connection up by `plaidItemId` at all.
 *
 * Not a Server Action; the entry point the client calls is
 * `saveInitialBalances` in `@/lib/actions/plaid`.
 */
export async function saveInitialBalances(plaidItemId: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({
    where: { plaidItemId },
    select: connectionWithAccountsInternalSelect,
  })

  const balancesToAdd = await fetchBalancesForConnection(connection)

  if (balancesToAdd.length === 0) {
    return
  }

  await prisma.balance.createMany({ data: balancesToAdd })
}
