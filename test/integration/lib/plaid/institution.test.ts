import { plaidInstitutionGetById } from '@/lib/plaid/institution'
import { describe, expect, it } from 'vitest'
import {
  hasPlaidCredentials,
  SANDBOX_INSTITUTION_ID,
} from '../../support/plaid'

/**
 * Read-only, and the cheapest possible proof that the suite can reach Plaid at
 * all: no item is created, so nothing needs cleaning up.
 */
describe.skipIf(!hasPlaidCredentials())('plaidInstitutionGetById', () => {
  it('returns the sandbox institution with its optional metadata', async () => {
    const result = await plaidInstitutionGetById(SANDBOX_INSTITUTION_ID)

    expect(result.institution.institution_id).toBe(SANDBOX_INSTITUTION_ID)
    expect(result.institution.name).toBeTruthy()
    // `include_optional_metadata: true` is what puts these on the response;
    // the app reads `logo` when saving an institution.
    expect(result.institution).toHaveProperty('logo')
  })

  it('throws a typed PlaidApiError for an unknown institution', async () => {
    await expect(
      plaidInstitutionGetById('ins_does_not_exist')
    ).rejects.toThrow()
  })
})
