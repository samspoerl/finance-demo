import { Card, CardHeader } from '@/components/ui/Card'
import type { AccountSummary } from '@/lib/db/account'
import { formatBalance } from '@/lib/utils/number-formatters'
import { InfoIcon } from 'lucide-react'

type Holding = NonNullable<AccountSummary['holdings']>[number]

/**
 * Securities across every investment account, largest first.
 *
 * Deliberately does not total: these describe what is inside an account, and
 * the account's value is its balance. A total here would invite reading it as
 * the investment figure, which is the coupling the schema removed.
 */
export function HoldingsSection({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <h2 className="text-foreground-strong text-[15px] font-semibold">
          Holdings
        </h2>
      </CardHeader>

      <div className="flex flex-col">
        {holdings.map((holding) => (
          <div
            key={holding.securityId}
            className="border-border-soft flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-foreground-strong text-[13px] font-semibold">
                {holding.tickerSymbol ?? holding.securityName ?? 'Unknown'}
              </span>
              {holding.tickerSymbol && holding.securityName && (
                <span className="text-foreground-subtle truncate text-xs">
                  {holding.securityName}
                </span>
              )}
            </div>
            <span className="tabular shrink-0 text-[13px]">
              {formatBalance(holding.value)}
            </span>
          </div>
        ))}

        <div className="text-foreground-subtle flex items-start gap-2 px-4 py-3.5 text-xs leading-relaxed sm:px-6">
          <InfoIcon className="mt-px size-3.5 shrink-0" />
          <span>
            Holdings describe what is in an account. The account&rsquo;s value
            comes from its balance.
          </span>
        </div>
      </div>
    </Card>
  )
}
