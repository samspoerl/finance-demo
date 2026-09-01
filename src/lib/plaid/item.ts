import { plaidClient } from '@/lib/plaid/client'
import { callPlaid } from '@/lib/plaid/errors'
import {
  AccountsGetResponse,
  InvestmentsHoldingsGetResponse,
  ItemGetResponse,
  SandboxItemResetLoginResponse,
} from 'plaid'
import 'server-only'

// Item-scoped Plaid endpoints. Every function here takes an already-decrypted
// access token as an argument and never returns one: decryption is the caller's
// job (it happens at the action or route boundary, right before the call), and
// nothing in this module hands a token back out where it could be serialized
// toward a client.

export async function plaidItemGet(
  accessToken: string
): Promise<ItemGetResponse> {
  return callPlaid(() =>
    plaidClient.itemGet({
      access_token: accessToken,
    })
  )
}

export async function plaidItemRemove(accessToken: string) {
  return callPlaid(() =>
    plaidClient.itemRemove({
      access_token: accessToken,
    })
  )
}

export async function plaidWebhookUpdate(
  accessToken: string,
  newWebhook: string | null
) {
  return callPlaid(() =>
    plaidClient.itemWebhookUpdate({
      access_token: accessToken,
      webhook: newWebhook,
    })
  )
}

export async function plaidAccountsGet(
  accessToken: string
): Promise<AccountsGetResponse> {
  return callPlaid(() =>
    plaidClient.accountsGet({
      access_token: accessToken,
    })
  )
}

export async function plaidHoldingsGet(
  accessToken: string
): Promise<InvestmentsHoldingsGetResponse> {
  return callPlaid(() =>
    plaidClient.investmentsHoldingsGet({
      access_token: accessToken,
    })
  )
}

/**
 * Puts a sandbox item into the ITEM_LOGIN_REQUIRED state, so Link's update mode
 * can be exercised. No environment guard: `client.ts` refuses to start outside
 * sandbox, so there is no configuration in which this reaches a real bank.
 */
export async function plaidResetLogin(
  accessToken: string
): Promise<SandboxItemResetLoginResponse> {
  return callPlaid(() =>
    plaidClient.sandboxItemResetLogin({
      access_token: accessToken,
    })
  )
}
