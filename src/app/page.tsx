import { AccountsSection } from '@/components/accounts/AccountsSection'
import { HoldingsSection } from '@/components/holdings/HoldingsSection'
import { AppHeader } from '@/components/nav/AppHeader'
import { NetWorthSection } from '@/components/netWorth/NetWorthSection'
import { EmptyState } from '@/components/onboarding/EmptyState'
import { SummarySection } from '@/components/summary/SummarySection'
import { TransactionsSection } from '@/components/transactions/TransactionsSection'
import { getAccountSummaries, getAccounts } from '@/lib/db/account'
import { getIncomeStatementData } from '@/lib/db/income-statement'
import {
  getCategories,
  getRecentTransactions,
  getTransactionsForHistory,
} from '@/lib/db/transaction'
import { getSession } from '@/lib/session'
import { buildAccountRollups } from '@/lib/utils/account-rollups'
import { reconstructNetWorthHistory } from '@/lib/utils/net-worth-history'

/** How far back the reconstructed net worth chart runs. */
const HISTORY_DAYS = 365

/**
 * The whole app. One page, server-rendered, reading `@/lib/db` directly —
 * actions exist only where a client component has to trigger something.
 *
 * `getSession()` rather than `requireUser()`: the proxy creates a session before
 * this renders, so a null one means anonymous sign-in failed upstream. That is a
 * state to render, not an exception to throw at a visitor.
 */
export default async function Page() {
  const session = await getSession()

  if (!session?.user) {
    return (
      <>
        <AppHeader showActions={false} />
        <p className="text-foreground-muted px-8 py-24 text-center text-sm">
          Could not start a demo session. Please reload the page.
        </p>
      </>
    )
  }

  const userId = session.user.id

  const [accounts, summaries, ledger, recent, categories, incomeStatement] =
    await Promise.all([
      getAccounts(userId),
      getAccountSummaries(userId),
      getTransactionsForHistory(userId, HISTORY_DAYS),
      getRecentTransactions(userId),
      getCategories(),
      getIncomeStatementData(userId),
    ])

  if (accounts.length === 0) {
    return (
      <>
        <AppHeader showActions={false} />
        <EmptyState />
      </>
    )
  }

  const rollups = buildAccountRollups(accounts)

  const series = reconstructNetWorthHistory({
    accounts,
    transactions: ledger,
    days: HISTORY_DAYS,
  })

  // The newest month the ledger produced. A brand-new connection can have none
  // yet, in which case the cash-flow card reads zero rather than disappearing —
  // the figures are still true, there is just nothing in them.
  const latestMonth = incomeStatement.monthlyAggregates.at(-1)

  const holdings = summaries
    .flatMap((account) => account.holdings ?? [])
    .sort((a, b) => b.value - a.value)

  return (
    <>
      <AppHeader />
      <main className="flex flex-col gap-5 px-8 pt-7 pb-12">
        <NetWorthSection netWorth={rollups.netWorth} series={series} />

        <SummarySection
          assets={rollups.assets}
          liabilities={rollups.liabilities}
          income={latestMonth?.income ?? 0}
          expenses={latestMonth?.expenses ?? 0}
          savings={latestMonth?.savings ?? 0}
          periodLabel={latestMonth?.label ?? incomeStatement.currentMonthLabel}
        />

        <AccountsSection rollups={rollups} />

        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
          <TransactionsSection transactions={recent} categories={categories} />
          <HoldingsSection holdings={holdings} />
        </div>
      </main>
    </>
  )
}
