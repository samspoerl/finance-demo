// These schemas are used in Prisma select statements.

import {
  AccountDto,
  BalanceDto,
  CategoryDto,
  DbUser,
  InstitutionDto,
  TransactionDto,
} from '@/lib/types'

// BALANCES

export const balanceSelect = {
  id: true,
  balance: true,
  asOfDate: true,
  source: true,
  userId: true,
  connectionId: true,
  accountId: true,
} satisfies Record<keyof BalanceDto, true>

// ACCOUNTS

export const accountSelect = {
  id: true,
  plaidAccountId: true,
  name: true,
  mask: true,
  type: true,
  subtype: true,
  connectionType: true,
  userId: true,
  connectionId: true,
  institutionId: true,
} satisfies Record<keyof AccountDto, true>

export const accountWithBalancesSelect = {
  ...accountSelect,
  balances: {
    select: balanceSelect,
  },
}

// CONNECTIONS

export const connectionSelect = {
  id: true,
  plaidItemId: true,
  plaidEnv: true,
  plaidInstitutionId: true,
  institutionId: true,
  plaidErrorCode: true,
  plaidNewAccountsAvailable: true,
  plaidWebhookUrl: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}

export const connectionInternalSelect = {
  ...connectionSelect,
  plaidAccessToken: true,
  encryptionKeyId: true,
}

export const connectionWithAccountsSelect = {
  ...connectionSelect,
  accounts: {
    select: accountSelect,
  },
}

export const connectionWithAccountsInternalSelect = {
  ...connectionInternalSelect,
  accounts: {
    select: accountSelect,
  },
}

// TRANSACTIONS

export const categorySelect = {
  id: true,
  plaidPrimary: true,
  plaidDetailed: true,
  category: true,
  subcategory: true,
} satisfies Record<keyof CategoryDto, true>

export const transactionSelect = {
  id: true,
  amount: true,
  authorizedDate: true,
  date: true,
  description: true,
  originalDescription: true,
  merchantName: true,
  categoryId: true,
  type: true,
  plaidTransactionId: true,
  source: true,
  userId: true,
  connectionId: true,
  accountId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<keyof TransactionDto, true>

export const transactionWithCategorySelect = {
  ...transactionSelect,
  category: { select: categorySelect },
}

// INSTITUTIONS

export const institutionSelect = {
  id: true,
  name: true,
  plaidInstitutionId: true,
  plaidInstitutionName: true,
  plaidInstitutionLogo: true,
} satisfies Record<keyof InstitutionDto, true>

// USERS

export const userSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  isAnonymous: true,
} satisfies Record<keyof DbUser, true>
