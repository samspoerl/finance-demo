import { startOfYear, subDays, subMonths, subWeeks, subYears } from 'date-fns'

export type BalancePeriod =
  '1d' | '1w' | '1m' | '3m' | 'ytd' | '1y' | '3y' | '5y' | '10y' | 'all'

export const BALANCE_PERIODS: { key: BalancePeriod; label: string }[] = [
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: 'ytd', label: 'YTD' },
  { key: '1y', label: '1Y' },
  { key: '3y', label: '3Y' },
  { key: '5y', label: '5Y' },
  { key: '10y', label: '10Y' },
  { key: 'all', label: 'ALL' },
]

function getCutoffDate(period: BalancePeriod, from: Date): Date {
  switch (period) {
    case '1d':
      return subDays(from, 1)
    case '1w':
      return subWeeks(from, 1)
    case '1m':
      return subMonths(from, 1)
    case '3m':
      return subMonths(from, 3)
    case 'ytd':
      return startOfYear(from)
    case '1y':
      return subYears(from, 1)
    case '3y':
      return subYears(from, 3)
    case '5y':
      return subYears(from, 5)
    case '10y':
      return subYears(from, 10)
    case 'all':
      return from
  }
}

type AccountBalanceSnapshot = {
  balance: number
  asOfDate: Date
}

/**
 * Find the latest snapshot whose asOfDate is at or before the cutoff.
 */
function snapshotAtOrBefore(
  snapshots: AccountBalanceSnapshot[],
  cutoff: Date
): AccountBalanceSnapshot | null {
  // snapshots are sorted oldest-first from the server action
  let result: AccountBalanceSnapshot | null = null
  for (const s of snapshots) {
    if (s.asOfDate <= cutoff) result = s
    else break
  }
  return result
}

export type BalanceDelta =
  | {
      period: BalancePeriod
      label: string
      absoluteChange: number
      percentChange: number
    }
  | {
      period: BalancePeriod
      label: string
      absoluteChange: null
      percentChange: null
    }

export function computeBalanceDeltas(
  snapshots: AccountBalanceSnapshot[],
  currentBalance: number,
  asOf: Date
): BalanceDelta[] {
  return BALANCE_PERIODS.map(({ key, label }) => {
    const prior =
      key === 'all'
        ? snapshots.length > 0
          ? snapshots[0]
          : null
        : snapshotAtOrBefore(snapshots, getCutoffDate(key, asOf))

    if (!prior) {
      return { period: key, label, absoluteChange: null, percentChange: null }
    }

    const absoluteChange = currentBalance - prior.balance
    const percentChange =
      prior.balance !== 0
        ? (absoluteChange / Math.abs(prior.balance)) * 100
        : null

    if (percentChange === null) {
      return { period: key, label, absoluteChange: null, percentChange: null }
    }

    return { period: key, label, absoluteChange, percentChange }
  })
}
