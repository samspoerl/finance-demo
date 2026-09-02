import {
  reconstructNetWorthHistory,
  type HistoryAccount,
  type HistoryTransaction,
} from '@/lib/utils/net-worth-history'
import { describe, expect, it } from 'vitest'

/**
 * The chart is reconstructed rather than measured, so these tests are the only
 * thing standing between a plausible-looking line and a wrong one. A sign error
 * here does not throw — it draws a smooth curve pointing the wrong way.
 */

const TODAY = new Date('2026-03-10T12:00:00Z')

function run(
  accounts: HistoryAccount[],
  transactions: HistoryTransaction[],
  days = 4
) {
  return reconstructNetWorthHistory({
    accounts,
    transactions,
    days,
    today: TODAY,
  })
}

describe('reconstructNetWorthHistory', () => {
  it('returns points oldest first, ending today', () => {
    const points = run([{ id: 1, type: 'cash', currentBalance: 100 }], [])

    expect(points.map((p) => p.date)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ])
  })

  it('holds an account with no transactions flat across the window', () => {
    const points = run(
      [{ id: 1, type: 'investment', currentBalance: 5000 }],
      []
    )

    expect(points.map((p) => p.netWorth)).toEqual([5000, 5000, 5000, 5000])
  })

  /**
   * An asset: a positive Plaid amount is money that left the account, so the
   * balance *before* that day was higher.
   */
  it('walks an asset balance up as it moves back past a debit', () => {
    const points = run(
      [{ id: 1, type: 'cash', currentBalance: 100 }],
      [{ accountId: 1, date: '2026-03-10', amount: 40 }]
    )

    // Today is 100. The 40 debit happened today, so yesterday it was 140.
    expect(points.map((p) => p.netWorth)).toEqual([140, 140, 140, 100])
  })

  it('walks an asset balance down as it moves back past a credit', () => {
    const points = run(
      [{ id: 1, type: 'cash', currentBalance: 100 }],
      // Negative amount = money arriving (a deposit).
      [{ accountId: 1, date: '2026-03-10', amount: -60 }]
    )

    expect(points.map((p) => p.netWorth)).toEqual([40, 40, 40, 100])
  })

  /**
   * The case most likely to be wrong. A credit card's stored balance is what is
   * *owed*, and a positive amount is a purchase that increased the debt — so
   * before that day less was owed, and net worth was higher.
   */
  it('reverses the direction for a liability', () => {
    const points = run(
      [{ id: 1, type: 'credit card', currentBalance: 500 }],
      [{ accountId: 1, date: '2026-03-10', amount: 200 }]
    )

    // Owed 500 today, so 300 before today's purchase. Liabilities are negated,
    // so net worth was -300 and is now -500.
    expect(points.map((p) => p.netWorth)).toEqual([-300, -300, -300, -500])
  })

  it('negates liabilities in the total', () => {
    const points = run(
      [
        { id: 1, type: 'cash', currentBalance: 1000 },
        { id: 2, type: 'credit card', currentBalance: 400 },
      ],
      []
    )

    expect(points.at(-1)?.netWorth).toBe(600)
  })

  it('sums several accounts and applies each account`s own movement', () => {
    const points = run(
      [
        { id: 1, type: 'cash', currentBalance: 1000 },
        { id: 2, type: 'credit card', currentBalance: 400 },
      ],
      [
        { accountId: 1, date: '2026-03-10', amount: 100 },
        { accountId: 2, date: '2026-03-10', amount: 50 },
      ]
    )

    // Before today: cash 1100, owed 350 → 750. Today: 1000 - 400 = 600.
    expect(points.map((p) => p.netWorth)).toEqual([750, 750, 750, 600])
  })

  it('accumulates several transactions on the same day', () => {
    const points = run(
      [{ id: 1, type: 'cash', currentBalance: 100 }],
      [
        { accountId: 1, date: '2026-03-10', amount: 30 },
        { accountId: 1, date: '2026-03-10', amount: 20 },
      ],
      2
    )

    expect(points.map((p) => p.netWorth)).toEqual([150, 100])
  })

  it('applies movement on each day it occurs, not only the newest', () => {
    const points = run(
      [{ id: 1, type: 'cash', currentBalance: 100 }],
      [
        { accountId: 1, date: '2026-03-10', amount: 10 },
        { accountId: 1, date: '2026-03-09', amount: 20 },
      ]
    )

    // 100 today; 110 before today's 10; 130 before the 9th's 20.
    expect(points.map((p) => p.netWorth)).toEqual([130, 130, 110, 100])
  })

  it('ignores transactions outside the reconstructed window', () => {
    const points = run(
      [{ id: 1, type: 'cash', currentBalance: 100 }],
      [{ accountId: 1, date: '2025-01-01', amount: 9999 }]
    )

    expect(points.map((p) => p.netWorth)).toEqual([100, 100, 100, 100])
  })

  it('ignores a transaction belonging to an account not in the list', () => {
    const points = run(
      [{ id: 1, type: 'cash', currentBalance: 100 }],
      [{ accountId: 99, date: '2026-03-10', amount: 500 }],
      2
    )

    expect(points.map((p) => p.netWorth)).toEqual([100, 100])
  })

  it('treats a null balance as zero', () => {
    const points = run([{ id: 1, type: 'cash', currentBalance: null }], [], 2)

    expect(points.map((p) => p.netWorth)).toEqual([0, 0])
  })

  it('treats an unrecognised account type as an asset', () => {
    const points = run(
      [{ id: 1, type: 'something-new', currentBalance: 100 }],
      [{ accountId: 1, date: '2026-03-10', amount: 25 }],
      2
    )

    expect(points.map((p) => p.netWorth)).toEqual([125, 100])
  })

  it('returns nothing for an empty account list or a non-positive window', () => {
    expect(run([], [])).toEqual([])
    expect(run([{ id: 1, type: 'cash', currentBalance: 1 }], [], 0)).toEqual([])
  })

  it('does not depend on the time of day', () => {
    const morning = reconstructNetWorthHistory({
      accounts: [{ id: 1, type: 'cash', currentBalance: 100 }],
      transactions: [{ accountId: 1, date: '2026-03-10', amount: 40 }],
      days: 2,
      today: new Date('2026-03-10T00:00:01Z'),
    })
    const night = reconstructNetWorthHistory({
      accounts: [{ id: 1, type: 'cash', currentBalance: 100 }],
      transactions: [{ accountId: 1, date: '2026-03-10', amount: 40 }],
      days: 2,
      today: new Date('2026-03-10T23:59:59Z'),
    })

    expect(morning).toEqual(night)
  })
})
