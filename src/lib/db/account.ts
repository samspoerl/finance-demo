import { DomainError } from '@/lib/db/errors'
import prisma from '@/lib/prisma'
import { accountSelect } from '@/lib/select-schemas'
import { ManualAccountCreateDto, ManualAccountUpdateDto } from '@/lib/types'
import 'server-only'

/**
 * Account reads and writes. Pure Prisma, `userId` as a parameter —
 * authentication and `ServerResult` wrapping live in `@/lib/actions/account`.
 *
 * **Scoping is the whole job of this file.** Every query is constrained by the
 * `userId` passed in. The private app also widened these reads to a household
 * via an `AccountShare` join, which is why its version had to keep `userId` and
 * `userIds` straight in the same query; the demo has no sharing, so an account
 * belongs to exactly one user and there is one filter to get right.
 */

/** Accounts with their latest balance snapshot. */
export async function getAccounts(userId: string) {
  const result = await prisma.account.findMany({
    select: {
      ...accountSelect,
      institution: {
        select: {
          name: true,
          plaidInstitutionName: true,
        },
      },
      balances: {
        select: {
          balance: true,
          asOfDate: true,
        },
        orderBy: {
          asOfDate: 'desc',
        },
        take: 1,
      },
    },
    where: { userId },
    orderBy: { id: 'asc' },
  })

  return result.map((account) => {
    const { institution, balances, ...rest } = account

    return {
      ...rest,
      institutionName:
        institution?.name ?? institution?.plaidInstitutionName ?? null,
      currentBalance: balances[0]?.balance ?? null,
      currentBalanceAsOfDate: balances[0]?.asOfDate ?? null,
    }
  })
}

/**
 * One account with its latest balance. Throws `DomainError` when there is no
 * such account *for this user* — deliberately not distinguishing "does not
 * exist" from "is not yours".
 */
export async function getAccountById(userId: string, id: number) {
  const account = await prisma.account.findFirst({
    select: {
      ...accountSelect,
      institution: {
        select: {
          name: true,
          plaidInstitutionName: true,
        },
      },
      balances: {
        select: {
          balance: true,
          asOfDate: true,
        },
        orderBy: { asOfDate: 'desc' },
        take: 1,
      },
    },
    where: { id, userId },
  })

  if (!account) throw new DomainError('Account not found')

  return {
    ...account,
    institutionName:
      account.institution?.name ??
      account.institution?.plaidInstitutionName ??
      null,
    currentBalance: account.balances[0]?.balance ?? null,
    currentBalanceAsOfDate: account.balances[0]?.asOfDate ?? null,
  }
}

export async function createManualAccount(
  userId: string,
  data: ManualAccountCreateDto
) {
  return prisma.account.create({
    data: {
      connectionType: 'manual',
      mask: data.mask,
      name: data.name,
      type: data.type,
      subtype: data.subtype,
      institutionId: data.institutionId,
      userId,
    },
  })
}

export async function updateAccount(
  userId: string,
  id: number,
  data: ManualAccountUpdateDto
) {
  const existingAccount = await prisma.account.findFirst({
    where: { id, userId },
    select: { id: true, connectionId: true },
  })

  if (!existingAccount) {
    throw new DomainError('Account not found')
  }

  // Connected accounts derive their institution from the Plaid item, so only
  // manual accounts may set it.
  const { institutionId, ...rest } = data
  const safeData = existingAccount.connectionId === null ? data : rest

  return prisma.account.update({
    where: { id },
    data: safeData,
  })
}

export async function deleteManualAccount(userId: string, id: number) {
  const existingAccount = await prisma.account.findFirst({
    where: { id, userId },
    select: { id: true, connectionType: true },
  })

  if (!existingAccount) {
    throw new DomainError('Account not found')
  }

  if (existingAccount.connectionType !== 'manual') {
    throw new DomainError('Only manual accounts can be deleted')
  }

  await prisma.account.delete({ where: { id } })

  return { id }
}

/**
 * An account, its newest `Balance`, and — for investment accounts — its newest
 * `Holding` per security.
 *
 * The holdings here are descriptive: `balance` is the account's value, and it
 * is never derived from summing them. The two can disagree, and when they do
 * the balance is right.
 *
 * Exported from the db module rather than an action, because a `'use server'`
 * module's exports become client-callable action ids and a type has no business
 * being one. Client components import it with `import type`, which erases and so
 * never pulls `server-only` into a browser bundle.
 */
export interface AccountSummary {
  id: number
  name: string | null
  type: string | null
  subtype: string | null
  balance: number
  holdings?: {
    securityId: number
    securityType: string | null
    securityName: string | null
    tickerSymbol: string | null
    value: number
    isCashEquivalent: boolean | null
  }[]
}

/**
 * The one raw-SQL read in this file. It stays raw because the two `DISTINCT ON`
 * subqueries — newest balance per account, newest holding per (account,
 * security) — are what keep this to a single round-trip; the Prisma equivalent
 * is a `take: 1` ordered include per relation, which fans out.
 *
 * **`userId` is bound three times and all three matter.** The outer filter
 * scopes the account list; the two subqueries scope the balance and holding
 * rows independently, because both tables carry their own `userId`. Dropping
 * any one widens the result past the requesting user. Every `${userId}` is a
 * bound parameter, not interpolated SQL.
 */
export async function getAccountSummaries(
  userId: string
): Promise<AccountSummary[]> {
  const rows = await prisma.$queryRaw<
    {
      accountId: number
      name: string | null
      type: string | null
      subtype: string | null
      balance: number | null
      securityId: number | null
      securityType: string | null
      securityName: string | null
      tickerSymbol: string | null
      value: number | null
      isCashEquivalent: boolean | null
    }[]
  >`
      SELECT
        a."id" AS "accountId",
        a."name",
        a."type",
        a."subtype",
        b."balance",
        s."id" AS "securityId",
        s."type" AS "securityType",
        s."name" AS "securityName",
        s."tickerSymbol",
        s."isCashEquivalent",
        h."value"
      FROM "accounts" a
      LEFT JOIN (
        SELECT DISTINCT ON ("accountId") "accountId", "balance"
        FROM "balances"
        WHERE "userId" = ${userId}
        ORDER BY "accountId", "asOfDate" DESC
      ) b ON b."accountId" = a."id"
      LEFT JOIN (
        SELECT DISTINCT ON ("accountId", "securityId")
          "id", "accountId", "securityId", "value"
        FROM "holdings"
        WHERE "userId" = ${userId}
        ORDER BY "accountId", "securityId", "asOfDate" DESC
      ) h ON h."accountId" = a."id"
      LEFT JOIN "securities" s ON s."id" = h."securityId"
      WHERE a."userId" = ${userId}
    `

  const map = new Map<number, AccountSummary>()

  for (const row of rows) {
    const {
      accountId,
      name,
      type,
      subtype,
      balance,
      securityId,
      securityType,
      securityName,
      tickerSymbol,
      value,
      isCashEquivalent,
    } = row

    if (!map.has(accountId)) {
      map.set(accountId, {
        id: accountId,
        name,
        type,
        subtype,
        balance: balance ?? 0,
        holdings: [],
      })
    }

    if (securityId != null) {
      map.get(accountId)!.holdings!.push({
        securityId,
        securityType,
        securityName,
        tickerSymbol,
        value: value ?? 0,
        isCashEquivalent,
      })
    }
  }

  return Array.from(map.values()).map((acc) => {
    if (acc.type !== 'investment') delete acc.holdings
    return acc
  })
}
