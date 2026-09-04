import { TransactionCategoryMenu } from '@/components/transactions/TransactionCategoryMenu'
import { Card, CardHeader } from '@/components/ui/Card'
import type { CategoryDto, RecentTransactionDto } from '@/lib/types'
import { formatTransaction } from '@/lib/utils/number-formatters'

interface TransactionsSectionProps {
  transactions: RecentTransactionDto[]
  categories: CategoryDto[]
}

/**
 * Amounts arrive already flipped to the UI convention by `@/lib/db/transaction`
 * — positive is money in — so a positive figure is green and no sign juggling
 * happens here.
 */
export function TransactionsSection({
  transactions,
  categories,
}: TransactionsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-foreground-strong text-[15px] font-semibold">
          Transactions
        </h2>
        <span className="text-foreground-subtle text-xs">
          Click a category to change it
        </span>
      </CardHeader>

      {transactions.length === 0 ? (
        <p className="text-foreground-subtle px-6 py-8 text-center text-[13px]">
          No transactions yet. Plaid delivers them shortly after a bank is
          connected.
        </p>
      ) : (
        // Four columns of which three are fixed-width do not fit a phone, and
        // dropping one loses the point of the table. So the rows scroll
        // sideways inside the card instead of widening the page: `min-w`
        // holds the grid at its natural size and the wrapper clips it. Safe
        // for the category menu, which portals out to `<body>`.
        <div className="overflow-x-auto">
          <div className="flex min-w-[600px] flex-col">
            <div className="border-border-soft text-foreground-subtle grid grid-cols-[84px_minmax(0,1fr)_180px_120px] gap-3 border-b px-4 py-2.5 text-[11px] font-medium tracking-wider uppercase sm:px-6">
              <span>Date</span>
              <span>Description</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
            </div>

            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="border-border-soft grid grid-cols-[84px_minmax(0,1fr)_180px_120px] items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6"
              >
                <span className="text-foreground-muted tabular text-[13px]">
                  {new Date(`${transaction.date}T00:00:00Z`).toLocaleDateString(
                    'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC',
                    }
                  )}
                </span>

                <span className="truncate text-[13px]">
                  {transaction.merchantName ?? transaction.description}
                </span>

                <span className="justify-self-start">
                  <TransactionCategoryMenu
                    transactionId={transaction.id}
                    type={transaction.type}
                    categoryId={transaction.categoryId}
                    categoryName={transaction.category?.subcategory ?? null}
                    categories={categories}
                  />
                </span>

                <span
                  className={
                    transaction.type === 'excluded'
                      ? 'text-foreground-subtle tabular text-right text-[13px]'
                      : transaction.amount > 0
                        ? 'text-positive tabular text-right text-[13px]'
                        : 'tabular text-right text-[13px]'
                  }
                >
                  {transaction.amount > 0 ? '+' : ''}
                  {formatTransaction(transaction.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
