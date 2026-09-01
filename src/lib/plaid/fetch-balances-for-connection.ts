import { plaidClient } from '@/lib/plaid/client'
import { callPlaid } from '@/lib/plaid/errors'
import { BalanceInsertDto, ConnectionWithAccountsInternal } from '@/lib/types'
import { getDecryptedAccessToken } from '@/lib/utils/cipher'
import 'server-only'

export async function fetchBalancesForConnection(
  connection: ConnectionWithAccountsInternal,
  hardRefresh?: boolean
) {
  const accessToken = getDecryptedAccessToken(connection)

  // `accountsBalanceGet` forces Plaid to pull a fresh balance from the
  // institution; `accountsGet` returns whatever it already had. The private app
  // also passed `min_last_updated_datetime` for Capital One, which is a
  // production institution quirk with no sandbox equivalent.
  const plaidRes = await callPlaid(() =>
    hardRefresh
      ? plaidClient.accountsBalanceGet({ access_token: accessToken })
      : plaidClient.accountsGet({ access_token: accessToken })
  )

  const asOfDate = new Date()

  const balancesToAdd: BalanceInsertDto[] = []
  for (const plaidAccount of plaidRes.accounts) {
    const balance = plaidAccount.balances.current
    if (balance === null) {
      continue
    }

    const currentAccountId = connection.accounts.find(
      (a) => a.plaidAccountId === plaidAccount.account_id
    )?.id

    if (currentAccountId === undefined) {
      continue
    }

    balancesToAdd.push({
      balance: balance,
      asOfDate: asOfDate,
      source: 'plaid',
      userId: connection.userId,
      connectionId: connection.id,
      accountId: currentAccountId,
    })
  }

  return balancesToAdd
}
