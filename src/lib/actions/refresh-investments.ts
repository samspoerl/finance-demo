'use server'

import { actionError } from '@/lib/actions/action-error'
import { revalidateApp } from '@/lib/actions/revalidate'
import { fetchHoldingsForConnection } from '@/lib/plaid/fetch-holdings-for-connection'
import prisma from '@/lib/prisma'
import { connectionWithAccountsInternalSelect } from '@/lib/select-schemas'
import { ok, ServerResult } from '@/lib/server-result'
import { requireUser } from '@/lib/session'

/**
 * Refresh holdings for the signed-in user's investment accounts.
 *
 * Writes `Holding` rows only. It does not touch `Balance` — holdings describe
 * what is in an account, they do not value it.
 *
 * Nothing that touches an access token crosses this boundary: the connections
 * carrying the encrypted token are read and consumed entirely inside this
 * function, and only a row count is returned.
 */
export async function refreshInvestments(): Promise<ServerResult<number>> {
  try {
    const user = await requireUser()

    const connections = await prisma.connection.findMany({
      where: {
        userId: user.id,
        accounts: { some: { type: 'investment' } },
      },
      select: connectionWithAccountsInternalSelect,
    })

    if (connections.length === 0) return ok(0)

    const results = await Promise.all(
      connections.map((connection) => fetchHoldingsForConnection(connection))
    )

    const added = await prisma.holding.createMany({
      data: results.flat(),
      skipDuplicates: true,
    })

    revalidateApp()

    return ok(added.count)
  } catch (error) {
    return actionError(error)
  }
}
