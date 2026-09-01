import prisma from '@/lib/prisma'
import { connectionInternalSelect } from '@/lib/select-schemas'
import 'server-only'

/**
 * Connection reads and writes. Pure Prisma, `userId` as a parameter, no session
 * check — authentication, the Plaid calls, and `ServerResult` wrapping live in
 * `@/lib/actions/connection`.
 *
 * **No Plaid I/O below this line.** The delete flow is a Plaid revoke followed
 * by a local delete, and the revoke half stays in the action: that split keeps
 * these two functions callable from an integration test with no Plaid
 * credentials, and keeps the ordering constraint — revoke first, delete only
 * after Plaid confirms — visible in one place.
 *
 * `getConnectionInternalById` is the one function in `src/lib/db` that returns
 * an encrypted access token. Its only caller decrypts it, hands it straight to
 * Plaid, and returns `ServerResult<void>`, so the token is never part of a
 * returned value. Do not widen its callers, and do not add a
 * `connectionInternalSelect` read to any function whose result reaches a client.
 */

/**
 * Scoped to `userId`, so a forged `connectionId` cannot reach someone else's
 * item. Throws Prisma's not-found error — a fault, not a `DomainError`.
 */
export async function getConnectionInternalById(
  userId: string,
  connectionId: number
) {
  return prisma.connection.findUniqueOrThrow({
    where: { id: connectionId, userId },
    select: connectionInternalSelect,
  })
}

/**
 * Detach every row that references the connection, then delete the connection
 * itself, atomically.
 *
 * The `updateMany` calls null out a foreign key; nothing here deletes a
 * `Balance` or `Transaction`. Those outlive the connection that produced them —
 * disconnecting a bank should not erase its history — and the accounts survive
 * too, demoted to `connectionType: 'manual'`.
 *
 * The three middle filters match on `connectionId` alone. That is safe because
 * the bracketing `account.updateMany` and `connection.delete` are both scoped by
 * `userId`, so the transaction cannot commit unless the caller owns the
 * connection. Adding `userId` to the middle filters would be harmless; removing
 * it from the outer two would not be.
 *
 * Call this only after Plaid has confirmed the item is gone.
 */
export async function deleteConnection(userId: string, connectionId: number) {
  await prisma.$transaction([
    prisma.account.updateMany({
      where: { connectionId, userId },
      data: {
        connectionId: null,
        plaidAccountId: null,
        connectionType: 'manual',
      },
    }),
    prisma.balance.updateMany({
      where: { connectionId },
      data: { connectionId: null },
    }),
    prisma.transaction.updateMany({
      where: { connectionId },
      data: { connectionId: null },
    }),
    prisma.holding.updateMany({
      where: { connectionId },
      data: { connectionId: null },
    }),
    prisma.connection.delete({
      where: { id: connectionId, userId },
    }),
  ])
}
