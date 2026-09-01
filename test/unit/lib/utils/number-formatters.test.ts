import {
  formatBalance,
  formatCurrency,
  formatTransaction,
} from '@/lib/utils/number-formatters'
import { describe, expect, it } from 'vitest'

describe('formatCurrency', () => {
  it('defaults to zero fraction digits', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235')
  })

  it('honours an explicit precision', () => {
    expect(formatCurrency(1234.56, 2)).toBe('$1,234.56')
    expect(formatCurrency(1234.5, 2)).toBe('$1,234.50')
  })

  it('formats negative amounts with a leading minus', () => {
    expect(formatCurrency(-1234.56, 2)).toBe('-$1,234.56')
    expect(formatCurrency(-500)).toBe('-$500')
  })

  it('renders null, undefined and zero as $0', () => {
    expect(formatCurrency(null)).toBe('$0')
    expect(formatCurrency(undefined)).toBe('$0')
    expect(formatCurrency(0)).toBe('$0')
  })

  it('rounds rather than truncates at the chosen precision', () => {
    expect(formatCurrency(0.5)).toBe('$1')
    expect(formatCurrency(0.4)).toBe('$0')
  })

  it('groups thousands', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,568')
  })
})

describe('formatBalance', () => {
  it('formats at zero precision', () => {
    expect(formatBalance(1234.56)).toBe('$1,235')
  })

  it('renders a missing balance as $0', () => {
    expect(formatBalance(null)).toBe('$0')
    expect(formatBalance(undefined)).toBe('$0')
  })
})

describe('formatTransaction', () => {
  it('formats at two decimal places', () => {
    expect(formatTransaction(1234.5)).toBe('$1,234.50')
  })

  it('renders a missing amount as $0.00', () => {
    expect(formatTransaction(null)).toBe('$0.00')
    expect(formatTransaction(undefined)).toBe('$0.00')
  })
})
