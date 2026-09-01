'use server'

import { actionError } from '@/lib/actions/action-error'
import { revalidateApp } from '@/lib/actions/revalidate'
import * as db from '@/lib/db/account'
import { ok } from '@/lib/server-result'
import { requireUser } from '@/lib/session'
import { ManualAccountCreateDto, ManualAccountUpdateDto } from '@/lib/types'

/**
 * `src/lib/actions/*` — the authenticated adapter over `src/lib/db/*`. Every
 * export has the same shape:
 *
 * ```ts
 * export async function doThing(args) {
 *   try {
 *     const user = await requireUser()
 *     return ok(await db.doThing(user.id, args))
 *   } catch (error) {
 *     return actionError(error)
 *   }
 * }
 * ```
 *
 * `requireUser()` is the entry-point guard: a Server Action is reachable by
 * direct POST to its action id regardless of which page linked to it. It is
 * written out in each action rather than hidden in a wrapper so that "is this
 * action authenticated?" is answerable by looking at the action.
 *
 * Each db module is imported as `* as db`. Actions and db modules pair one to
 * one by resource, so the namespace never collides — and an action that needed
 * two would be a sign it is straddling two resources.
 *
 * Reads are not here. Pages await `@/lib/db/*` directly in a Server Component;
 * an action exists only where a client component has to trigger something.
 */

export async function createManualAccount(data: ManualAccountCreateDto) {
  try {
    const user = await requireUser()
    const account = await db.createManualAccount(user.id, data)
    revalidateApp()
    return ok(account)
  } catch (error) {
    return actionError(error)
  }
}

export async function updateAccount(id: number, data: ManualAccountUpdateDto) {
  try {
    const user = await requireUser()
    const account = await db.updateAccount(user.id, id, data)
    revalidateApp()
    return ok(account)
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteManualAccount(id: number) {
  try {
    const user = await requireUser()
    const deleted = await db.deleteManualAccount(user.id, id)
    revalidateApp()
    return ok(deleted)
  } catch (error) {
    return actionError(error)
  }
}
