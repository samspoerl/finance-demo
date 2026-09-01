import prisma from '@/lib/prisma'
import 'server-only'

/**
 * The income statement aggregate: one Prisma query plus the in-memory rollup it
 * feeds. Like every module in `src/lib/db`, it takes `userId` as a parameter and
 * does no session check of its own — authentication and `ServerResult` wrapping
 * belong to the action layer.
 *
 * The three DTOs are declared here rather than in `@/lib/types` because this
 * rollup is their only producer. `@/lib/utils/income-statement` imports
 * `MonthlyAggregateDto` with `import type`, which is erased and so does not pull
 * `server-only` into a client bundle.
 */

export interface MonthlyAggregateDto {
  year: number
  month: number // 1-12
  label: string // e.g. "Jan 2026"
  income: number
  expenses: number
  savings: number
}

export interface CategoryBreakdownItemDto {
  key: string
  name: string
  amount: number
  percent: number
}

export interface IncomeStatementDto {
  monthlyAggregates: MonthlyAggregateDto[]
  categoryBreakdown: CategoryBreakdownItemDto[]
  currentMonthLabel: string
}

// ─── Month labels ─────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const MONTH_FULL_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getIncomeStatementData(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: { in: ['income', 'expense'] },
    },
    select: {
      amount: true,
      date: true,
      type: true,
      category: {
        select: { category: true },
      },
    },
    orderBy: { date: 'asc' },
  })

  // Flip Plaid's sign convention (positive = debit) to the UI's
  // (positive = credit). `type` is already authoritative from sync time.
  const eligible = transactions.map((t) => ({ ...t, amount: t.amount * -1 }))

  // ── Group by year-month ──────────────────────────────────────────────────
  const monthMap = new Map<string, { income: number; expenses: number }>()
  for (const t of eligible) {
    const [yearStr, monthStr] = t.date.split('-')
    const key = `${yearStr}-${monthStr}`
    const agg = monthMap.get(key) ?? { income: 0, expenses: 0 }
    if (t.type === 'income') {
      agg.income += t.amount
    } else {
      // Negate so expenses accumulate as a positive number. A return (negative
      // expense in Plaid → positive after the flip) subtracts here.
      agg.expenses -= t.amount
    }
    monthMap.set(key, agg)
  }

  const monthlyAggregates: MonthlyAggregateDto[] = Array.from(
    monthMap.entries()
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, agg]) => {
      const [yearStr, monthStr] = key.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      const income = Math.round(agg.income)
      const expenses = Math.round(agg.expenses)
      return {
        year,
        month,
        label: `${MONTH_LABELS[month - 1]} ${year}`,
        income,
        expenses,
        savings: income - expenses,
      }
    })

  // ── Current-month expense category breakdown ─────────────────────────────
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1
  const currentKey = `${nowYear}-${String(nowMonth).padStart(2, '0')}`

  const currentExpenseTxs = eligible.filter((t) => {
    const [y, m] = t.date.split('-')
    return `${y}-${m}` === currentKey && t.type === 'expense'
  })

  const catMap = new Map<string, number>()
  for (const t of currentExpenseTxs) {
    const cat = t.category?.category ?? 'Uncategorized'
    // Already sign-flipped: negative = expense, positive = return/refund.
    catMap.set(cat, (catMap.get(cat) ?? 0) - t.amount)
  }

  const totalExpenses = Array.from(catMap.values()).reduce((s, v) => s + v, 0)

  const categoryBreakdown: CategoryBreakdownItemDto[] = Array.from(
    catMap.entries()
  )
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => ({
      key: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      amount: Math.round(amount),
      percent: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))

  const currentMonthLabel = `${MONTH_FULL_LABELS[nowMonth - 1]} ${nowYear}`

  return { monthlyAggregates, categoryBreakdown, currentMonthLabel }
}
