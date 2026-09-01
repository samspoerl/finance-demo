import prisma from '@/lib/prisma'
import { ConnectionWithAccountsInternal, HoldingCreate } from '@/lib/types'
import { getDecryptedAccessToken } from '@/lib/utils/cipher'
import { InvestmentsHoldingsGetResponse } from 'plaid'
import 'server-only'
import { plaidHoldingsGet } from './item'

export async function fetchHoldingsForConnection(
  connection: ConnectionWithAccountsInternal
): Promise<HoldingCreate[]> {
  const accessToken = getDecryptedAccessToken(connection)
  const plaidRes = await plaidHoldingsGet(accessToken)
  return transformHoldings(plaidRes, connection)
}

async function transformHoldings(
  plaidRes: InvestmentsHoldingsGetResponse,
  connection: ConnectionWithAccountsInternal
) {
  const { holdings, securities } = plaidRes

  const dataToInsert: HoldingCreate[] = []

  for (const h of holdings) {
    const security = securities.find((s) => s.security_id === h.security_id)
    const accountId = connection.accounts.find(
      (a) => a.plaidAccountId === h.account_id
    )?.id

    if (!accountId || !security) continue

    // Search for existing security with same Plaid security ID.
    let existingSecurity = await prisma.security.findFirst({
      where: { plaidSecurityId: security.security_id },
    })

    if (existingSecurity === null) {
      // No security exists - create one.
      existingSecurity = await prisma.security.create({
        data: {
          plaidSecurityId: security.security_id,
          name: security.name,
          type: security.type,
          tickerSymbol: security.ticker_symbol,
          isCashEquivalent: security.is_cash_equivalent ?? undefined,
        },
      })
    }

    // Then, build the holding.
    dataToInsert.push({
      value: h.institution_value,
      asOfDate: new Date(h.institution_price_as_of ?? new Date().toISOString()),
      userId: connection.userId,
      connectionId: connection.id,
      accountId: accountId,
      securityId: existingSecurity.id,
    })
  }

  return dataToInsert
}
