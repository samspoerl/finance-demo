import type { BalancePeriod } from '@/lib/utils/balance-deltas'

export type IncomePeriod = Extract<BalancePeriod, '1m' | '3m' | 'ytd' | '1y'>

export const INCOME_PERIODS: IncomePeriod[] = ['1m', '3m', 'ytd', '1y']

export const INCOME_PERIOD_EXCLUDE: BalancePeriod[] = [
  '1d',
  '1w',
  '3y',
  '5y',
  '10y',
  'all',
]

export const ALL_TRANSACTIONS_PAGE_SIZE = 100

export interface MonthlyDataPoint {
  date: Date
  label: string
  income: number
  expenses: number
  savings: number
}

export interface ChangeValue {
  absoluteChange: number
  percentChange: number
}

export interface PeriodSummaryData {
  periodLabel: string
  vsLabel: string
  income: number
  expenses: number
  savings: number
  savingsRate: number
  incomeChange: ChangeValue
  expensesChange: ChangeValue
  savingsChange: ChangeValue
  /** Percentage-point change in savings rate */
  savingsRatePpChange: number
}

export interface ComparisonRow {
  label: string
  sublabel: string
  income: ChangeValue & { current: number }
  expenses: ChangeValue & { current: number }
  savings: ChangeValue & { current: number }
}

export interface AverageRow {
  period: string
  months: number
  income: number
  expenses: number
  savings: number
  savingsRate: number
}

export interface ExpenseCategory {
  key: string
  name: string
  amount: number
  percent: number
}
