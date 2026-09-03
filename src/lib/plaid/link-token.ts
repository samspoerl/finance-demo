import { plaidClient } from '@/lib/plaid/client'
import { callPlaid } from '@/lib/plaid/errors'
import {
  CountryCode,
  LinkTokenCreateRequest,
  LinkTokenCreateResponse,
  Products,
} from 'plaid'
import 'server-only'

export interface CreateLinkTokenParams {
  /** Plaid's `client_user_id` — our user id. */
  clientUserId: string
  /**
   * A decrypted access token, which switches Link into Update Mode.
   *
   * Passed in rather than looked up here: the connection lookup has to be
   * scoped by the signed-in user's id to be safe, and this module has no
   * session. The caller owns both the ownership check and the decryption.
   */
  accessToken?: string
}

export async function createLinkToken({
  clientUserId,
  accessToken,
}: CreateLinkTokenParams): Promise<LinkTokenCreateResponse> {
  const requestParams: LinkTokenCreateRequest = {
    user: {
      client_user_id: clientUserId,
    },
    client_name: 'Personal Finance Demo',
    language: 'en',
    // The products array must have at least one entry and Balance is not a
    // valid value. Consenting to Investments and Liabilities without making
    // them required avoids charges for an item that has neither.
    products: [Products.Transactions],
    additional_consented_products: [Products.Investments, Products.Liabilities],
    country_codes: [CountryCode.Us],
    redirect_uri:
      process.env.PLAID_REDIRECT_URI ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'),
    webhook:
      process.env.PLAID_WEBHOOK_URI ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/plaid-webhook-handler`
        : 'http://localhost:3000/api/plaid-webhook-handler'),
    // The full window Plaid offers. The net worth chart is reconstructed by
    // walking these transactions backward from today's balance, so the history
    // requested here is the history the chart can show.
    transactions: {
      days_requested: 730,
    },
  }

  // A passed access token indicates Update Mode.
  //
  // Deliberately `!== undefined` rather than a truthiness check: a legacy
  // connection row can decrypt to an empty string, and on `if (accessToken)`
  // that would fall through to new-item mode — an "Update" click would mint a
  // second billable Plaid item instead of repairing the existing one, silently.
  // An empty token has to reach Plaid and be rejected there.
  if (accessToken !== undefined) {
    requestParams.access_token = accessToken
    requestParams.products = []
    requestParams.additional_consented_products = undefined
  }

  return callPlaid(() => plaidClient.linkTokenCreate(requestParams))
}
