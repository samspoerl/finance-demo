import * as db from '@/lib/db/purge'
import { logError } from '@/lib/errors'
import { plaidItemRemove } from '@/lib/plaid/item'
import { getDecryptedAccessToken } from '@/lib/utils/cipher'
import { compare } from '@/lib/utils/secure-compare'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Deletes idle demo users, and the Plaid sandbox items they left behind.
 *
 * Called by `.github/workflows/purge.yml` on a schedule. GitHub Actions rather
 * than Vercel Cron so the schedule lives in the repo beside the code it calls.
 *
 * Unauthenticated in the session sense — there is no user. `PURGE_SECRET` is
 * the only thing between this handler and the open internet, compared in
 * constant time so the token cannot be recovered by timing the response.
 */

/** How long a demo session may sit idle before its data is reaped. */
const IDLE_DAYS = 7

export async function POST(request: NextRequest) {
  const secret = process.env.PURGE_SECRET

  // Fail closed. An unset secret must not mean an open endpoint.
  if (!secret) {
    logError(new Error('PURGE_SECRET is not set'), 'Purge refused')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const authorization = request.headers.get('authorization') ?? ''

  if (!compare(authorization, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - IDLE_DAYS * 24 * 60 * 60 * 1000)

  try {
    const idle = await db.findIdleUsers(cutoff)

    let itemsRemoved = 0
    let itemsFailed = 0

    // Revoke at Plaid before deleting locally, the same ordering
    // `deleteConnection` uses: once the row is gone there is no token left to
    // revoke with. A failure is logged and the user is deleted anyway — an
    // abandoned sandbox item costs nothing, and refusing to reap would let one
    // broken item pin a user's data forever.
    for (const user of idle) {
      for (const connection of user.connections) {
        try {
          await plaidItemRemove(getDecryptedAccessToken(connection))
          itemsRemoved += 1
        } catch (error) {
          itemsFailed += 1
          logError(
            error,
            `Purge could not remove Plaid item ${connection.plaidItemId}`
          )
        }
      }
    }

    const usersDeleted = await db.deleteUsers(idle.map((user) => user.id))

    console.log(
      `Purge complete: ${usersDeleted} users, ${itemsRemoved} Plaid items removed, ${itemsFailed} failed`
    )

    return NextResponse.json({
      ok: true,
      usersDeleted,
      itemsRemoved,
      itemsFailed,
      idleDays: IDLE_DAYS,
    })
  } catch (error) {
    logError(error, 'Purge failed')
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }
}
