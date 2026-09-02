import { plaidClient } from '@/lib/plaid/client'
import { CountryCode, Products } from 'plaid'

/**
 * Safety guard and helpers for the Plaid half of the integration suite.
 *
 * The database guard (`./guard.ts`) protects rows that cannot be re-fetched.
 * This one protects something different: **money and live bank connections.**
 * `src/lib/plaid/client.ts` picks its secret from `PLAID_ENV`, so a suite that
 * ran with `PLAID_ENV=production` would create real, billable Plaid items
 * against real institutions — and `plaidItemRemove` in a test teardown would be
 * revoking the owner's actual bank connections.
 *
 * `vitest.integration.config.mts` pins `PLAID_ENV=sandbox` so no ambient value
 * can change it; `assertPlaidSandbox` is the second check, and it runs before
 * every sandbox item is created.
 */

/** Plaid's standard sandbox institution, "First Platypus Bank". */
export const SANDBOX_INSTITUTION_ID = 'ins_109508'

/**
 * Refuse to touch Plaid unless this is unmistakably the sandbox.
 *
 * The production-secret check is not redundant with the `PLAID_ENV` one: a
 * `PLAID_PRODUCTION_SECRET` sitting in the environment means a live credential
 * is one edited line away from being the one that gets used. If it is present,
 * this is not a machine the suite should be creating items from.
 */
export function assertPlaidSandbox(): void {
  if (process.env.PLAID_ENV !== 'sandbox') {
    throw new Error(
      `Refusing to run Plaid integration tests: PLAID_ENV must be "sandbox", ` +
        `got "${process.env.PLAID_ENV ?? '(unset)'}".`
    )
  }

  if (process.env.PLAID_PRODUCTION_SECRET) {
    throw new Error(
      'Refusing to run Plaid integration tests: PLAID_PRODUCTION_SECRET is ' +
        'set. Run these only where no production credential is available.'
    )
  }
}

/**
 * Whether sandbox credentials are available at all.
 *
 * Specs gate on this with `describe.skipIf(...)` so a fork or a Dependabot PR —
 * neither of which can read repository secrets — skips these rather than
 * failing. A missing credential is "not runnable here", not "broken".
 */
export function hasPlaidCredentials(): boolean {
  return Boolean(
    process.env.PLAID_CLIENT_ID && process.env.PLAID_SANDBOX_SECRET
  )
}

/**
 * Mint a sandbox access token without the Link UI, the way Plaid's own docs
 * suggest testing: `/sandbox/public_token/create` then the same
 * `itemPublicTokenExchange` the real flow uses.
 *
 * **Every caller must remove the item afterwards** — see `withSandboxItem`,
 * which is the only way this should be used.
 */
async function createSandboxAccessToken(
  products: Products[]
): Promise<{ accessToken: string; itemId: string }> {
  assertPlaidSandbox()

  const created = await plaidClient.sandboxPublicTokenCreate({
    institution_id: SANDBOX_INSTITUTION_ID,
    initial_products: products,
  })

  const exchanged = await plaidClient.itemPublicTokenExchange({
    public_token: created.data.public_token,
  })

  return {
    accessToken: exchanged.data.access_token,
    itemId: exchanged.data.item_id,
  }
}

/**
 * Run `body` against a freshly created sandbox item, then remove the item.
 *
 * The `finally` is the point. A sandbox item left behind is not expensive, but
 * leaking them from a test suite is exactly the habit that must not exist in a
 * codebase where the production equivalent is a billable bank connection.
 */
export async function withSandboxItem<T>(
  body: (item: { accessToken: string; itemId: string }) => Promise<T>,
  products: Products[] = [Products.Transactions]
): Promise<T> {
  const item = await createSandboxAccessToken(products)

  try {
    return await body(item)
  } finally {
    await plaidClient
      .itemRemove({ access_token: item.accessToken })
      .catch(() => {
        // Teardown only. A failure here must not mask the test's own result,
        // and the sandbox item expires on its own.
      })
  }
}

export { CountryCode, Products }
