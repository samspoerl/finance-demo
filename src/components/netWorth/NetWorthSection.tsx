import { NetWorthChart } from '@/components/netWorth/NetWorthChart'
import { Card } from '@/components/ui/Card'
import type { NetWorthPoint } from '@/lib/utils/net-worth-history'
import { formatBalance } from '@/lib/utils/number-formatters'
import { InfoIcon } from 'lucide-react'

interface NetWorthSectionProps {
  netWorth: number
  series: NetWorthPoint[]
}

export function NetWorthSection({ netWorth, series }: NetWorthSectionProps) {
  // The oldest reconstructed point, so the delta describes the window shown
  // rather than an arbitrary fixed period.
  const opening = series[0]?.netWorth ?? netWorth
  const change = netWorth - opening
  const pct = opening !== 0 ? (change / Math.abs(opening)) * 100 : 0

  return (
    <Card className="relative p-4 sm:p-6">
      {/* The right inset keeps the figure clear of the period selector, which
          is absolutely positioned in the corner by `NetWorthChart`. Above `sm`
          the row is wide enough that they cannot meet. */}
      <div className="mb-4 flex flex-col gap-1.5 pr-32 sm:mb-5 sm:pr-0">
        <span className="text-foreground-muted text-xs font-medium tracking-wider uppercase">
          Net worth
        </span>
        {/* The delta drops below the figure on a phone rather than wrapping
            mid-string beside it — the period selector already owns the top
            right of the card, leaving too little room for both on one line. */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          {/* A step down below 360px: the figure is one unbreakable token, so
              the inset above cannot wrap it away from the selector — at 320 it
              would simply overflow the padding and collide. */}
          <span className="text-foreground-strong tabular font-display text-2xl leading-none font-bold tracking-tight min-[360px]:text-3xl">
            {formatBalance(netWorth)}
          </span>
          {series.length > 1 && (
            <span
              className={
                change >= 0
                  ? 'text-positive tabular text-sm font-semibold'
                  : 'text-negative tabular text-sm font-semibold'
              }
            >
              {change >= 0 ? '+' : '−'}
              {formatBalance(Math.abs(change))} · {Math.abs(pct).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <NetWorthChart series={series} />

      <div className="text-foreground-subtle mt-4 flex items-start gap-2 border-t pt-3.5 text-xs leading-relaxed">
        <InfoIcon className="mt-px size-3.5 shrink-0" />
        <span>
          Reconstructed by walking today&rsquo;s balances back through your
          transaction history. Accounts with no ledger — investments and manual
          accounts — are held flat.
        </span>
      </div>
    </Card>
  )
}
