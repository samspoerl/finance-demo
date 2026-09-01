import {
  formatPlaidDetailed,
  formatPlaidPrimary,
  getPrimaryFromDetailed,
  PFC_TAXONOMY,
} from '@/lib/utils/plaid-categories'
import { describe, expect, it } from 'vitest'

describe('PFC_TAXONOMY', () => {
  it('prefixes every detailed key with its primary key', () => {
    for (const [primary, detailed] of Object.entries(PFC_TAXONOMY)) {
      for (const key of detailed) {
        expect(key.startsWith(`${primary}_`)).toBe(true)
      }
    }
  })

  it('contains no duplicate detailed keys across primaries', () => {
    const all = Object.values(PFC_TAXONOMY).flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('gives every primary at least one detailed key', () => {
    for (const detailed of Object.values(PFC_TAXONOMY)) {
      expect(detailed.length).toBeGreaterThan(0)
    }
  })

  it('uses SCREAMING_SNAKE for every key', () => {
    for (const [primary, detailed] of Object.entries(PFC_TAXONOMY)) {
      expect(primary).toMatch(/^[A-Z][A-Z_]*$/)
      for (const key of detailed) {
        expect(key).toMatch(/^[A-Z][A-Z_]*$/)
      }
    }
  })
})

describe('formatPlaidPrimary', () => {
  it('title-cases and converts "And" to an ampersand', () => {
    expect(formatPlaidPrimary('FOOD_AND_DRINK')).toBe('Food & Drink')
    expect(formatPlaidPrimary('RENT_AND_UTILITIES')).toBe('Rent & Utilities')
  })

  it('handles a single-word primary', () => {
    expect(formatPlaidPrimary('INCOME')).toBe('Income')
    expect(formatPlaidPrimary('TRAVEL')).toBe('Travel')
  })

  it('applies the hyphenation override the generic transform gets wrong', () => {
    expect(formatPlaidPrimary('GOVERNMENT_AND_NON_PROFIT')).toBe(
      'Government & Non-Profit'
    )
  })

  it('does not swallow "and" inside a word', () => {
    // The replace targets " And " with surrounding spaces, so "Andorra" and
    // similar stay intact.
    expect(formatPlaidPrimary('BRANDS')).toBe('Brands')
  })

  it('falls back to the generic transform for an unknown primary', () => {
    expect(formatPlaidPrimary('SOMETHING_NEW')).toBe('Something New')
  })

  it('KNOWN DEFECT: returns a Function for an Object.prototype key', () => {
    // `PRIMARY_DISPLAY_OVERRIDES[primary] ?? ...` resolves up the prototype
    // chain, so the override lookup hits `Object.prototype.constructor` and
    // `??` keeps it. Same family as the account-types defects, and the same
    // violation of a declared `string` return. Pinned, not fixed.
    expect(typeof formatPlaidPrimary('constructor')).toBe('function')
  })

  it('produces a non-empty label for every primary in the taxonomy', () => {
    for (const primary of Object.keys(PFC_TAXONOMY)) {
      expect(formatPlaidPrimary(primary).length).toBeGreaterThan(0)
    }
  })
})

describe('formatPlaidDetailed', () => {
  it('strips the primary prefix before transforming', () => {
    expect(
      formatPlaidDetailed('FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES')
    ).toBe('Groceries')
    expect(formatPlaidDetailed('TRAVEL', 'TRAVEL_FLIGHTS')).toBe('Flights')
  })

  it('converts "And" to an ampersand in the stripped remainder', () => {
    expect(
      formatPlaidDetailed('BANK_FEES', 'BANK_FEES_INSUFFICIENT_FUNDS')
    ).toBe('Insufficient Funds')
    expect(
      formatPlaidDetailed(
        'RENT_AND_UTILITIES',
        'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY'
      )
    ).toBe('Gas & Electricity')
  })

  it('applies the detailed overrides', () => {
    expect(
      formatPlaidDetailed('ENTERTAINMENT', 'ENTERTAINMENT_TV_AND_MOVIES')
    ).toBe('TV & Movies')
    expect(
      formatPlaidDetailed(
        'FOOD_AND_DRINK',
        'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR'
      )
    ).toBe('Beer, Wine, & Liquor')
    expect(
      formatPlaidDetailed(
        'ENTERTAINMENT',
        'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS'
      )
    ).toBe('Sporting Events, Amusement Parks, & Museums')
  })

  it('applies an override even when the primary argument is wrong', () => {
    // The override lookup is keyed on the detailed key alone.
    expect(formatPlaidDetailed('WRONG', 'ENTERTAINMENT_TV_AND_MOVIES')).toBe(
      'TV & Movies'
    )
  })

  it('KNOWN DEFECT: returns a Function for an Object.prototype detailed key', () => {
    // `DETAILED_DISPLAY_OVERRIDES[detailed]` is truthy for prototype keys, so
    // the override branch returns the inherited function. Pinned, not fixed.
    expect(typeof formatPlaidDetailed('ANY', 'constructor')).toBe('function')
  })

  it('leaves the key intact when the primary is not actually a prefix', () => {
    expect(formatPlaidDetailed('TRAVEL', 'FOOD_AND_DRINK_GROCERIES')).toBe(
      'Food & Drink Groceries'
    )
  })

  it('handles the repeated-suffix "OTHER" keys', () => {
    expect(
      formatPlaidDetailed(
        'TRANSPORTATION',
        'TRANSPORTATION_OTHER_TRANSPORTATION'
      )
    ).toBe('Other Transportation')
    expect(
      formatPlaidDetailed(
        'GOVERNMENT_AND_NON_PROFIT',
        'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT'
      )
    ).toBe('Other Government & Non-Profit')
  })

  it('produces a non-empty label for every key in the taxonomy', () => {
    for (const [primary, detailed] of Object.entries(PFC_TAXONOMY)) {
      for (const key of detailed) {
        const label = formatPlaidDetailed(primary, key)
        expect(label.length).toBeGreaterThan(0)
        expect(label).not.toMatch(/_/)
      }
    }
  })
})

describe('getPrimaryFromDetailed', () => {
  it('finds the primary for a known detailed key', () => {
    expect(getPrimaryFromDetailed('FOOD_AND_DRINK_GROCERIES')).toBe(
      'FOOD_AND_DRINK'
    )
    expect(getPrimaryFromDetailed('OTHER_OTHER')).toBe('OTHER')
  })

  it('returns null for an unknown key', () => {
    expect(getPrimaryFromDetailed('NOT_A_CATEGORY')).toBeNull()
    expect(getPrimaryFromDetailed('')).toBeNull()
  })

  it('returns null for a primary key passed as a detailed key', () => {
    expect(getPrimaryFromDetailed('FOOD_AND_DRINK')).toBeNull()
  })

  it('round-trips every key in the taxonomy', () => {
    for (const [primary, detailed] of Object.entries(PFC_TAXONOMY)) {
      for (const key of detailed) {
        expect(getPrimaryFromDetailed(key)).toBe(primary)
      }
    }
  })
})
