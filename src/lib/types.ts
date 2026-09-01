import {
  Account,
  Balance,
  Institution,
  Transaction,
  User,
} from '@/generated/prisma/client'

// AUDIT FIELDS

type AuditFields = 'createdAt' | 'updatedAt'

// ENUMS

export type SourceType = 'manual' | 'plaid'

// HOLDINGS

export type Holding = {
  id: number
  value: number
  asOfDate: Date
  userId: string
  connectionId?: number | null
  accountId: number
  securityId: number
  createdAt: Date
  updatedAt: Date
}

export type HoldingCreate = Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>

// BALANCES

export type BalanceDto = Omit<Balance, AuditFields>

/**
 * A fully-populated balance ready for DB insertion. Use when userId and
 * connectionId are sourced from a Plaid connection rather than an auth context.
 */
export type BalanceInsertDto = Omit<BalanceDto, 'id'>

export type BalanceCreateDto = Omit<
  BalanceDto,
  'id' | 'userId' | 'connectionId'
>

/**
 * The private app let this carry holding values, writing both in one
 * transaction. Holdings are descriptive only here — an account's value is its
 * `Balance` and nothing else — so a manual balance is just a balance.
 */
export type ManualBalanceCreateDto = Omit<BalanceCreateDto, 'source'>

// ACCOUNTS

export type AccountDto = Omit<Account, AuditFields>
export type AccountCreateDto = Omit<AccountDto, 'id' | 'userId'>
export type AccountUpdateDto = Partial<AccountCreateDto>

export type AccountDetailsDto = AccountDto & {
  currentBalance: number | null
  currentBalanceAsOfDate: Date | null
  institutionName: string | null
}

export type ManualAccountCreateDto = Omit<
  AccountCreateDto,
  'plaidAccountId' | 'connectionId' | 'connectionType'
>
export type ManualAccountUpdateDto = Partial<ManualAccountCreateDto>

// CONNECTIONS

export type Connection = {
  id: number
  plaidItemId: string
  plaidEnv: 'sandbox' | 'production'
  plaidInstitutionId: string | null
  institutionId: number | null
  plaidErrorCode: string | null
  plaidNewAccountsAvailable: boolean
  plaidWebhookUrl: string | null
  displayAccessToken?: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export type ConnectionInternal = Connection & {
  plaidAccessToken: string
  encryptionKeyId: string | null
}

export type ConnectionWithAccounts = Connection & { accounts: AccountDto[] }

export type ConnectionWithAccountsInternal = ConnectionInternal & {
  accounts: AccountDto[]
}

// INSTITUTIONS

export type InstitutionDto = Omit<Institution, AuditFields>
export type InstitutionCreateDto = Omit<InstitutionDto, 'id'>
export type InstitutionUpdateDto = Partial<InstitutionCreateDto>

export type InstitutionConnectionSummary = {
  id: number
  plaidItemId: string
  plaidEnv: 'sandbox' | 'production'
  plaidErrorCode: string | null
}

export type InstitutionAccountSummary = {
  id: number
  name: string | null
  mask: string | null
  type: string | null
  subtype: string | null
  currentBalance: number | null
  currentBalanceAsOfDate: Date | null
  connectionId: number | null
}

export type InstitutionDetails = InstitutionDto & {
  /** Total adjusted balance across all accounts (liabilities negated). */
  totalBalance: number
  /** The first active Plaid connection, or null for manual-only institutions. */
  connection: InstitutionConnectionSummary | null
  accounts: InstitutionAccountSummary[]
}

// CATEGORIES

export type CategoryDto = {
  id: number
  plaidPrimary: string
  plaidDetailed: string
  category: string
  subcategory: string
}

// TRANSACTIONS

export type TransactionDto = Omit<Transaction, 'metadata'>

export type TransactionWithCategoryDto = TransactionDto & {
  category: CategoryDto | null
}

export type RecentTransactionDto = TransactionDto & {
  account: { name: string | null }
  category: CategoryDto | null
}

export type AllTransactionsPageDto = {
  transactions: RecentTransactionDto[]
  total: number
}

// USERS

export type DbUser = Omit<User, AuditFields>
