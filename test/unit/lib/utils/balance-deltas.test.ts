import {
  BALANCE_PERIODS,
  computeBalanceDeltas,
  type BalanceDelta,
  type BalancePeriod,
} from '@/lib/utils/balance-deltas'
import { describe, expect, it } from 'vitest'

// Dates are built with the local-time constructor throughout. date-fns'
// sub*/startOfYear helpers work in local time, so mixing in UTC-midnight
// fixtures would make the boundary assertions depend on the runner's timezone.
const ASOF = new Date(2026, 5, 15) // 2026-06-15

function snap(year: number, month: number, day: number, balance: number) {
  return { asOfDate: new Date(year, month - 1, day), balance }
}

function byPeriod(deltas: BalanceDelta[]) {
  return Object.fromEntries(deltas.map((d) => [d.period, d])) as Record<
    BalancePeriod,
    BalanceDelta
  >
}

describe('BALANCE_PERIODS', () => {
  it('lists every period exactly once, shortest first', () => {
    expect(BALANCE_PERIODS.map((p) => p.key)).toEqual([
      '1d',
      '1w',
      '1m',
      '3m',
      'ytd',
      '1y',
      '3y',
      '5y',
      '10y',
      'all',
    ])
  })

  it('pairs each key with an uppercase display label', () => {
    expect(BALANCE_PERIODS.map((p) => p.label)).toEqual([
      '1D',
      '1W',
      '1M',
      '3M',
      'YTD',
      '1Y',
      '3Y',
      '5Y',
      '10Y',
      'ALL',
    ])
  })
})

describe('computeBalanceDeltas', () => {
  it('returns one entry per period, in BALANCE_PERIODS order', () => {
    const deltas = computeBalanceDeltas([], 100, ASOF)
    expect(deltas).toHaveLength(BALANCE_PERIODS.length)
    expect(deltas.map((d) => d.period)).toEqual(
      BALANCE_PERIODS.map((p) => p.key)
    )
  })

  it('returns null changes for every period when there are no snapshots', () => {
    for (const d of computeBalanceDeltas([], 100, ASOF)) {
      expect(d.absoluteChange).toBeNull()
      expect(d.percentChange).toBeNull()
    }
  })

  it('computes absolute and percent change against the prior snapshot', () => {
    const deltas = byPeriod(
      computeBalanceDeltas([snap(2026, 6, 14, 100)], 150, ASOF)
    )
    expect(deltas['1d']).toMatchObject({
      absoluteChange: 50,
      percentChange: 50,
    })
  })

  it('picks the latest snapshot at or before the cutoff, not the first', () => {
    // The 1m cutoff is 2026-05-15; both May snapshots qualify, the later wins.
    const snapshots = [
      snap(2026, 4, 1, 10),
      snap(2026, 5, 1, 20),
      snap(2026, 5, 15, 30),
      snap(2026, 6, 1, 40),
    ]
    expect(
      byPeriod(computeBalanceDeltas(snapshots, 100, ASOF))['1m']
    ).toMatchObject({ absoluteChange: 70 })
  })

  it('includes a snapshot falling exactly on the cutoff', () => {
    // subDays(2026-06-15, 1) === 2026-06-14 and the comparison is `<=`.
    const deltas = byPeriod(
      computeBalanceDeltas([snap(2026, 6, 14, 100)], 100, ASOF)
    )
    expect(deltas['1d'].absoluteChange).toBe(0)
  })

  it('excludes a snapshot one day newer than the cutoff', () => {
    const deltas = byPeriod(
      computeBalanceDeltas([snap(2026, 6, 15, 100)], 150, ASOF)
    )
    expect(deltas['1d'].absoluteChange).toBeNull()
  })

  it('anchors ytd to January 1 of the asOf year', () => {
    const snapshots = [
      snap(2025, 12, 31, 500),
      snap(2026, 1, 1, 600),
      snap(2026, 2, 1, 700),
    ]
    // Jan 1 is exactly startOfYear, so it counts; Feb 1 is past the cutoff.
    expect(
      byPeriod(computeBalanceDeltas(snapshots, 1000, ASOF))['ytd']
    ).toMatchObject({ absoluteChange: 400 })
  })

  it('uses the oldest snapshot for "all", ignoring the cutoff entirely', () => {
    const snapshots = [snap(2019, 1, 1, 10), snap(2026, 6, 1, 90)]
    expect(
      byPeriod(computeBalanceDeltas(snapshots, 100, ASOF))['all']
    ).toMatchObject({ absoluteChange: 90, percentChange: 900 })
  })

  it('computes percent change against the absolute prior balance', () => {
    // A liability moving from -100 to -50 improves by 50, i.e. +50%.
    const deltas = byPeriod(
      computeBalanceDeltas([snap(2026, 6, 14, -100)], -50, ASOF)
    )
    expect(deltas['1d']).toMatchObject({
      absoluteChange: 50,
      percentChange: 50,
    })
  })

  it('reports a negative change when the balance falls', () => {
    const deltas = byPeriod(
      computeBalanceDeltas([snap(2026, 6, 14, 200)], 150, ASOF)
    )
    expect(deltas['1d']).toMatchObject({
      absoluteChange: -50,
      percentChange: -25,
    })
  })

  it('KNOWN DEFECT: discards the absolute change when the prior balance is zero', () => {
    // Percent change is undefined against a zero base, and the implementation
    // drops `absoluteChange` with it — so a real +100 move renders as "no
    // data" rather than as an unquantifiable percentage. Pinned, not fixed.
    const deltas = byPeriod(
      computeBalanceDeltas([snap(2026, 6, 14, 0)], 100, ASOF)
    )
    expect(deltas['1d']).toMatchObject({
      absoluteChange: null,
      percentChange: null,
    })
  })

  it('KNOWN DEFECT: silently returns the wrong delta for unsorted snapshots', () => {
    // The scan breaks at the first snapshot past the cutoff, so oldest-first
    // ordering is a hard precondition — documented only in a comment on the
    // helper. Newest-first input stops immediately and finds nothing, even
    // though a qualifying snapshot is present. Pinned, not fixed.
    const newestFirst = [snap(2026, 6, 1, 40), snap(2026, 5, 1, 20)]
    expect(
      byPeriod(computeBalanceDeltas(newestFirst, 100, ASOF))['1m']
    ).toMatchObject({ absoluteChange: null })
  })

  it('carries the display label through to every delta', () => {
    const labels = new Map(BALANCE_PERIODS.map((p) => [p.key, p.label]))
    for (const d of computeBalanceDeltas([], 0, ASOF)) {
      expect(d.label).toBe(labels.get(d.period))
    }
  })
})
