import {
  capitalizeAndPluralize,
  toProperCase,
  toTitleCase,
} from '@/lib/utils/string-formatters'
import { describe, expect, it } from 'vitest'

describe('capitalizeAndPluralize', () => {
  it('capitalises and pluralises a single word', () => {
    expect(capitalizeAndPluralize('checking')).toBe('Checkings')
    expect(capitalizeAndPluralize('mortgage')).toBe('Mortgages')
  })

  it('pluralises only the last word but capitalises all of them', () => {
    expect(capitalizeAndPluralize('money market')).toBe('Money Markets')
    expect(capitalizeAndPluralize('investment property')).toBe(
      'Investment Properties'
    )
  })

  it('uses irregular English plurals', () => {
    expect(capitalizeAndPluralize('person')).toBe('People')
    expect(capitalizeAndPluralize('equity')).toBe('Equities')
  })

  it('leaves an already-plural last word alone', () => {
    expect(capitalizeAndPluralize('savings')).toBe('Savings')
  })

  it('preserves interior capitals rather than lowercasing them', () => {
    expect(capitalizeAndPluralize('ETF')).toBe('ETFS')
  })

  it('returns an empty string for an empty input', () => {
    expect(capitalizeAndPluralize('')).toBe('')
  })

  it('KNOWN DEFECT: throws on a whitespace-only string', () => {
    // The `!value` guard runs before the trim, so "   " reaches the mapper as
    // a single empty word and `word[0]` is undefined. Pinned, not fixed —
    // the fix is out of scope for this stage.
    expect(() => capitalizeAndPluralize('   ')).toThrow(TypeError)
  })

  it('KNOWN DEFECT: throws on doubled interior spaces', () => {
    // split(' ') yields an empty segment between the two spaces, and
    // `word[0].toUpperCase()` throws on it. `toTitleCase` gets this right.
    expect(() => capitalizeAndPluralize('money  market')).toThrow(TypeError)
  })
})

describe('toProperCase', () => {
  it('capitalises the first letter of every word', () => {
    expect(toProperCase('hello world')).toBe('Hello World')
    expect(toProperCase('checking')).toBe('Checking')
  })

  it('does not pluralise', () => {
    expect(toProperCase('mortgage')).toBe('Mortgage')
  })

  it('leaves the rest of each word untouched', () => {
    expect(toProperCase('mcDonald iPhone')).toBe('McDonald IPhone')
  })

  it('trims surrounding whitespace', () => {
    expect(toProperCase('  hello world  ')).toBe('Hello World')
  })

  it('returns an empty string for an empty input', () => {
    expect(toProperCase('')).toBe('')
  })

  it('KNOWN DEFECT: throws on doubled interior spaces', () => {
    // Same empty-segment defect as capitalizeAndPluralize. Pinned, not fixed.
    expect(() => toProperCase('hello  world')).toThrow(TypeError)
  })
})

describe('toTitleCase', () => {
  it('title-cases a snake_case token', () => {
    expect(toTitleCase('FOOD_AND_DRINK')).toBe('Food And Drink')
    expect(toTitleCase('money_market')).toBe('Money Market')
  })

  it('splits on spaces and hyphens as well as underscores', () => {
    expect(toTitleCase('money market')).toBe('Money Market')
    expect(toTitleCase('non-custodial wallet')).toBe('Non Custodial Wallet')
  })

  it('lowercases the remainder of each word, unlike toProperCase', () => {
    expect(toTitleCase('HELLO WORLD')).toBe('Hello World')
    expect(toTitleCase('iPhone')).toBe('Iphone')
  })

  it('collapses runs of separators instead of throwing', () => {
    // The regex split plus `.filter(Boolean)` makes this the one formatter in
    // the module that survives doubled separators.
    expect(toTitleCase('money  market')).toBe('Money Market')
    expect(toTitleCase('FOOD__AND__DRINK')).toBe('Food And Drink')
  })

  it('returns an empty string for empty or separator-only input', () => {
    expect(toTitleCase('')).toBe('')
    expect(toTitleCase('   ')).toBe('')
    expect(toTitleCase('___')).toBe('')
  })

  it('handles a single word', () => {
    expect(toTitleCase('GROCERIES')).toBe('Groceries')
  })
})
