import { compare } from '@/lib/utils/secure-compare'
import { describe, expect, it } from 'vitest'

describe('compare', () => {
  it('is true for identical strings', () => {
    expect(compare('abc', 'abc')).toBe(true)
    expect(compare('', '')).toBe(true)
  })

  it('is false for strings differing in content', () => {
    expect(compare('abc', 'abd')).toBe(false)
    expect(compare('abc', 'ABC')).toBe(false)
  })

  it('is false for strings differing in length', () => {
    expect(compare('abc', 'ab')).toBe(false)
    expect(compare('ab', 'abc')).toBe(false)
    expect(compare('abc', '')).toBe(false)
    expect(compare('', 'abc')).toBe(false)
  })

  it('detects a difference at the first character', () => {
    expect(compare('xbc', 'abc')).toBe(false)
  })

  it('detects a difference at the last character', () => {
    expect(compare('abx', 'abc')).toBe(false)
  })

  it('compares by code unit, so it distinguishes look-alike characters', () => {
    // Cyrillic "а" (U+0430) vs. Latin "a" (U+0061).
    expect(compare('аbc', 'abc')).toBe(false)
  })

  it('handles multi-byte characters', () => {
    expect(compare('日本語', '日本語')).toBe(true)
    expect(compare('日本語', '日本院')).toBe(false)
  })

  it('is false for non-string arguments', () => {
    // The signature says `string`, but the runtime guard exists because this
    // compares webhook secrets that may arrive as anything off the wire.
    expect(compare(null as unknown as string, 'abc')).toBe(false)
    expect(compare('abc', undefined as unknown as string)).toBe(false)
    expect(compare(123 as unknown as string, '123')).toBe(false)
    expect(compare({} as unknown as string, {} as unknown as string)).toBe(
      false
    )
  })

  it('is false for a long length mismatch', () => {
    // The implementation compares `a` against itself on a length mismatch so
    // the loop still runs, rather than returning early. That timing property
    // is not observable from here — this only pins the result.
    expect(compare('a'.repeat(1000), 'a'.repeat(999))).toBe(false)
  })

  it('is symmetric', () => {
    const pairs: [string, string][] = [
      ['abc', 'abc'],
      ['abc', 'abd'],
      ['abc', 'ab'],
      ['', 'x'],
    ]
    for (const [a, b] of pairs) {
      expect(compare(a, b)).toBe(compare(b, a))
    }
  })
})
