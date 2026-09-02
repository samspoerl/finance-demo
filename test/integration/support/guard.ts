/**
 * Hard safety guard for the integration suite.
 *
 * These tests TRUNCATE every table between cases, so pointing them at anything
 * but the local Docker Postgres is destructive — and this repository's `.env`
 * holds a live Neon `DATABASE_URL` and `DIRECT_URL` sitting in the ambient
 * environment.
 *
 * The demo's Neon database is disposable, unlike the private app's, so the
 * stake here is not irreplaceable data. It is that wiping the shared
 * development database mid-session is a confusing, silent failure: the app
 * keeps running and simply has no accounts any more.
 * `vitest.integration.config.mts` already pins the connection strings, but the
 * config can be edited, so this refuses to run unless the resolved values are
 * unmistakably the throwaway container.
 *
 * Both URLs are checked, not just `DATABASE_URL`: the queries under test connect
 * with that one, but `prisma.config.ts` runs `migrate deploy` against
 * `DIRECT_URL`, which is just as capable of pointing somewhere real.
 *
 * The host check alone is not enough — a developer may well have their own
 * Postgres on localhost — so the database name must match too, and the compose
 * file names it `personal_finance_demo_test` for exactly that reason. See
 * `assertConnectedDatabaseIsLocal` in `./db.ts` for the third check, which
 * interrogates the live connection rather than the string that opened it.
 */

const LOCAL_HOSTS = ['@localhost:', '@127.0.0.1:']
export const EXPECTED_DATABASE = 'personal_finance_demo_test'

function assertLocalUrl(name: string, url: string): void {
  const isLocalHost = LOCAL_HOSTS.some((host) => url.includes(host))
  const isTargetDb = url.includes(EXPECTED_DATABASE)

  if (!isLocalHost || !isTargetDb) {
    throw new Error(
      `Refusing to run integration tests: ${name} must point at the local ` +
        `Docker Postgres (localhost/${EXPECTED_DATABASE}). Run ` +
        `\`pnpm run db:up\` first. Got: ${redact(url)}`
    )
  }
}

/**
 * Strip the password before putting a rejected URL in an error message. The
 * whole point of this guard is that the value may be a real credential.
 */
function redact(url: string): string {
  if (!url) {
    return '(unset)'
  }
  return url.replace(/:\/\/([^:@/]*):[^@/]*@/, '://$1:***@')
}

export function assertLocalDatabase(): void {
  assertLocalUrl('DATABASE_URL', process.env.DATABASE_URL ?? '')
  assertLocalUrl('DIRECT_URL', process.env.DIRECT_URL ?? '')
}
