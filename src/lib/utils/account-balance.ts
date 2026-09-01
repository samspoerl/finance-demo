import { isLiabilityAccountType } from '@/lib/utils/account-types'

/**
 * Returns the balance adjusted for account type sign convention: liability
 * balances are negated so they represent a reduction in net worth.
 *
 * The private app wrapped this in a `calculateAdjustedBalance` that also
 * weighted by `ownershipShare`, for accounts split across a household. There is
 * no sharing in the demo — one user owns everything they connect — so the
 * weighting and its wrapper are gone.
 */
export function normalizeBalance(
  balance: number | null | undefined,
  type: string | null | undefined
): number {
  if (balance == null) return 0
  return isLiabilityAccountType(type) ? -balance : balance
}
