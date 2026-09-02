import { plaidClient } from '@/lib/plaid/client'
import {
  plaidAccountsGet,
  plaidItemGet,
  plaidItemRemove,
  plaidResetLogin,
  plaidWebhookUpdate,
} from '@/lib/plaid/item'
import { Products } from 'plaid'
import { describe, expect, it, vi } from 'vitest'
import {
  hasPlaidCredentials,
  SANDBOX_INSTITUTION_ID,
  withSandboxItem,
} from '../../support/plaid'

/**
 * The item-scoped endpoints, against a real sandbox item.
 *
 * Every case runs inside `withSandboxItem`, which removes the item afterwards
 * whether or not the body threw. That teardown is not housekeeping — in
 * production the same call revokes a live bank connection, and a suite that
 * treats item cleanup as optional is practising the wrong habit.
 */
describe.skipIf(!hasPlaidCredentials())('item endpoints', () => {
  it('fetches the item and its institution', async () => {
    await withSandboxItem(async ({ accessToken, itemId }) => {
      const result = await plaidItemGet(accessToken)

      expect(result.item.item_id).toBe(itemId)
      expect(result.item.institution_id).toBe(SANDBOX_INSTITUTION_ID)
    })
  })

  it('fetches accounts with the fields the connection flow persists', async () => {
    await withSandboxItem(async ({ accessToken }) => {
      const result = await plaidAccountsGet(accessToken)

      expect(result.accounts.length).toBeGreaterThan(0)

      // `exchangeAndCreateConnection` maps exactly these onto the Account row.
      for (const account of result.accounts) {
        expect(account.account_id).toBeTruthy()
        expect(account).toHaveProperty('name')
        expect(account).toHaveProperty('mask')
        expect(account).toHaveProperty('type')
        expect(account).toHaveProperty('subtype')
      }
    })
  })

  it('sets and clears the item webhook', async () => {
    await withSandboxItem(async ({ accessToken }) => {
      const url = 'https://example.invalid/api/plaid-webhook-handler'

      const updated = await plaidWebhookUpdate(accessToken, url)
      expect(updated.item.webhook).toBe(url)

      // Passing null is how the app detaches a webhook; Plaid reports the
      // cleared value as either null or an empty string depending on the
      // endpoint, so accept both rather than pinning an incidental detail.
      const cleared = await plaidWebhookUpdate(accessToken, null)
      expect(cleared.item.webhook ?? '').toBe('')
    })
  })

  it('resets the login, which is what sets ITEM_LOGIN_REQUIRED', async () => {
    await withSandboxItem(async ({ accessToken }) => {
      const result = await plaidResetLogin(accessToken)

      expect(result.reset_login).toBe(true)

      // The point of the reset: the item now reports the error the app's
      // re-authentication banner keys off.
      const item = await plaidItemGet(accessToken)
      expect(item.item.error?.error_code).toBe('ITEM_LOGIN_REQUIRED')
    })
  })

  /**
   * The private app guarded each sandbox-only endpoint individually. That guard
   * moved up to `plaid/client.ts`, which refuses to initialise at all outside
   * sandbox — so there is no configuration in which any of these functions can
   * reach a real institution, not just this one.
   *
   * Asserted with a fresh module registry because the check runs at import.
   */
  it('refuses to build a Plaid client outside the sandbox', async () => {
    const original = process.env.PLAID_ENV
    process.env.PLAID_ENV = 'production'
    vi.resetModules()

    try {
      await expect(import('@/lib/plaid/client')).rejects.toThrow(
        /PLAID_ENV must be "sandbox"/
      )
    } finally {
      process.env.PLAID_ENV = original
      vi.resetModules()
    }
  })

  it('removes the item, after which the token is rejected', async () => {
    const created = await plaidClient.sandboxPublicTokenCreate({
      institution_id: SANDBOX_INSTITUTION_ID,
      initial_products: [Products.Transactions],
    })
    const exchanged = await plaidClient.itemPublicTokenExchange({
      public_token: created.data.public_token,
    })
    const accessToken = exchanged.data.access_token

    await plaidItemRemove(accessToken)

    // The revoke half of the delete-connection flow: once Plaid has removed the
    // item, the token is dead. `deleteConnection` only runs after this
    // succeeds, which is why the ordering matters.
    await expect(plaidItemGet(accessToken)).rejects.toThrow()
  })
})
