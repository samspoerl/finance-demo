import prisma from '@/lib/prisma'
import 'server-only'

/**
 * The idle-demo-user reaper's data layer. `src/app/api/purge` owns the schedule
 * and the auth; this owns what "idle" means.
 *
 * Unlike every other module here these functions take no `userId` — they act
 * across all users by design, which is exactly why the selection rule is worth
 * having under test rather than inline in a route handler.
 */

export interface IdleUser {
  id: string
  connections: {
    id: number
    plaidItemId: string
    plaidAccessToken: string
    encryptionKeyId: string | null
  }[]
}

/**
 * Users with no session touched since `cutoff`, together with the Plaid items
 * that have to be revoked before they are deleted.
 *
 * `sessions: { none: ... }` is the whole rule. Better Auth bumps
 * `Session.updatedAt` on its own `updateAge` schedule, so nothing in this app
 * maintains it. The `createdAt` clause covers a user whose session row never
 * persisted — without it, a user created seconds ago would match `none` and be
 * reaped immediately.
 */
export async function findIdleUsers(cutoff: Date): Promise<IdleUser[]> {
  return prisma.user.findMany({
    where: {
      createdAt: { lt: cutoff },
      sessions: { none: { updatedAt: { gte: cutoff } } },
    },
    select: {
      id: true,
      connections: {
        select: {
          id: true,
          plaidItemId: true,
          plaidAccessToken: true,
          encryptionKeyId: true,
        },
      },
    },
  })
}

/** Deletes users by id. Every other table cascades from `users`. */
export async function deleteUsers(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0

  const { count } = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  })

  return count
}
