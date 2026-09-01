import type { MonthlyAggregateDto } from '@/lib/db/income-statement'
import {
  computeAverages,
  computeComparisonRows,
  computeSummaryData,
  dtoToMonthlyDataPoint,
  getChartData,
} from '@/lib/utils/income-statement'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Every compute* helper reads `new Date()` internally, so the clock has to be
// frozen for any of them to be assertable. 2026-06-15 local time.
const NOW = new Date(2026, 5, 15, 12, 0, 0)

function dto(
  year: number,
  month: number,
  income: number,
  expenses: number
): MonthlyAggregateDto {
  return {
    year,
    month,
    label: `${year}-${String(month).padStart(2, '0')}`,
    income,
    expenses,
    savings: income - expenses,
  }
}

/** Monthly series over `count` months ending at (endYear, endMonth). */
function series(
  endYear: number,
  endMonth: number,
  count: number,
  income: number,
  expenses: number
): MonthlyAggregateDto[] {
  const out: MonthlyAggregateDto[] = []
  for (let i = count - 1; i >= 0; i--) {
    const ord = endYear * 12 + (endMonth - 1) - i
    out.push(dto(Math.floor(ord / 12), (ord % 12) + 1, income, expenses))
  }
  return out
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('dtoToMonthlyDataPoint', () => {
  it('maps the year/month pair to the first of that month', () => {
    const point = dtoToMonthlyDataPoint(dto(2026, 3, 5000, 3000))
    expect(point.date.getFullYear()).toBe(2026)
    expect(point.date.getMonth()).toBe(2) // 0-indexed March
    expect(point.date.getDate()).toBe(1)
  })

  it('carries label and amounts through unchanged', () => {
    expect(dtoToMonthlyDataPoint(dto(2026, 3, 5000, 3000))).toMatchObject({
      label: '2026-03',
      income: 5000,
      expenses: 3000,
      savings: 2000,
    })
  })

  it('handles month 1 and month 12 without off-by-one drift', () => {
    expect(dtoToMonthlyDataPoint(dto(2026, 1, 0, 0)).date.getMonth()).toBe(0)
    expect(dtoToMonthlyDataPoint(dto(2026, 12, 0, 0)).date.getMonth()).toBe(11)
  })
})

describe('getChartData', () => {
  it('returns the last 14 months', () => {
    const data = series(2026, 6, 20, 100, 50)
    const chart = getChartData(data)
    expect(chart).toHaveLength(14)
    expect(chart[0].label).toBe('2025-05')
    expect(chart[13].label).toBe('2026-06')
  })

  it('returns everything when fewer than 14 months exist', () => {
    expect(getChartData(series(2026, 6, 3, 100, 50))).toHaveLength(3)
  })

  it('returns an empty array for empty input', () => {
    expect(getChartData([])).toEqual([])
  })
})

describe('computeSummaryData', () => {
  it('returns null for empty input', () => {
    expect(computeSummaryData([], '1m')).toBeNull()
  })

  it('sums the current month and compares it with the prior month for 1m', () => {
    const data = [dto(2026, 5, 4000, 1000), dto(2026, 6, 5000, 2000)]
    const summary = computeSummaryData(data, '1m')!
    expect(summary).toMatchObject({
      periodLabel: 'June 2026',
      vsLabel: 'vs. May 2026',
      income: 5000,
      expenses: 2000,
      savings: 3000,
    })
    expect(summary.incomeChange).toEqual({
      absoluteChange: 1000,
      percentChange: 25,
    })
    expect(summary.expensesChange).toEqual({
      absoluteChange: 1000,
      percentChange: 100,
    })
  })

  it('computes savings rate as savings over income', () => {
    const summary = computeSummaryData([dto(2026, 6, 5000, 2000)], '1m')!
    expect(summary.savingsRate).toBeCloseTo(0.6, 10)
  })

  it('reports a savings rate of 0 when income is 0', () => {
    // Guards the division; a 0/0 would otherwise be NaN.
    const summary = computeSummaryData([dto(2026, 6, 0, 500)], '1m')!
    expect(summary.savingsRate).toBe(0)
    expect(summary.savings).toBe(-500)
  })

  it('KNOWN DEFECT: reports a percent change of 0 when the prior value is 0', () => {
    // Same class as the computeBalanceDeltas defect: an undefined percentage
    // is rendered as a real-looking 0% rather than as "no comparison". Here
    // the absolute change does survive, so the two modules disagree on how to
    // present the same situation. Pinned, not fixed.
    const data = [dto(2026, 5, 0, 0), dto(2026, 6, 5000, 2000)]
    const summary = computeSummaryData(data, '1m')!
    expect(summary.incomeChange.absoluteChange).toBe(5000)
    expect(summary.incomeChange.percentChange).toBe(0)
  })

  it('spans three months for 3m and compares with the three before', () => {
    const data = [
      ...series(2026, 3, 3, 100, 40), // prior window: Jan–Mar
      ...series(2026, 6, 3, 200, 60), // current window: Apr–Jun
    ]
    const summary = computeSummaryData(data, '3m')!
    expect(summary).toMatchObject({
      periodLabel: 'Apr – Jun 2026',
      vsLabel: 'vs. Prior 3M',
      income: 600,
      expenses: 180,
    })
    expect(summary.incomeChange).toEqual({
      absoluteChange: 300,
      percentChange: 100,
    })
  })

  it('spans January through the current month for ytd', () => {
    const data = [
      ...series(2025, 6, 6, 100, 50), // 2025 Jan–Jun
      ...series(2026, 6, 6, 100, 50), // 2026 Jan–Jun
    ]
    const summary = computeSummaryData(data, 'ytd')!
    expect(summary).toMatchObject({
      periodLabel: 'YTD 2026',
      vsLabel: 'vs. YTD 2025',
      income: 600,
    })
    // Same six months either side, so no change.
    expect(summary.incomeChange).toEqual({
      absoluteChange: 0,
      percentChange: 0,
    })
  })

  it('spans twelve months for 1y and compares with the twelve before', () => {
    const data = [
      ...series(2025, 6, 12, 100, 50), // Jul 2024 – Jun 2025
      ...series(2026, 6, 12, 100, 50), // Jul 2025 – Jun 2026
    ]
    const summary = computeSummaryData(data, '1y')!
    expect(summary).toMatchObject({
      periodLabel: 'Jul 2025 – Jun 2026',
      vsLabel: 'vs. Prior Year',
      income: 1200,
    })
  })

  it('reports the savings-rate change in percentage points, not percent', () => {
    const data = [
      dto(2026, 5, 1000, 900), // 10% savings rate
      dto(2026, 6, 1000, 500), // 50% savings rate
    ]
    const summary = computeSummaryData(data, '1m')!
    expect(summary.savingsRatePpChange).toBeCloseTo(40, 10)
  })

  it('ignores months outside the requested window', () => {
    const data = [dto(2020, 1, 999999, 0), dto(2026, 6, 5000, 2000)]
    expect(computeSummaryData(data, '1m')!.income).toBe(5000)
  })
})

describe('computeComparisonRows', () => {
  it('returns an empty array for empty input', () => {
    expect(computeComparisonRows([])).toEqual([])
  })

  it('returns exactly the four fixed rows', () => {
    const rows = computeComparisonRows([dto(2026, 6, 100, 50)])
    expect(rows.map((r) => [r.label, r.sublabel])).toEqual([
      ['Month', 'vs. Prior Month'],
      ['Month', 'vs. Same Month Last Year'],
      ['YTD', 'vs. YTD 2025'],
      ['TTM', 'vs. Prior TTM'],
    ])
  })

  it('compares the current month with the prior month', () => {
    const data = [dto(2026, 5, 400, 100), dto(2026, 6, 500, 200)]
    const [priorMonth] = computeComparisonRows(data)
    expect(priorMonth.income).toEqual({
      current: 500,
      absoluteChange: 100,
      percentChange: 25,
    })
    expect(priorMonth.savings).toEqual({
      current: 300,
      absoluteChange: 0,
      percentChange: 0,
    })
  })

  it('compares the current month with the same month a year earlier', () => {
    const data = [dto(2025, 6, 250, 50), dto(2026, 6, 500, 200)]
    const [, sameMonthLastYear] = computeComparisonRows(data)
    expect(sameMonthLastYear.income).toEqual({
      current: 500,
      absoluteChange: 250,
      percentChange: 100,
    })
  })

  it('compares year-to-date against the same span a year earlier', () => {
    const data = [
      ...series(2025, 6, 6, 100, 50), // Jan–Jun 2025
      ...series(2026, 6, 6, 200, 50), // Jan–Jun 2026
    ]
    const [, , ytd] = computeComparisonRows(data)
    expect(ytd.income).toEqual({
      current: 1200,
      absoluteChange: 600,
      percentChange: 100,
    })
  })

  it('compares the trailing twelve months against the twelve before', () => {
    const data = [
      ...series(2025, 6, 12, 100, 50), // prior TTM
      ...series(2026, 6, 12, 100, 50), // current TTM
    ]
    const [, , , ttm] = computeComparisonRows(data)
    expect(ttm.income).toEqual({
      current: 1200,
      absoluteChange: 0,
      percentChange: 0,
    })
  })
})

describe('year-boundary arithmetic (clock frozen in January)', () => {
  // The rest of the file runs in June, so nothing there exercises addMonths
  // stepping backwards across a year boundary — the riskiest arithmetic here.
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
  })

  it('walks 3m back into the previous year', () => {
    const data = [
      ...series(2025, 10, 3, 100, 40), // prior window: Aug–Oct 2025
      ...series(2026, 1, 3, 200, 60), // current window: Nov 2025 – Jan 2026
    ]
    const summary = computeSummaryData(data, '3m')!
    expect(summary).toMatchObject({
      periodLabel: 'Nov – Jan 2026',
      income: 600,
    })
    expect(summary.incomeChange).toEqual({
      absoluteChange: 300,
      percentChange: 100,
    })
  })

  it('treats January as a single-month YTD', () => {
    const data = [...series(2025, 12, 12, 100, 50), dto(2026, 1, 500, 200)]
    const summary = computeSummaryData(data, 'ytd')!
    expect(summary).toMatchObject({
      periodLabel: 'YTD 2026',
      vsLabel: 'vs. YTD 2025',
      income: 500,
    })
    // Prior YTD is January 2025 alone, not the whole of 2025.
    expect(summary.incomeChange.absoluteChange).toBe(400)
  })

  it('walks 1y back two calendar years', () => {
    const summary = computeSummaryData(
      [
        ...series(2025, 1, 12, 100, 50), // Feb 2024 – Jan 2025
        ...series(2026, 1, 12, 100, 50), // Feb 2025 – Jan 2026
      ],
      '1y'
    )!
    expect(summary).toMatchObject({
      periodLabel: 'Feb 2025 – Jan 2026',
      income: 1200,
    })
    expect(summary.incomeChange.absoluteChange).toBe(0)
  })

  it('compares January against the previous December and prior January', () => {
    const data = [
      dto(2025, 1, 100, 0),
      dto(2025, 12, 300, 0),
      dto(2026, 1, 500, 0),
    ]
    const [priorMonth, sameMonthLastYear] = computeComparisonRows(data)
    expect(priorMonth.income).toMatchObject({
      current: 500,
      absoluteChange: 200,
    })
    expect(sameMonthLastYear.income).toMatchObject({
      current: 500,
      absoluteChange: 400,
    })
  })

  it('averages a 3-month window that spans the year boundary', () => {
    const data = [
      dto(2025, 11, 300, 0),
      dto(2025, 12, 300, 0),
      dto(2026, 1, 300, 0),
    ]
    expect(computeAverages(data)[0].income).toBe(300)
  })
})

describe('computeAverages', () => {
  it('returns an empty array for empty input', () => {
    expect(computeAverages([])).toEqual([])
  })

  it('returns 3-, 6- and 12-month rows', () => {
    const rows = computeAverages(series(2026, 6, 12, 100, 50))
    expect(rows.map((r) => [r.period, r.months])).toEqual([
      ['3-Month', 3],
      ['6-Month', 6],
      ['12-Month', 12],
    ])
  })

  it('averages over the months present in the window', () => {
    const rows = computeAverages(series(2026, 6, 12, 1200, 600))
    expect(rows[0]).toMatchObject({ income: 1200, expenses: 600, savings: 600 })
    expect(rows[2]).toMatchObject({ income: 1200, expenses: 600, savings: 600 })
  })

  it('divides by the months actually present, not by the window length', () => {
    // Only two of the last three months have data, so the 3-month average
    // divides by 2 rather than by 3.
    const data = [dto(2026, 5, 300, 0), dto(2026, 6, 100, 0)]
    expect(computeAverages(data)[0].income).toBe(200)
  })

  it('avoids dividing by zero when the window holds no months', () => {
    // Data older than every window; the Math.max(n, 1) floor keeps this finite.
    const rows = computeAverages([dto(2020, 1, 999, 999)])
    expect(rows[0]).toMatchObject({ income: 0, expenses: 0, savings: 0 })
  })

  it('rounds the averaged amounts to whole units', () => {
    const data = [dto(2026, 5, 100, 0), dto(2026, 6, 101, 0)]
    // (100 + 101) / 2 = 100.5 → 101
    expect(computeAverages(data)[0].income).toBe(101)
  })

  it('derives savingsRate from the window totals, not the rounded averages', () => {
    const data = [dto(2026, 5, 100, 50), dto(2026, 6, 300, 150)]
    expect(computeAverages(data)[0].savingsRate).toBeCloseTo(0.5, 10)
  })
})
