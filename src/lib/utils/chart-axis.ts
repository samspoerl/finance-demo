import {
  addDays,
  addMonths,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'
import { BalancePeriod } from './balance-deltas'

function generateDailyDates(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  let current = start
  while (current <= end) {
    dates.push(current)
    current = addDays(current, 1)
  }
  return dates
}

function generateWeeklyDates(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  let current = start
  while (current <= end) {
    dates.push(current)
    current = addDays(current, 7)
  }
  return dates
}

function generateMonthlyDates(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  let current = startOfMonth(start)
  const endMonth = startOfMonth(end)

  while (current <= endMonth) {
    dates.push(current)
    current = addMonths(current, 1)
  }

  if (end.getDate() !== 1) {
    dates.push(end)
  }

  return dates
}

export function getChartAxisDates(
  period: BalancePeriod,
  asOf: Date,
  rangeStart?: Date
): Date[] | null {
  const today = startOfDay(asOf)

  switch (period) {
    case '1d':
      return generateDailyDates(subDays(today, 1), today)
    case '1w':
      return generateDailyDates(subDays(today, 7), today)
    case '1m':
      return generateDailyDates(subMonths(today, 1), today)
    case '3m':
      return generateWeeklyDates(subWeeks(today, 12), today)
    case 'ytd':
      return generateWeeklyDates(startOfYear(today), today)
    case '1y':
      return generateMonthlyDates(subYears(today, 1), today)
    case '3y':
      return generateMonthlyDates(subYears(today, 3), today)
    case '5y':
      return generateMonthlyDates(subYears(today, 5), today)
    case '10y':
      return generateMonthlyDates(subYears(today, 10), today)
    case 'all':
      if (!rangeStart) return null
      return generateMonthlyDates(startOfDay(rangeStart), today)
  }
}
