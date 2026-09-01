/** Shared USD currency formatting/parsing helpers for form inputs. */

export function formatCurrency(value: number | string) {
  if (value === '' || value === null || value === undefined) return ''
  const number =
    typeof value === 'number'
      ? value
      : parseFloat(value.toString().replace(/[^\d.-]/g, ''))
  if (isNaN(number)) return ''
  return number.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function parseCurrencyOrNull(formatted: string): number | null {
  if (!formatted) return null
  const cleaned = formatted.replace(/[^\d.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
    return null
  }

  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseCurrency(formatted: string): number {
  return parseCurrencyOrNull(formatted) ?? 0
}
