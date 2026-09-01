import { sortAccountsByBalanceDesc } from '@/lib/utils/account-sort'
import { describe, expect, it } from 'vitest'

function balances(accounts: { currentBalance: number | null }[]) {
  return accounts.map((account) => account.currentBalance)
}

describe('sortAccountsByBalanceDesc', () => {
  it('orders accounts from largest balance to smallest', () => {
    const sorted = sortAccountsByBalanceDesc([
      { currentBalance: 100 },
      { currentBalance: 5000 },
      { currentBalance: 250 },
    ])

    expect(balances(sorted)).toEqual([5000, 250, 100])
  })

  it('sorts negative balances below zero', () => {
    const sorted = sortAccountsByBalanceDesc([
      { currentBalance: -25 },
      { currentBalance: 0 },
      { currentBalance: 10 },
    ])

    expect(balances(sorted)).toEqual([10, 0, -25])
  })

  it('puts accounts with no balance snapshot last', () => {
    const sorted = sortAccountsByBalanceDesc([
      { currentBalance: null },
      { currentBalance: -5 },
      { currentBalance: 0 },
      { currentBalance: null },
      { currentBalance: 100 },
    ])

    expect(balances(sorted)).toEqual([100, 0, -5, null, null])
  })

  it('keeps the incoming order for equal balances', () => {
    const sorted = sortAccountsByBalanceDesc([
      { id: 1, currentBalance: 100 },
      { id: 2, currentBalance: 100 },
      { id: 3, currentBalance: 100 },
    ])

    expect(sorted.map((account) => account.id)).toEqual([1, 2, 3])
  })

  it('does not mutate the array it is given', () => {
    const accounts = [{ currentBalance: 1 }, { currentBalance: 2 }]
    const sorted = sortAccountsByBalanceDesc(accounts)

    expect(balances(accounts)).toEqual([1, 2])
    expect(sorted).not.toBe(accounts)
  })

  it('returns an empty array unchanged', () => {
    expect(sortAccountsByBalanceDesc([])).toEqual([])
  })
})
