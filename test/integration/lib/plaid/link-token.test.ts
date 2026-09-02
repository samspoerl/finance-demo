import { createLinkToken } from '@/lib/plaid/link-token'
import { describe, expect, it } from 'vitest'
import { hasPlaidCredentials, withSandboxItem } from '../../support/plaid'

/**
 * These need only the two sandbox credentials.
 *
 * `redirect_uri` has to be one Plaid has registered for this client, and
 * `http://localhost:3000` — the fallback in `link-token.ts` — is registered,
 * so these run wherever the credentials do. Verified both ways: with
 * `PLAID_REDIRECT_URI` set to localhost, and with it absent so the fallback is
 * what Plaid actually receives.
 *
 * The trap, if this ever needs revisiting: `link-token.ts` picks the fallback
 * with `??`, which does **not** catch an empty string, so
 * `PLAID_REDIRECT_URI=''` is worse than an unset one — Plaid gets
 * `redirect_uri: ""` and rejects it with `INVALID_FIELD`. That is why the CI
 * job leaves this variable out of its env entirely instead of wiring it to a
 * secret that may not be set, which would expand to exactly that empty string.
 */
describe.skipIf(!hasPlaidCredentials())('createLinkToken', () => {
  it('creates a sandbox link token for a new item', async () => {
    const result = await createLinkToken({ clientUserId: '1' })

    expect(result.link_token).toMatch(/^link-sandbox-/)
    expect(result.expiration).toBeTruthy()
  })

  /**
   * The invariant `link-token.ts` spells out at length: Update Mode is chosen
   * on `accessToken !== undefined`, not on truthiness. A legacy connection row
   * can decrypt to an empty string, and under `if (accessToken)` that would
   * fall through to new-item mode — an "Update" click would mint a second
   * **billable** Plaid item instead of repairing the existing one, silently.
   *
   * An empty token has to reach Plaid and be rejected there. That is what this
   * asserts, against the real API: the call fails rather than succeeding as a
   * new-item request.
   */
  it('sends an empty access token to Plaid rather than falling back to new-item mode', async () => {
    await expect(
      createLinkToken({ clientUserId: '1', accessToken: '' })
    ).rejects.toThrow()
  })

  it('creates an Update Mode token for a real access token', async () => {
    await withSandboxItem(async ({ accessToken }) => {
      const result = await createLinkToken({ clientUserId: '1', accessToken })

      expect(result.link_token).toMatch(/^link-sandbox-/)
    })
  })

  /**
   * Update Mode must send no products. Plaid rejects `access_token` together
   * with a non-empty `products` array, so a regression that stopped clearing
   * them would surface here as a hard failure — which is the point of running
   * this against the API rather than asserting on a request object.
   */
  it('succeeds in Update Mode, proving products were cleared', async () => {
    await withSandboxItem(async ({ accessToken }) => {
      await expect(
        createLinkToken({ clientUserId: '1', accessToken })
      ).resolves.toHaveProperty('link_token')
    })
  })
})
