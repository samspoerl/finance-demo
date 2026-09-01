import { normalizeBalance } from '@/lib/utils/account-balance'
import { describe, expect, it } from 'vitest'

describe('normalizeBalance', () => {
  it('leaves asset balances unchanged', () => {
    expect(normalizeBalance(100, 'cash')).toBe(100)
    expect(normalizeBalance(100, 'investment')).toBe(100)
    expect(normalizeBalance(100, 'real asset')).toBe(100)
  })

  it('negates liability balances so they reduce net worth', () => {
    expect(normalizeBalance(100, 'credit card')).toBe(-100)
    expect(normalizeBalance(100, 'loan')).toBe(-100)
  })

  it('negates a negative liability balance back to positive', () => {
    // An overpaid credit card carries a negative balance; it is an asset then.
    expect(normalizeBalance(-50, 'credit card')).toBe(50)
  })

  it('treats an unknown type as an asset', () => {
    expect(normalizeBalance(100, 'brokerage')).toBe(100)
  })

  it('treats a null or undefined type as an asset', () => {
    expect(normalizeBalance(100, null)).toBe(100)
    expect(normalizeBalance(100, undefined)).toBe(100)
  })

  it('returns 0 for a null or undefined balance', () => {
    expect(normalizeBalance(null, 'loan')).toBe(0)
    expect(normalizeBalance(undefined, 'loan')).toBe(0)
  })

  it('preserves a zero balance without flipping it to -0 for assets', () => {
    expect(normalizeBalance(0, 'cash')).toBe(0)
  })
})
