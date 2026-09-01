'use server'

import { actionError } from '@/lib/actions/action-error'
import { revalidateApp } from '@/lib/actions/revalidate'
import { logError } from '@/lib/errors'
import { plaidClient } from '@/lib/plaid/client'
import { callPlaid } from '@/lib/plaid/errors'
import { plaidInstitutionGetById } from '@/lib/plaid/institution'
import prisma from '@/lib/prisma'
import { connectionSelect } from '@/lib/select-schemas'
import { ok, ServerResult } from '@/lib/server-result'
import { requireUser } from '@/lib/session'
import { Connection } from '@/lib/types'
import {
  mapPlaidAccountSubtype,
  mapPlaidAccountType,
} from '@/lib/utils/account-types'
import { encrypt } from '@/lib/utils/cipher'
import { PlaidAccount, PlaidLinkOnSuccessMetadata } from 'react-plaid-link'

const PERSIST_RETRY_COUNT = 2

/**
 * Exchange a public token for an access token, encrypt it, and create the
 * `Connection` row.
 *
 * **Nothing may be inserted between the token exchange and the token reaching
 * the database.** A step that threw in between would strand a live Plaid item
 * with no row referencing its token. Revalidation is therefore after the write,
 * where the worst it can do is fail a connection the database already has.
 */
export async function exchangeAndCreateConnection(
  publicToken: string,
  metadata: PlaidLinkOnSuccessMetadata
): Promise<ServerResult<Connection>> {
  try {
    const user = await requireUser()

    const exchangeRes = await callPlaid(() =>
      plaidClient.itemPublicTokenExchange({ public_token: publicToken })
    )

    const plaidItemId = exchangeRes.item_id
    const { encrypted, keyId } = encrypt(exchangeRes.access_token)

    // Best-effort: a failure here must not block token persistence.
    const plaidInstitutionId: string | null =
      metadata.institution?.institution_id ?? null
    let plaidInstitutionName: string | null = metadata.institution?.name ?? null
    let plaidInstitutionLogo: string | null = null

    if (plaidInstitutionId !== null) {
      try {
        const institutionRes = await plaidInstitutionGetById(plaidInstitutionId)
        plaidInstitutionName =
          institutionRes.institution.name ?? plaidInstitutionName
        plaidInstitutionLogo = institutionRes.institution.logo ?? null
      } catch (error) {
        logError(error, `Institution fetch failed for ${plaidInstitutionId}`)
      }
    }

    // `await` before `ok(...)`, not `ok(persistConnection(...))`, so a
    // persistence failure reaches the catch below instead of escaping as a
    // rejected action.
    const connection = await persistConnection(user.id, {
      plaidItemId,
      encrypted,
      keyId,
      plaidAccounts: metadata.accounts,
      plaidInstitutionId,
      plaidInstitutionName,
      plaidInstitutionLogo,
    })

    revalidateApp()

    return ok(connection)
  } catch (error) {
    return actionError(error)
  }
}

async function persistConnection(
  userId: string,
  params: {
    plaidItemId: string
    encrypted: string
    keyId: string
    plaidAccounts: PlaidAccount[]
    plaidInstitutionId: string | null
    plaidInstitutionName: string | null
    plaidInstitutionLogo: string | null
  }
): Promise<Connection> {
  const {
    plaidItemId,
    encrypted,
    keyId,
    plaidAccounts,
    plaidInstitutionId,
    plaidInstitutionName,
    plaidInstitutionLogo,
  } = params

  let lastError: unknown

  for (let attempt = 0; attempt <= PERSIST_RETRY_COUNT; attempt++) {
    try {
      let institutionId: number | null = null

      if (plaidInstitutionId !== null) {
        const institution = await prisma.institution.upsert({
          where: { plaidInstitutionId },
          create: {
            plaidInstitutionId,
            plaidInstitutionName,
            plaidInstitutionLogo,
          },
          update: { plaidInstitutionName, plaidInstitutionLogo },
          select: { id: true },
        })
        institutionId = institution.id
      }

      // `return await` inside the `try`, not a bare `return`: a bare one
      // settles the promise outside this block and the retry loop would never
      // see the rejection.
      return await prisma.connection.create({
        select: connectionSelect,
        data: {
          userId,
          plaidItemId,
          plaidAccessToken: encrypted,
          encryptionKeyId: keyId,
          plaidInstitutionId,
          institutionId,
          // Not read from PLAID_ENV: `plaid/client.ts` refuses to start outside
          // sandbox, so there is no other value this could legitimately be.
          plaidEnv: 'sandbox',
          accounts: {
            create: plaidAccounts.map((a) => ({
              plaidAccountId: a.id,
              name: a.name,
              mask: a.mask,
              type: mapPlaidAccountType(a.type),
              subtype: mapPlaidAccountSubtype(a.subtype),
              userId,
              institutionId,
              connectionType: 'plaid',
            })),
          },
        },
      })
    } catch (error) {
      lastError = error
    }
  }

  // Every retry failed, so the Plaid item now exists upstream with no row
  // referencing it.
  //
  // The private app reported the *encrypted access token* here, deliberately
  // and with a long warning not to remove it: in production an orphaned item is
  // billable and cannot be revoked without a Plaid support request, so
  // disclosing the ciphertext bought back the ability to revoke it.
  //
  // That trade does not exist in sandbox. Items are free, unlimited, and
  // disposable — an orphaned one costs nothing and can simply be abandoned. So
  // there is nothing to buy and no reason to put a token in a log. The item id
  // is enough to find it in the Plaid dashboard.
  logError(lastError, `Token persistence failed for item ${plaidItemId}`)

  // Re-throw so the caller's catch returns err() to the client.
  throw lastError
}
