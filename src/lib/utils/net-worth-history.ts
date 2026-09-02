import { normalizeBalance } from '@/lib/utils/account-balance'
import { isLiabilityAccountType } from '@/lib/utils/account-types'

/**
 * Reconstructs a daily net worth series by walking today's balances backward
 * through the transaction ledger.
 *
 * The private app did not need this: a nightly cron accumulated a real `Balance`
 * snapshot per account per day, and the chart just read them. This demo has no
 * cron, and a visitor who connected a bank thirty seconds ago has exactly one
 * snapshot per account — a chart with a single point. Plaid does hand over up to
 * 730 days of transactions though (`link-token.ts` asks for them), and a balance
 * plus the ledger that produced it is enough to run the arithmetic in reverse.
 *
 * **Accounts with no ledger stay flat.** An investment or manual account has no
 * transactions, so nothing is subtracted as the walk moves back and its balance
 * carries unchanged across the window. That falls out of the algorithm rather
 * than being special-cased, but it is a real limitation and the UI should say so
 * rather than implying the whole line is measured.
 */

export interface HistoryAccount {
  id: number
  /** Internal account type (`'cash'`, `'credit card'`, …), not Plaid's. */
  type: string | null
  /** The balance as reported today. Null accounts contribute nothing. */
  currentBalance: number | null
}

export interface HistoryTransaction {
  accountId: number
  /** `YYYY-MM-DD`, as stored. */
  date: string
  /** Plaid's sign convention: **positive is money leaving the account**. */
  amount: number
}

export interface NetWorthPoint {
  /** `YYYY-MM-DD`. */
  date: string
  netWorth: number
}

interface ReconstructParams {
  accounts: HistoryAccount[]
  transactions: HistoryTransaction[]
  /** How many days back to reconstruct, including today. */
  days: number
  /** Defaults to now. Injectable so the tests are not time-dependent. */
  today?: Date
}

/** `YYYY-MM-DD` in UTC, matching how `Transaction.date` is stored. */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function reconstructNetWorthHistory({
  accounts,
  transactions,
  days,
  today = new Date(),
}: ReconstructParams): NetWorthPoint[] {
  if (days <= 0 || accounts.length === 0) {
    return []
  }

  // Net transaction movement per account per day, so the walk is one lookup per
  // account-day rather than a scan of the whole ledger.
  const movement = new Map<string, number>()
  for (const transaction of transactions) {
    const key = `${transaction.accountId}:${transaction.date}`
    movement.set(key, (movement.get(key) ?? 0) + transaction.amount)
  }

  const balances = new Map<number, number>(
    accounts.map((account) => [account.id, account.currentBalance ?? 0])
  )

  const points: NetWorthPoint[] = []
  const cursor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  )

  for (let i = 0; i < days; i++) {
    const dateKey = toDateKey(cursor)

    let netWorth = 0
    for (const account of accounts) {
      netWorth += normalizeBalance(balances.get(account.id) ?? 0, account.type)
    }
    points.push({ date: dateKey, netWorth })

    // Step back one day by undoing this day's transactions.
    //
    // **The direction depends on the account type**, and getting it backwards
    // is the failure this function is most likely to have. For an asset, a
    // positive amount left the account, so the balance before it was higher.
    // For a liability the stored balance is what is *owed*, and a positive
    // amount is a purchase that increased the debt — so the balance before it
    // was lower. Same ledger, opposite arithmetic.
    for (const account of accounts) {
      const dayMovement = movement.get(`${account.id}:${dateKey}`)
      if (dayMovement === undefined) continue

      const current = balances.get(account.id) ?? 0
      const delta = isLiabilityAccountType(account.type)
        ? -dayMovement
        : dayMovement

      balances.set(account.id, current + delta)
    }

    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  // Built newest-first by the walk; charts want oldest-first.
  return points.reverse()
}
