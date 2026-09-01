/**
 * Orders accounts for display, largest balance first.
 *
 * Sorts on the raw `currentBalance` — the number the card and the table
 * actually show — rather than the sign-adjusted one from
 * `@/lib/utils/account-balance`. The card view groups by account type before
 * rendering, so assets and liabilities never share a list, and within a
 * liability group the raw value puts the largest debt at the top, which is
 * what "largest first" means to someone reading that group.
 *
 * A `null` balance means "no snapshot yet", not zero, so those accounts sort
 * to the end instead of landing among the zeroes. Ties keep their incoming
 * order — `Array.prototype.sort` is stable — so equal balances stay in the id
 * order the query returned them in.
 */
export function sortAccountsByBalanceDesc<
  T extends { currentBalance: number | null },
>(accounts: T[]): T[] {
  return [...accounts].sort((a, b) => {
    if (a.currentBalance === null) return b.currentBalance === null ? 0 : 1
    if (b.currentBalance === null) return -1
    return b.currentBalance - a.currentBalance
  })
}
