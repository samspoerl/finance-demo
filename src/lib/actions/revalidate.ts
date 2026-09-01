import { revalidatePath } from 'next/cache'

/**
 * The private app had one revalidation helper per resource — accounts,
 * balances, transactions, institutions, connections — because each mapped to a
 * different set of routes. This app is a single page, so every write
 * invalidates the same thing and there is exactly one call to make.
 *
 * Still a named function rather than an inline `revalidatePath('/')` at each
 * call site: it keeps "what a write invalidates" in one place, so adding a
 * second route later is one edit here instead of an audit of every action.
 */
export function revalidateApp() {
  revalidatePath('/')
}
