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
    <Card className="relative p-6">
      <div className="mb-5 flex flex-col gap-1.5">
        <span className="text-foreground-muted text-xs font-medium tracking-wider uppercase">
          Net worth
        </span>
        <div className="flex items-baseline gap-3">
          <span className="text-foreground-strong tabular font-display text-3xl leading-none font-bold tracking-tight">
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
