/** Flips an amount's sign, for the liability/expense display convention. */
export function changeSign(amount: number): number {
  return amount * -1
}
