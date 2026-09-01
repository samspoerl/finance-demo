'use server'

import { actionError } from '@/lib/actions/action-error'
import * as db from '@/lib/db/institution'
import { ok, ServerResult } from '@/lib/server-result'
import { requireUser } from '@/lib/session'
import { InstitutionDto } from '@/lib/types'

/**
 * Authenticated adapter over `@/lib/db/institution`. See
 * `@/lib/actions/account` for the pattern.
 *
 * Calls `requireUser()` even though the db function takes no `userId`: the list
 * is shared reference data, but the action id is reachable by direct POST and
 * there is no reason to answer an unauthenticated one.
 *
 * A read rather than a page fetch because it feeds the institution picker in
 * the manual account form, a dialog that fetches when it opens.
 */
export async function getInstitutions(): Promise<
  ServerResult<InstitutionDto[]>
> {
  try {
    await requireUser()
    return ok(await db.getInstitutions())
  } catch (error) {
    return actionError(error)
  }
}
