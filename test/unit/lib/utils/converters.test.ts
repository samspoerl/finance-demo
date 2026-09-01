import { changeSign } from '@/lib/utils/converters'
import { describe, expect, it } from 'vitest'

describe('changeSign', () => {
  it('flips the sign', () => {
    expect(changeSign(5)).toBe(-5)
    expect(changeSign(-5)).toBe(5)
  })

  it('maps 0 to -0, which still compares equal to 0', () => {
    expect(changeSign(0)).toBe(-0)
    expect(changeSign(0) === 0).toBe(true)
  })
})
