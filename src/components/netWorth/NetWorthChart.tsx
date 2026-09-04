'use client'

import { cn } from '@/lib/utils'
import type { NetWorthPoint } from '@/lib/utils/net-worth-history'
import { formatBalance } from '@/lib/utils/number-formatters'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PERIODS = [
  { key: '1M', days: 30 },
  { key: '6M', days: 182 },
  { key: '1Y', days: 365 },
  { key: 'All', days: Number.MAX_SAFE_INTEGER },
] as const

type PeriodKey = (typeof PERIODS)[number]['key']

/**
 * The period selector stays client-side rather than becoming a `searchParams`
 * prop. The rule is that URL state selecting a *different server query* belongs
 * to the page, while state that re-slices an already-fetched result stays here —
 * and the page fetches the whole window once, so every period is a slice of
 * bytes the browser already has. A round trip would re-run the same query and
 * return the same data.
 */
export function NetWorthChart({ series }: { series: NetWorthPoint[] }) {
  const [period, setPeriod] = useState<PeriodKey>('6M')

  const data = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? 182
    return series.slice(Math.max(0, series.length - days))
  }, [series, period])

  return (
    <>
      {/* Sits in the card's top-right corner at every width, beside the net
          worth figure. The tighter buttons on a phone are what buy the gap:
          `NetWorthSection` reserves a fixed right inset for this pill, so its
          width is the figure's width budget. */}
      <div className="bg-surface-strong absolute top-4 right-4 flex gap-0.5 rounded-md p-[3px] sm:top-6 sm:right-6">
        {PERIODS.map(({ key }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            aria-pressed={period === key}
            className={cn(
              'rounded px-2 py-0.5 text-[11px] transition-colors sm:px-2.5 sm:py-1 sm:text-xs',
              period === key
                ? 'bg-surface text-foreground-strong border font-semibold'
                : 'text-foreground-muted hover:text-foreground-strong font-medium'
            )}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="h-[196px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-positive)"
                  stopOpacity={0.12}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-positive)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            {/* Recessive: horizontal only, one hairline token, no vertical rules. */}
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border-soft)"
              strokeWidth={1}
            />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={48}
              tickMargin={10}
              tickFormatter={(date: string) =>
                new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
                  month: 'short',
                  timeZone: 'UTC',
                })
              }
              tick={{ fontSize: 11, fill: 'var(--color-foreground-subtle)' }}
            />

            {/* Hidden but present: the domain still has to be computed from the
                data, and `domain` on a hidden axis is what keeps the line off
                the top and bottom edges. */}
            <YAxis hide domain={['dataMin - 500', 'dataMax + 500']} />

            <Tooltip
              cursor={{
                stroke: 'var(--color-border-strong)',
                strokeWidth: 1,
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const point = payload[0].payload as NetWorthPoint
                return (
                  <div className="bg-surface rounded-md border px-3 py-2 shadow-sm">
                    <div className="text-foreground-subtle text-[11px]">
                      {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(
                        'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC',
                        }
                      )}
                    </div>
                    <div className="text-foreground-strong tabular text-sm font-semibold">
                      {formatBalance(point.netWorth)}
                    </div>
                  </div>
                )
              }}
            />

            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="var(--color-positive)"
              strokeWidth={2}
              fill="url(#netWorthFill)"
              // A dot per day would be a number on every point; the hover layer
              // is what answers "what was it on the 4th".
              dot={false}
              activeDot={{
                r: 4,
                fill: 'var(--color-positive)',
                stroke: 'var(--color-surface)',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
