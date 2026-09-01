import {
  formatCurrency,
  parseCurrency,
  parseCurrencyOrNull,
} from '@/lib/utils/currency'
import { describe, expect, it } from 'vitest'

describe('formatCurrency', () => {
  it('formats a number as USD with exactly two fraction digits', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats negatives with a leading minus, not parentheses', () => {
    expect(formatCurrency(-42)).toBe('-$42.00')
  })

  it('rounds to the cent', () => {
    expect(formatCurrency(1.005)).toBe('$1.01')
    expect(formatCurrency(1.004)).toBe('$1.00')
  })

  it('strips currency symbols and separators before parsing a string', () => {
    expect(formatCurrency('$1,234.50')).toBe('$1,234.50')
    expect(formatCurrency('-$1,234.50')).toBe('-$1,234.50')
  })

  it('returns an empty string for empty or nullish input', () => {
    expect(formatCurrency('')).toBe('')
    // The signature says `number | string`, but the body explicitly guards
    // null/undefined, so the runtime contract is wider than the type.
    expect(formatCurrency(null as unknown as number)).toBe('')
    expect(formatCurrency(undefined as unknown as number)).toBe('')
  })

  it('returns an empty string when a string does not parse to a number', () => {
    expect(formatCurrency('abc')).toBe('')
    expect(formatCurrency('$')).toBe('')
  })

  it('formats a numeric zero rather than treating it as empty', () => {
    // `0` is falsy, so this guards against a `!value` early return creeping in.
    expect(formatCurrency(0)).toBe('$0.00')
  })
})

describe('parseCurrencyOrNull', () => {
  it('parses a formatted currency string back to a number', () => {
    expect(parseCurrencyOrNull('$1,234.50')).toBe(1234.5)
    expect(parseCurrencyOrNull('-$1,234.50')).toBe(-1234.5)
  })

  it('parses a bare number string', () => {
    expect(parseCurrencyOrNull('42')).toBe(42)
    expect(parseCurrencyOrNull('0')).toBe(0)
  })

  it('returns null for an empty string', () => {
    expect(parseCurrencyOrNull('')).toBeNull()
  })

  it('returns null for partial input that is not yet a number', () => {
    expect(parseCurrencyOrNull('-')).toBeNull()
    expect(parseCurrencyOrNull('.')).toBeNull()
    expect(parseCurrencyOrNull('-.')).toBeNull()
    expect(parseCurrencyOrNull('$')).toBeNull()
    expect(parseCurrencyOrNull('abc')).toBeNull()
  })

  it('keeps a leading decimal point', () => {
    expect(parseCurrencyOrNull('.5')).toBe(0.5)
  })
})

describe('parseCurrency', () => {
  it('mirrors parseCurrencyOrNull for parseable input', () => {
    expect(parseCurrency('$1,234.50')).toBe(1234.5)
  })

  it('falls back to 0 where parseCurrencyOrNull returns null', () => {
    expect(parseCurrency('')).toBe(0)
    expect(parseCurrency('abc')).toBe(0)
    expect(parseCurrency('-')).toBe(0)
  })
})
