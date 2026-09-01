import pluralize from 'pluralize'

export function capitalizeAndPluralize(value: string): string {
  if (!value) return ''

  const words = value.trim().split(' ')
  const lastWordIndex = words.length - 1

  const transformed = words.map((word, index) => {
    const wordToUse = index === lastWordIndex ? pluralize(word) : word
    return wordToUse[0].toUpperCase() + wordToUse.slice(1)
  })

  return transformed.join(' ')
}

export function toProperCase(value: string): string {
  if (!value) return ''

  const words = value.trim().split(' ')

  const transformed = words.map((word) => {
    return word[0].toUpperCase() + word.slice(1)
  })

  return transformed.join(' ')
}

export function toTitleCase(value: string): string {
  if (!value) return ''
  return value
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
