import { toTitleCase } from '@/lib/utils/string-formatters'

// ---------------------------------------------------------------------------
// Plaid → internal mappings
// ---------------------------------------------------------------------------

export function mapPlaidAccountType(plaidType: string): string {
  switch (plaidType) {
    case 'depository':
      return 'cash'
    case 'credit':
      return 'credit card'
    default:
      return plaidType
  }
}

export function mapPlaidAccountSubtype(plaidSubtype: string | null): string {
  if (!plaidSubtype) return 'other'
  switch (plaidSubtype) {
    case 'roth':
      return 'roth ira'
    default:
      return plaidSubtype
  }
}

// ---------------------------------------------------------------------------
// Internal account type hierarchy — single source of truth
// ---------------------------------------------------------------------------

export interface AccountTypeInfo {
  label: string
  category: 'asset' | 'liability' | 'unknown'
  sortOrder: number
  subtypes: Record<string, string>
}

export const ACCOUNT_TYPES = {
  cash: {
    label: 'Cash',
    category: 'asset',
    sortOrder: 0,
    subtypes: {
      'cash management': 'Cash Management',
      cd: 'CD',
      checking: 'Checking',
      'digital wallet': 'Digital Wallet',
      ebt: 'EBT',
      hsa: 'HSA',
      'money market': 'Money Market',
      prepaid: 'Prepaid',
      savings: 'Savings',
      other: 'Other',
    },
  },
  investment: {
    label: 'Investment',
    category: 'asset',
    sortOrder: 1,
    subtypes: {
      '401a': '401(a)',
      '401k': '401(k)',
      '403b': '403(b)',
      '457b': '457(b)',
      '529': '529',
      brokerage: 'Brokerage',
      'cash isa': 'Cash ISA',
      'crypto exchange': 'Crypto Exchange',
      'education savings account': 'Education Savings Account',
      esop: 'ESOP',
      'fixed annuity': 'Fixed Annuity',
      gic: 'GIC',
      'health reimbursement arrangement': 'Health Reimbursement Arrangement',
      hsa: 'HSA',
      ira: 'IRA',
      isa: 'ISA',
      keogh: 'Keogh',
      lif: 'LIF',
      'life insurance': 'Life Insurance',
      lira: 'LIRA',
      lrif: 'LRIF',
      lrsp: 'LRSP',
      'mutual fund': 'Mutual Fund',
      'non-custodial wallet': 'Non-Custodial Wallet',
      'non-taxable brokerage account': 'Non-Taxable Brokerage Account',
      'other annuity': 'Other Annuity',
      'other insurance': 'Other Insurance',
      pension: 'Pension',
      prif: 'PRIF',
      'profit sharing plan': 'Profit Sharing Plan',
      qshr: 'QSHR',
      rdsp: 'RDSP',
      resp: 'RESP',
      retirement: 'Retirement',
      rlif: 'RLIF',
      'roth 401k': 'Roth 401(k)',
      'roth ira': 'Roth IRA',
      rrif: 'RRIF',
      rrsp: 'RRSP',
      sarsep: 'SARSEP',
      'sep ira': 'SEP IRA',
      'simple ira': 'SIMPLE IRA',
      sipp: 'SIPP',
      'stock plan': 'Stock Plan',
      tfsa: 'TFSA',
      'thrift savings plan': 'Thrift Savings Plan',
      trust: 'Trust',
      ugma: 'UGMA',
      utma: 'UTMA',
      'variable annuity': 'Variable Annuity',
      other: 'Other',
    },
  },
  'real asset': {
    label: 'Real Asset',
    category: 'asset',
    sortOrder: 2,
    subtypes: {
      art: 'Art',
      collectible: 'Collectible',
      'investment property': 'Investment Property',
      residence: 'Residence',
      vehicle: 'Vehicle',
      other: 'Other',
    },
  },
  'credit card': {
    label: 'Credit Card',
    category: 'liability',
    sortOrder: 3,
    subtypes: {
      'credit card': 'Credit Card',
      'digital wallet': 'Digital Wallet',
      other: 'Other',
    },
  },
  loan: {
    label: 'Loan',
    category: 'liability',
    sortOrder: 4,
    subtypes: {
      auto: 'Auto',
      business: 'Business',
      commercial: 'Commercial',
      construction: 'Construction',
      consumer: 'Consumer',
      'home equity': 'Home Equity',
      'line of credit': 'Line of Credit',
      loan: 'Loan',
      mortgage: 'Mortgage',
      overdraft: 'Overdraft',
      student: 'Student',
      other: 'Other',
    },
  },
} satisfies Record<string, AccountTypeInfo>

export type AccountType = keyof typeof ACCOUNT_TYPES

export const ACCOUNT_TYPE_KEYS = Object.keys(ACCOUNT_TYPES) as [AccountType]

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

export function isAccountType(value: string): value is AccountType {
  return value in ACCOUNT_TYPES
}

export function isAccountSubtype(type: AccountType, subtype: string): boolean {
  return subtype in ACCOUNT_TYPES[type].subtypes
}

export function isLiabilityAccountType(
  type: string | null | undefined
): boolean {
  if (!type) return false
  return ACCOUNT_TYPES[type as AccountType]?.category === 'liability'
}

export function getAccountTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Unknown'
  return ACCOUNT_TYPES[type as AccountType]?.label ?? type
}

export function getAccountSubtypeLabel(
  type: string | null | undefined,
  subtype: string | null | undefined
): string {
  if (!subtype) return 'Other'
  const typeInfo = type ? ACCOUNT_TYPES[type as AccountType] : undefined
  const label = typeInfo?.subtypes[subtype as keyof typeof typeInfo.subtypes]
  if (label) return label
  return toTitleCase(subtype)
}
