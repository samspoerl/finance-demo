import { normalizeBalance } from '@/lib/utils/account-balance'
import { sortAccountsByBalanceDesc } from '@/lib/utils/account-sort'
import {
  ACCOUNT_TYPES,
  getAccountTypeLabel,
  isAccountType,
} from '@/lib/utils/account-types'

/**
 * Folds a flat account list into the asset/liability → type → account tree the
 * page renders, with a total at every level.
 *
 * `account-types.ts` already knows each type's category and display order, so
 * this reads that rather than restating it — adding a type there is enough for
 * it to appear here, in the right group, in the right place.
 */

export interface RollupAccountInput {
  id: number
  name: string | null
  mask: string | null
  type: string | null
  subtype: string | null
  institutionName: string | null
  currentBalance: number | null
}

export interface RollupAccount extends RollupAccountInput {
  /** Sign-adjusted for net worth: liabilities are negative. */
  amount: number
}

export interface RollupTypeGroup {
  type: string
  label: string
  total: number
  accounts: RollupAccount[]
}

export interface RollupCategoryGroup {
  category: 'asset' | 'liability'
  label: string
  total: number
  types: RollupTypeGroup[]
}

export interface AccountRollups {
  categories: RollupCategoryGroup[]
  /** Sum of asset balances. */
  assets: number
  /** Sum of liability balances, already negative. */
  liabilities: number
  netWorth: number
}

/**
 * An unrecognised type counts as an asset, matching `normalizeBalance`, which
 * only negates types it knows to be liabilities. The two have to agree or a
 * type's rollup would contradict its contribution to net worth.
 */
function categoryOf(type: string | null): 'asset' | 'liability' {
  if (type && isAccountType(type)) {
    const category = ACCOUNT_TYPES[type].category
    if (category === 'liability') return 'liability'
  }
  return 'asset'
}

/** Unknown types sort after every known one, in a stable order among themselves. */
function sortOrderOf(type: string | null): number {
  return type && isAccountType(type)
    ? ACCOUNT_TYPES[type].sortOrder
    : Number.MAX_SAFE_INTEGER
}

export function buildAccountRollups(
  accounts: RollupAccountInput[]
): AccountRollups {
  const byType = new Map<string, RollupAccount[]>()

  for (const account of accounts) {
    const key = account.type ?? 'unknown'
    const entry: RollupAccount = {
      ...account,
      amount: normalizeBalance(account.currentBalance, account.type),
    }
    byType.set(key, [...(byType.get(key) ?? []), entry])
  }

  const typeGroups: RollupTypeGroup[] = Array.from(byType.entries())
    .map(([type, group]) => ({
      type,
      label: getAccountTypeLabel(type === 'unknown' ? null : type),
      total: group.reduce((sum, a) => sum + a.amount, 0),
      accounts: sortAccountsByBalanceDesc(group),
    }))
    .sort(
      (a, b) =>
        sortOrderOf(a.type) - sortOrderOf(b.type) ||
        a.label.localeCompare(b.label)
    )

  const categories: RollupCategoryGroup[] = [
    { category: 'asset' as const, label: 'Assets' },
    { category: 'liability' as const, label: 'Liabilities' },
  ]
    .map(({ category, label }) => {
      const types = typeGroups.filter(
        (group) =>
          categoryOf(group.type === 'unknown' ? null : group.type) === category
      )
      return {
        category,
        label,
        total: types.reduce((sum, group) => sum + group.total, 0),
        types,
      }
    })
    // A category with no accounts is not an empty section to render; it is a
    // section that does not exist yet.
    .filter((group) => group.types.length > 0)

  const assets = categories.find((c) => c.category === 'asset')?.total ?? 0
  const liabilities =
    categories.find((c) => c.category === 'liability')?.total ?? 0

  return { categories, assets, liabilities, netWorth: assets + liabilities }
}
