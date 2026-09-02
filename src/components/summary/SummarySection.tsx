import { Card } from '@/components/ui/Card'
import { formatBalance } from '@/lib/utils/number-formatters'

interface SummarySectionProps {
  assets: number
  /** Already negative. */
  liabilities: number
  income: number
  expenses: number
  savings: number
  periodLabel: string
}

/**
 * Six figures in two groups, because they answer two different questions:
 * what you own and owe right now, and what moved this month. A single row of
 * six would imply they belong to one scale.
 */
export function SummarySection({
  assets,
  liabilities,
  income,
  expenses,
  savings,
  periodLabel,
}: SummarySectionProps) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <Card className="px-6 py-5">
        <span className="text-foreground-muted text-xs font-medium tracking-wider uppercase">
          Balance sheet
        </span>
        <div className="mt-4 grid grid-cols-2 gap-5">
          <Stat label="Assets" value={formatBalance(assets)} />
          <Stat
            label="Liabilities"
            value={formatBalance(liabilities)}
            tone={liabilities !== 0 ? 'negative' : undefined}
          />
        </div>
      </Card>

      <Card className="px-6 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-foreground-muted text-xs font-medium tracking-wider uppercase">
            Cash flow
          </span>
          <span className="text-foreground-subtle text-xs">{periodLabel}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-5">
          <Stat
            label="Income"
            value={formatBalance(income)}
            tone={income !== 0 ? 'positive' : undefined}
          />
          <Stat label="Expenses" value={formatBalance(expenses)} />
          <Stat label="Savings" value={formatBalance(savings)} />
        </div>
      </Card>
    </div>
  )
}

/**
 * Local to this file rather than a `ui/` primitive: it is a label over a figure,
 * used five times on one screen and nowhere else. Extracting it further would
 * be abstracting a repeated Tailwind string, not a repeated behaviour.
 */
function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-positive'
      : tone === 'negative'
        ? 'text-negative'
        : 'text-foreground-strong'

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm">{label}</span>
      <span
        className={`tabular font-display text-2xl font-semibold tracking-tight ${toneClass}`}
      >
        {value}
      </span>
    </div>
  )
}
