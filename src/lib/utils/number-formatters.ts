/**
 * The private app accepted `bigint` here too, from an older schema that stored
 * amounts as cents. Nothing in this schema is `BigInt` — balances and
 * transaction amounts are `Float` — so that branch and its cents converter are
 * gone.
 */
export function formatCurrency(
  amount: number | null | undefined,
  precision: number = 0
): string {
  return (amount ?? 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })
}

export function formatBalance(amount: number | null | undefined) {
  return formatCurrency(amount, 0)
}

export function formatTransaction(amount: number | null | undefined): string {
  return formatCurrency(amount, 2)
}
