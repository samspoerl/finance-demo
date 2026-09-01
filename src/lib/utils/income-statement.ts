import type { MonthlyAggregateDto } from '@/lib/db/income-statement'
import type {
  AverageRow,
  ComparisonRow,
  IncomePeriod,
  MonthlyDataPoint,
  PeriodSummaryData,
} from '@/lib/types/income-statement'
import { addMonths as dfAddMonths, format } from 'date-fns'

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns [year, month] after adding `delta` months (delta may be negative). */
function addMonths(
  year: number,
  month: number,
  delta: number
): [number, number] {
  const d = dfAddMonths(new Date(year, month - 1), delta)
  return [d.getFullYear(), d.getMonth() + 1]
}

/** Sum income/expenses for all months in [startYear-startMonth, endYear-endMonth]. */
function sumMonths(
  data: MonthlyAggregateDto[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
) {
  const startOrd = startYear * 12 + startMonth
  const endOrd = endYear * 12 + endMonth
  let income = 0
  let expenses = 0
  for (const d of data) {
    const ord = d.year * 12 + d.month
    if (ord >= startOrd && ord <= endOrd) {
      income += d.income
      expenses += d.expenses
    }
  }
  const savings = income - expenses
  return {
    income,
    expenses,
    savings,
    savingsRate: income > 0 ? savings / income : 0,
  }
}

function delta(
  current: number,
  previous: number
): { absoluteChange: number; percentChange: number } {
  return {
    absoluteChange: current - previous,
    percentChange: previous !== 0 ? ((current - previous) / previous) * 100 : 0,
  }
}

// ─── Public utilities ─────────────────────────────────────────────────────────

/** Convert a DTO to the component type (adds a JS Date for chart formatters). */
export function dtoToMonthlyDataPoint(
  dto: MonthlyAggregateDto
): MonthlyDataPoint {
  return {
    date: new Date(dto.year, dto.month - 1, 1),
    label: dto.label,
    income: dto.income,
    expenses: dto.expenses,
    savings: dto.savings,
  }
}

/** Compute the period-summary card data driven by the period toggle. */
export function computeSummaryData(
  data: MonthlyAggregateDto[],
  period: IncomePeriod
): PeriodSummaryData | null {
  if (data.length === 0) return null

  const today = new Date()
  const [curEndYear, curEndMonth] = [today.getFullYear(), today.getMonth() + 1]

  let curStartYear: number,
    curStartMonth: number,
    prevEndYear: number,
    prevEndMonth: number,
    prevStartYear: number,
    prevStartMonth: number,
    periodLabel: string,
    vsLabel: string

  switch (period) {
    case '1m': {
      curStartYear = curEndYear
      curStartMonth = curEndMonth
      ;[prevEndYear, prevEndMonth] = addMonths(curEndYear, curEndMonth, -1)
      prevStartYear = prevEndYear
      prevStartMonth = prevEndMonth
      periodLabel = format(
        new Date(curEndYear, curEndMonth - 1, 1),
        'MMMM yyyy'
      )
      vsLabel = `vs. ${format(new Date(prevEndYear, prevEndMonth - 1, 1), 'MMM yyyy')}`
      break
    }
    case '3m': {
      ;[curStartYear, curStartMonth] = addMonths(curEndYear, curEndMonth, -2)
      ;[prevEndYear, prevEndMonth] = addMonths(curStartYear, curStartMonth, -1)
      ;[prevStartYear, prevStartMonth] = addMonths(
        prevEndYear,
        prevEndMonth,
        -2
      )
      periodLabel = `${format(new Date(curStartYear, curStartMonth - 1, 1), 'MMM')} – ${format(new Date(curEndYear, curEndMonth - 1, 1), 'MMM yyyy')}`
      vsLabel = 'vs. Prior 3M'
      break
    }
    case 'ytd': {
      curStartYear = curEndYear
      curStartMonth = 1
      prevStartYear = curEndYear - 1
      prevStartMonth = 1
      prevEndYear = curEndYear - 1
      prevEndMonth = curEndMonth
      periodLabel = `YTD ${curEndYear}`
      vsLabel = `vs. YTD ${curEndYear - 1}`
      break
    }
    case '1y': {
      ;[curStartYear, curStartMonth] = addMonths(curEndYear, curEndMonth, -11)
      ;[prevEndYear, prevEndMonth] = addMonths(curStartYear, curStartMonth, -1)
      ;[prevStartYear, prevStartMonth] = addMonths(
        prevEndYear,
        prevEndMonth,
        -11
      )
      periodLabel = `${format(new Date(curStartYear, curStartMonth - 1, 1), 'MMM yyyy')} – ${format(new Date(curEndYear, curEndMonth - 1, 1), 'MMM yyyy')}`
      vsLabel = 'vs. Prior Year'
      break
    }
  }

  const cur = sumMonths(
    data,
    curStartYear!,
    curStartMonth!,
    curEndYear,
    curEndMonth
  )
  const prev = sumMonths(
    data,
    prevStartYear!,
    prevStartMonth!,
    prevEndYear!,
    prevEndMonth!
  )

  return {
    periodLabel: periodLabel!,
    vsLabel: vsLabel!,
    income: cur.income,
    expenses: cur.expenses,
    savings: cur.savings,
    savingsRate: cur.savingsRate,
    incomeChange: delta(cur.income, prev.income),
    expensesChange: delta(cur.expenses, prev.expenses),
    savingsChange: delta(cur.savings, prev.savings),
    savingsRatePpChange: (cur.savingsRate - prev.savingsRate) * 100,
  }
}

/** Fixed four comparison rows (not affected by the period toggle). */
export function computeComparisonRows(
  data: MonthlyAggregateDto[]
): ComparisonRow[] {
  if (data.length === 0) return []

  const today = new Date()
  const [curYear, curMonth] = [today.getFullYear(), today.getMonth() + 1]

  function buildRow(
    label: string,
    sublabel: string,
    curStart: [number, number],
    curEnd: [number, number],
    prevStart: [number, number],
    prevEnd: [number, number]
  ): ComparisonRow {
    const cur = sumMonths(data, curStart[0], curStart[1], curEnd[0], curEnd[1])
    const prev = sumMonths(
      data,
      prevStart[0],
      prevStart[1],
      prevEnd[0],
      prevEnd[1]
    )
    return {
      label,
      sublabel,
      income: { current: cur.income, ...delta(cur.income, prev.income) },
      expenses: {
        current: cur.expenses,
        ...delta(cur.expenses, prev.expenses),
      },
      savings: { current: cur.savings, ...delta(cur.savings, prev.savings) },
    }
  }

  const [prevMonthYear, prevMonthMonth] = addMonths(curYear, curMonth, -1)
  const [ttmStartYear, ttmStartMonth] = addMonths(curYear, curMonth, -11)
  const [priorTtmEndYear, priorTtmEndMonth] = addMonths(
    ttmStartYear,
    ttmStartMonth,
    -1
  )
  const [priorTtmStartYear, priorTtmStartMonth] = addMonths(
    priorTtmEndYear,
    priorTtmEndMonth,
    -11
  )

  return [
    buildRow(
      'Month',
      'vs. Prior Month',
      [curYear, curMonth],
      [curYear, curMonth],
      [prevMonthYear, prevMonthMonth],
      [prevMonthYear, prevMonthMonth]
    ),
    buildRow(
      'Month',
      'vs. Same Month Last Year',
      [curYear, curMonth],
      [curYear, curMonth],
      [curYear - 1, curMonth],
      [curYear - 1, curMonth]
    ),
    buildRow(
      'YTD',
      `vs. YTD ${curYear - 1}`,
      [curYear, 1],
      [curYear, curMonth],
      [curYear - 1, 1],
      [curYear - 1, curMonth]
    ),
    buildRow(
      'TTM',
      'vs. Prior TTM',
      [ttmStartYear, ttmStartMonth],
      [curYear, curMonth],
      [priorTtmStartYear, priorTtmStartMonth],
      [priorTtmEndYear, priorTtmEndMonth]
    ),
  ]
}

/** Rolling monthly averages (3, 6, 12 months ending at the most recent month). */
export function computeAverages(data: MonthlyAggregateDto[]): AverageRow[] {
  if (data.length === 0) return []

  const today = new Date()
  const [curYear, curMonth] = [today.getFullYear(), today.getMonth() + 1]

  function avg(months: number): AverageRow {
    const [startYear, startMonth] = addMonths(curYear, curMonth, -(months - 1))
    const startOrd = startYear * 12 + startMonth
    const endOrd = curYear * 12 + curMonth
    const n = data.filter((d) => {
      const ord = d.year * 12 + d.month
      return ord >= startOrd && ord <= endOrd
    }).length
    const s = sumMonths(data, startYear, startMonth, curYear, curMonth)
    const divisor = Math.max(n, 1)
    return {
      period: `${months}-Month`,
      months,
      income: Math.round(s.income / divisor),
      expenses: Math.round(s.expenses / divisor),
      savings: Math.round(s.savings / divisor),
      savingsRate: s.savingsRate,
    }
  }

  return [avg(3), avg(6), avg(12)]
}

/**
 * Returns the last 14 months of data (or all if fewer) as MonthlyDataPoints
 * for the main bar chart.
 */
export function getChartData(data: MonthlyAggregateDto[]): MonthlyDataPoint[] {
  return data.slice(-14).map(dtoToMonthlyDataPoint)
}
