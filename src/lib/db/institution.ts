import prisma from '@/lib/prisma'
import { institutionSelect } from '@/lib/select-schemas'
import 'server-only'

/**
 * Institution reads.
 *
 * Only the list survives from the private app's version. The rest —
 * `getInstitutionDetails`, `getInstitutionById`, `getInstitutionTransactions`,
 * `getInstitutionBalanceHistory`, `getInstitutionNameById` — existed for the
 * `/institutions` routes and the breadcrumb slot, none of which this
 * single-page app has.
 *
 * Institutions are shared reference data with no owner, which is why there is
 * no `userId` parameter here. Rows are created by the Plaid Link flow (see
 * `@/lib/plaid/institution`); authentication is enforced by `requireUser()` in
 * the action that calls this.
 */
export async function getInstitutions() {
  return prisma.institution.findMany({
    select: institutionSelect,
    orderBy: { name: 'asc' },
  })
}
