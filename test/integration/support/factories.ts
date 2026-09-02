import prisma from '@/lib/prisma'

/**
 * Row builders for the integration suite.
 *
 * Each takes only what the test cares about and fills the rest with something
 * valid but obviously synthetic, so a spec reads as the scenario it is testing
 * rather than a wall of required columns. The database is truncated with
 * `RESTART IDENTITY` between tests, so ids restart at 1 every time — but specs
 * should still use the returned id rather than assuming a number.
 *
 * **Never put a real Plaid access token in a fixture**, the same rule the cipher
 * specs follow. The connection factory's default is an obviously-fake string.
 */

let sequence = 0

/** Distinguishes rows within one test without depending on the id sequence. */
function next(): number {
  sequence += 1
  return sequence
}

export async function createUser(
  overrides: { name?: string; email?: string } = {}
) {
  const n = next()
  return prisma.user.create({
    data: {
      name: overrides.name ?? `User ${n}`,
      email: overrides.email ?? `user-${n}@example.invalid`,
      emailVerified: true,
    },
  })
}

export async function createInstitution(
  overrides: { name?: string; plaidInstitutionName?: string } = {}
) {
  const n = next()
  return prisma.institution.create({
    data: {
      name: overrides.name ?? null,
      plaidInstitutionName: overrides.plaidInstitutionName ?? `Bank ${n}`,
      plaidInstitutionId: `ins_${n}`,
    },
  })
}

export async function createConnection(
  userId: string,
  overrides: { institutionId?: number; plaidItemId?: string } = {}
) {
  const n = next()
  return prisma.connection.create({
    data: {
      userId,
      plaidItemId: overrides.plaidItemId ?? `item-${n}`,
      // Obviously fake. See the file header.
      plaidAccessToken: `not-a-real-token-${n}`,
      encryptionKeyId: 'test-key',
      plaidEnv: 'sandbox',
      institutionId: overrides.institutionId ?? null,
    },
  })
}

export async function createAccount(
  userId: string,
  overrides: {
    name?: string
    type?: string
    connectionId?: number
    institutionId?: number
    connectionType?: 'manual' | 'plaid'
  } = {}
) {
  const n = next()
  return prisma.account.create({
    data: {
      userId,
      name: overrides.name ?? `Account ${n}`,
      type: overrides.type ?? 'depository',
      subtype: 'checking',
      mask: String(1000 + n).slice(-4),
      connectionType: overrides.connectionType ?? 'manual',
      connectionId: overrides.connectionId ?? null,
      institutionId: overrides.institutionId ?? null,
    },
  })
}

export async function createBalance(
  accountId: number,
  userId: string,
  balance: number,
  asOfDate: string
) {
  return prisma.balance.create({
    data: {
      accountId,
      userId,
      balance,
      asOfDate: new Date(asOfDate),
      source: 'manual',
    },
  })
}

export async function createCategory(
  overrides: { category?: string; subcategory?: string } = {}
) {
  const n = next()
  return prisma.category.create({
    data: {
      plaidPrimary: 'FOOD_AND_DRINK',
      plaidDetailed: `FOOD_AND_DRINK_${n}`,
      category: overrides.category ?? 'Food and Drink',
      subcategory: overrides.subcategory ?? `Subcategory ${n}`,
    },
  })
}

export async function createTransaction(
  userId: string,
  accountId: number,
  overrides: {
    amount?: number
    date?: string
    description?: string
    type?: 'income' | 'expense'
    categoryId?: number
    connectionId?: number
  } = {}
) {
  const n = next()
  return prisma.transaction.create({
    data: {
      userId,
      accountId,
      amount: overrides.amount ?? 10,
      date: overrides.date ?? '2026-01-15',
      description: overrides.description ?? `Transaction ${n}`,
      type: overrides.type ?? 'expense',
      categoryId: overrides.categoryId ?? null,
      connectionId: overrides.connectionId ?? null,
      source: 'manual',
    },
  })
}
