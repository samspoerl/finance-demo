import { getChartAxisDates } from '@/lib/utils/chart-axis'
import { differenceInCalendarDays, isSameDay } from 'date-fns'
import { describe, expect, it } from 'vitest'

// date-fns works in local time, so the fixtures are built locally too.
const ASOF = new Date(2026, 5, 15, 13, 45, 0) // 2026-06-15, mid-afternoon

function dates(...args: Parameters<typeof getChartAxisDates>) {
  const result = getChartAxisDates(...args)
  if (!result) throw new Error('expected dates, got null')
  return result
}

describe('getChartAxisDates', () => {
  it('normalises asOf to the start of the day', () => {
    const [, last] = dates('1d', ASOF)
    expect(last.getHours()).toBe(0)
    expect(last.getMinutes()).toBe(0)
    expect(isSameDay(last, ASOF)).toBe(true)
  })

  it('returns yesterday and today for 1d', () => {
    const result = dates('1d', ASOF)
    expect(result).toHaveLength(2)
    expect(result[0].getDate()).toBe(14)
    expect(result[1].getDate()).toBe(15)
  })

  it('returns eight daily points for 1w — seven days back, inclusive', () => {
    const result = dates('1w', ASOF)
    expect(result).toHaveLength(8)
    expect(differenceInCalendarDays(result[7], result[0])).toBe(7)
  })

  it('steps one day at a time for 1m', () => {
    const result = dates('1m', ASOF)
    // 2026-05-15 through 2026-06-15 inclusive: 31 days + 1.
    expect(result).toHaveLength(32)
    for (let i = 1; i < result.length; i++) {
      expect(differenceInCalendarDays(result[i], result[i - 1])).toBe(1)
    }
  })

  it('steps seven days at a time for 3m', () => {
    const result = dates('3m', ASOF)
    for (let i = 1; i < result.length; i++) {
      expect(differenceInCalendarDays(result[i], result[i - 1])).toBe(7)
    }
    // 12 weeks back, stepping weekly, inclusive of both ends.
    expect(result).toHaveLength(13)
  })

  it('steps weekly from January 1 for ytd', () => {
    const result = dates('ytd', ASOF)
    expect(result[0].getMonth()).toBe(0)
    expect(result[0].getDate()).toBe(1)
    for (let i = 1; i < result.length; i++) {
      expect(differenceInCalendarDays(result[i], result[i - 1])).toBe(7)
    }
  })

  it('never overshoots the asOf date', () => {
    const today = new Date(2026, 5, 15)
    for (const period of ['1d', '1w', '1m', '3m', 'ytd'] as const) {
      for (const d of dates(period, ASOF)) {
        expect(d.getTime()).toBeLessThanOrEqual(today.getTime())
      }
    }
  })

  it('returns month starts plus the asOf date for 1y', () => {
    const result = dates('1y', ASOF)
    // Jun 2025 through Jun 2026 month starts (13), plus the trailing Jun 15.
    expect(result).toHaveLength(14)
    for (const d of result.slice(0, 13)) {
      expect(d.getDate()).toBe(1)
    }
    const last = result[13]
    expect(last.getDate()).toBe(15)
    expect(last.getMonth()).toBe(5)
  })

  it('omits the trailing point when asOf is already the first of a month', () => {
    const firstOfMonth = new Date(2026, 5, 1)
    const result = dates('1y', firstOfMonth)
    expect(result.every((d) => d.getDate() === 1)).toBe(true)
    expect(result).toHaveLength(13)
  })

  it('spans three, five and ten years of month starts', () => {
    expect(dates('3y', ASOF)).toHaveLength(3 * 12 + 1 + 1)
    expect(dates('5y', ASOF)).toHaveLength(5 * 12 + 1 + 1)
    expect(dates('10y', ASOF)).toHaveLength(10 * 12 + 1 + 1)
  })

  it('steps one month at a time for the monthly periods', () => {
    const result = dates('3y', ASOF).slice(0, -1)
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]
      const cur = result[i]
      const monthsApart =
        (cur.getFullYear() - prev.getFullYear()) * 12 +
        (cur.getMonth() - prev.getMonth())
      expect(monthsApart).toBe(1)
    }
  })

  it('returns null for "all" without a range start', () => {
    expect(getChartAxisDates('all', ASOF)).toBeNull()
  })

  it('generates monthly points from the range start for "all"', () => {
    const result = dates('all', ASOF, new Date(2024, 0, 20))
    // The start is snapped back to the start of its month, hence Jan 1 2024.
    expect(result[0].getFullYear()).toBe(2024)
    expect(result[0].getMonth()).toBe(0)
    expect(result[0].getDate()).toBe(1)
    expect(result[result.length - 1].getDate()).toBe(15)
  })

  it('returns the month start plus asOf when the "all" range start is today', () => {
    const result = dates('all', ASOF, new Date(2026, 5, 15))
    expect(result).toHaveLength(2)
    expect(result[0].getDate()).toBe(1)
    expect(result[1].getDate()).toBe(15)
  })

  it('returns a single trailing point when the "all" range starts after asOf', () => {
    // The monthly loop never runs, so only the unconditional trailing asOf
    // push survives — an axis of one point rather than an empty one.
    const result = dates('all', ASOF, new Date(2027, 0, 10))
    expect(result).toHaveLength(1)
    expect(result[0].getDate()).toBe(15)
    expect(result[0].getFullYear()).toBe(2026)
  })

  it('returns an ascending series for every period', () => {
    for (const period of ['1d', '1w', '1m', '3m', 'ytd', '1y', '3y'] as const) {
      const result = dates(period, ASOF)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].getTime()).toBeGreaterThan(result[i - 1].getTime())
      }
    }
  })

  it('handles a January 1 asOf for ytd without producing an empty axis', () => {
    const result = dates('ytd', new Date(2026, 0, 1, 9, 0, 0))
    expect(result).toHaveLength(1)
    expect(result[0].getMonth()).toBe(0)
  })
})
