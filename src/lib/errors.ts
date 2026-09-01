/**
 * The app's one logging seam.
 *
 * Deliberately a function rather than bare `console.error` at each call site:
 * the private app routed this to Sentry, and the demo will eventually route it
 * to PostHog. Keeping every report behind one door means that swap is one edit
 * rather than a search across the codebase.
 */
export function logError(error: unknown, message?: string) {
  console.error({ message, error })
}
