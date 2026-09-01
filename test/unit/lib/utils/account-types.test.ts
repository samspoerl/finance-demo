import {
  ACCOUNT_TYPE_KEYS,
  ACCOUNT_TYPES,
  getAccountSubtypeLabel,
  getAccountTypeLabel,
  isAccountSubtype,
  isAccountType,
  isLiabilityAccountType,
  mapPlaidAccountSubtype,
  mapPlaidAccountType,
} from '@/lib/utils/account-types'
import { describe, expect, it } from 'vitest'

describe('mapPlaidAccountType', () => {
  it('renames the two Plaid types the app models differently', () => {
    expect(mapPlaidAccountType('depository')).toBe('cash')
    expect(mapPlaidAccountType('credit')).toBe('credit card')
  })

  it('passes every other Plaid type through unchanged', () => {
    expect(mapPlaidAccountType('investment')).toBe('investment')
    expect(mapPlaidAccountType('loan')).toBe('loan')
    expect(mapPlaidAccountType('brokerage')).toBe('brokerage')
  })

  it('maps into a known internal type for the types it rewrites', () => {
    expect(isAccountType(mapPlaidAccountType('depository'))).toBe(true)
    expect(isAccountType(mapPlaidAccountType('credit'))).toBe(true)
  })
})

describe('mapPlaidAccountSubtype', () => {
  it('expands the ambiguous "roth" subtype', () => {
    expect(mapPlaidAccountSubtype('roth')).toBe('roth ira')
  })

  it('passes every other subtype through unchanged', () => {
    expect(mapPlaidAccountSubtype('checking')).toBe('checking')
    expect(mapPlaidAccountSubtype('401k')).toBe('401k')
  })

  it('defaults a null or empty subtype to "other"', () => {
    expect(mapPlaidAccountSubtype(null)).toBe('other')
    expect(mapPlaidAccountSubtype('')).toBe('other')
  })
})

describe('ACCOUNT_TYPES', () => {
  it('gives every type a unique sortOrder', () => {
    const orders = Object.values(ACCOUNT_TYPES).map((t) => t.sortOrder)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('sorts assets before liabilities', () => {
    const assets = Object.values(ACCOUNT_TYPES).filter(
      (t) => t.category === 'asset'
    )
    const liabilities = Object.values(ACCOUNT_TYPES).filter(
      (t) => t.category === 'liability'
    )
    const maxAsset = Math.max(...assets.map((t) => t.sortOrder))
    const minLiability = Math.min(...liabilities.map((t) => t.sortOrder))
    expect(maxAsset).toBeLessThan(minLiability)
  })

  it('offers an "other" subtype on every type', () => {
    for (const info of Object.values(ACCOUNT_TYPES)) {
      expect(info.subtypes).toHaveProperty('other')
    }
  })

  it('classifies every type as an asset or a liability', () => {
    for (const info of Object.values(ACCOUNT_TYPES)) {
      expect(['asset', 'liability']).toContain(info.category)
    }
  })
})

describe('ACCOUNT_TYPE_KEYS', () => {
  it('lists exactly the keys of ACCOUNT_TYPES', () => {
    expect([...ACCOUNT_TYPE_KEYS]).toEqual(Object.keys(ACCOUNT_TYPES))
  })

  it('is accepted in full by isAccountType', () => {
    for (const key of ACCOUNT_TYPE_KEYS) {
      expect(isAccountType(key)).toBe(true)
    }
  })
})

describe('isAccountType', () => {
  it('accepts the five known types', () => {
    for (const type of [
      'cash',
      'investment',
      'real asset',
      'credit card',
      'loan',
    ]) {
      expect(isAccountType(type)).toBe(true)
    }
  })

  it('rejects unknown and near-miss values', () => {
    expect(isAccountType('crypto')).toBe(false)
    expect(isAccountType('Cash')).toBe(false)
    expect(isAccountType('')).toBe(false)
  })

  it('KNOWN DEFECT: accepts inherited Object.prototype keys', () => {
    // `value in ACCOUNT_TYPES` walks the prototype chain, so these narrow to
    // `AccountType` despite not being account types. Pinned as-is rather than
    // fixed — the fix is out of scope for this stage. See PR notes.
    expect(isAccountType('toString')).toBe(true)
    expect(isAccountType('constructor')).toBe(true)
  })
})

describe('isAccountSubtype', () => {
  it('accepts a subtype belonging to the given type', () => {
    expect(isAccountSubtype('cash', 'checking')).toBe(true)
    expect(isAccountSubtype('loan', 'mortgage')).toBe(true)
  })

  it('rejects a subtype belonging to a different type', () => {
    expect(isAccountSubtype('cash', 'mortgage')).toBe(false)
    expect(isAccountSubtype('loan', 'checking')).toBe(false)
  })

  it('accepts a subtype shared by two types', () => {
    expect(isAccountSubtype('cash', 'hsa')).toBe(true)
    expect(isAccountSubtype('investment', 'hsa')).toBe(true)
  })

  it('rejects an unknown subtype', () => {
    expect(isAccountSubtype('cash', 'nonsense')).toBe(false)
  })

  it('KNOWN DEFECT: accepts inherited Object.prototype keys', () => {
    // Same `in` prototype-chain leak as isAccountType. See PR notes.
    expect(isAccountSubtype('cash', 'toString')).toBe(true)
  })
})

describe('isLiabilityAccountType', () => {
  it('is true for credit cards and loans', () => {
    expect(isLiabilityAccountType('credit card')).toBe(true)
    expect(isLiabilityAccountType('loan')).toBe(true)
  })

  it('is false for asset types', () => {
    expect(isLiabilityAccountType('cash')).toBe(false)
    expect(isLiabilityAccountType('investment')).toBe(false)
    expect(isLiabilityAccountType('real asset')).toBe(false)
  })

  it('is false for null, undefined and empty input', () => {
    expect(isLiabilityAccountType(null)).toBe(false)
    expect(isLiabilityAccountType(undefined)).toBe(false)
    expect(isLiabilityAccountType('')).toBe(false)
  })

  it('is false for an unknown type rather than throwing', () => {
    expect(isLiabilityAccountType('crypto')).toBe(false)
  })

  it('is false for an Object.prototype key', () => {
    // `ACCOUNT_TYPES['toString']` resolves to a function whose `.category` is
    // undefined, so the optional chain must not misfire.
    expect(isLiabilityAccountType('toString')).toBe(false)
  })
})

describe('getAccountTypeLabel', () => {
  it('returns the configured label', () => {
    expect(getAccountTypeLabel('cash')).toBe('Cash')
    expect(getAccountTypeLabel('credit card')).toBe('Credit Card')
    expect(getAccountTypeLabel('real asset')).toBe('Real Asset')
  })

  it('returns "Unknown" for null, undefined and empty input', () => {
    expect(getAccountTypeLabel(null)).toBe('Unknown')
    expect(getAccountTypeLabel(undefined)).toBe('Unknown')
    expect(getAccountTypeLabel('')).toBe('Unknown')
  })

  it('echoes an unrecognised type rather than hiding it', () => {
    expect(getAccountTypeLabel('crypto')).toBe('crypto')
  })

  it('labels every configured type', () => {
    for (const [key, info] of Object.entries(ACCOUNT_TYPES)) {
      expect(getAccountTypeLabel(key)).toBe(info.label)
    }
  })
})

describe('getAccountSubtypeLabel', () => {
  it('returns the configured subtype label', () => {
    expect(getAccountSubtypeLabel('cash', 'checking')).toBe('Checking')
    expect(getAccountSubtypeLabel('cash', 'cd')).toBe('CD')
    expect(getAccountSubtypeLabel('investment', '401k')).toBe('401(k)')
    expect(getAccountSubtypeLabel('investment', 'roth ira')).toBe('Roth IRA')
  })

  it('returns "Other" when the subtype is missing', () => {
    expect(getAccountSubtypeLabel('cash', null)).toBe('Other')
    expect(getAccountSubtypeLabel('cash', undefined)).toBe('Other')
    expect(getAccountSubtypeLabel('cash', '')).toBe('Other')
  })

  it('falls back to title case for a subtype outside the type', () => {
    expect(getAccountSubtypeLabel('cash', 'mortgage')).toBe('Mortgage')
    expect(getAccountSubtypeLabel('loan', 'home equity')).toBe('Home Equity')
  })

  it('falls back to title case when the type is unknown or missing', () => {
    expect(getAccountSubtypeLabel(null, 'checking')).toBe('Checking')
    expect(getAccountSubtypeLabel('crypto', 'cold storage')).toBe(
      'Cold Storage'
    )
  })

  it('KNOWN DEFECT: returns a Function for an Object.prototype subtype key', () => {
    // The plain index lookup resolves up the prototype chain, so this returns
    // `Object.prototype.toString` itself — violating the declared `string`
    // return type. Subtypes are user-supplied on manually created accounts,
    // so this is reachable. Pinned, not fixed.
    expect(typeof getAccountSubtypeLabel('cash', 'toString')).toBe('function')
  })

  it('loses the configured casing when the type does not match', () => {
    // "CD" is only correct via the lookup; the title-case fallback cannot
    // recover an all-caps abbreviation.
    expect(getAccountSubtypeLabel('loan', 'cd')).toBe('Cd')
  })

  it('labels every configured type/subtype pair from the table', () => {
    for (const [type, info] of Object.entries(ACCOUNT_TYPES)) {
      for (const [subtype, label] of Object.entries(info.subtypes)) {
        expect(getAccountSubtypeLabel(type, subtype)).toBe(label)
      }
    }
  })
})
