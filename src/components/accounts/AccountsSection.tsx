import { Card, CardHeader } from '@/components/ui/Card'
import type { AccountRollups } from '@/lib/utils/account-rollups'
import { getAccountSubtypeLabel } from '@/lib/utils/account-types'
import { formatBalance } from '@/lib/utils/number-formatters'

/**
 * Assets and liabilities, each broken into account types, each into accounts,
 * with a total at every level.
 *
 * The hierarchy is indentation and nothing else — no chevrons, no rules, no
 * collapse state — so it needs no tree component and no client boundary. Three
 * padding values carry the whole structure.
 */
export function AccountsSection({ rollups }: { rollups: AccountRollups }) {
  const accountCount = rollups.categories.reduce(
    (sum, category) =>
      sum + category.types.reduce((n, type) => n + type.accounts.length, 0),
    0
  )

  return (
    <Card>
      <CardHeader>
        <h2 className="text-foreground-strong text-[15px] font-semibold">
          Accounts
        </h2>
        <span className="text-foreground-subtle text-xs">
          {accountCount} {accountCount === 1 ? 'account' : 'accounts'}
        </span>
      </CardHeader>

      <div className="flex flex-col">
        {rollups.categories.map((category) => (
          <div key={category.category} className="flex flex-col">
            <div className="bg-surface-strong border-border-soft flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
              <span className="text-foreground-muted font-display text-[11px] font-semibold tracking-widest uppercase">
                {category.label}
              </span>
              <span
                className={
                  category.category === 'liability'
                    ? 'text-negative tabular text-sm font-semibold'
                    : 'text-foreground-strong tabular text-sm font-semibold'
                }
              >
                {formatBalance(category.total)}
              </span>
            </div>

            {category.types.map((type) => (
              <div key={type.type} className="flex flex-col">
                <div className="border-border-soft flex items-center justify-between gap-3 border-b py-2.5 pr-4 pl-7 sm:pr-6 sm:pl-10">
                  <span className="text-foreground-strong text-[13px] font-semibold">
                    {type.label}
                  </span>
                  <span className="text-foreground-muted tabular text-[13px] font-semibold">
                    {formatBalance(type.total)}
                  </span>
                </div>

                {type.accounts.map((account) => (
                  <div
                    key={account.id}
                    className="border-border-soft flex items-center justify-between gap-3 border-b py-2.5 pr-4 pl-10 last:border-b-0 sm:pr-6 sm:pl-14"
                  >
                    {/* The name truncates rather than wraps: the indentation
                        is the only thing carrying the hierarchy, and a row
                        that grows to two lines blurs the level it sits at. */}
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="truncate text-[13px]">
                        {account.institutionName
                          ? `${account.institutionName} · `
                          : ''}
                        {account.name ??
                          getAccountSubtypeLabel(account.type, account.subtype)}
                      </span>
                      {account.mask && (
                        <span className="text-foreground-subtle tabular hidden shrink-0 text-xs sm:inline">
                          ···· {account.mask}
                        </span>
                      )}
                    </div>
                    <span
                      className={
                        account.amount < 0
                          ? 'text-negative tabular shrink-0 text-[13px]'
                          : 'tabular shrink-0 text-[13px]'
                      }
                    >
                      {account.currentBalance === null
                        ? '—'
                        : formatBalance(account.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}
