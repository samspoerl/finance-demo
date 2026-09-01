import { plaidClient } from '@/lib/plaid/client'
import { callPlaid } from '@/lib/plaid/errors'
import { CountryCode, InstitutionsGetByIdResponse } from 'plaid'
import 'server-only'

export async function plaidInstitutionGetById(
  plaidInstitutionId: string
): Promise<InstitutionsGetByIdResponse> {
  return callPlaid(() =>
    plaidClient.institutionsGetById({
      country_codes: [CountryCode.Us],
      institution_id: plaidInstitutionId,
      options: {
        include_optional_metadata: true,
        include_status: true,
      },
    })
  )
}
