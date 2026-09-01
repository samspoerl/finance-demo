import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Plaid sandbox credentials come from the developer's `.env` (and from
// repository secrets in CI). Loaded explicitly and **before** the hardcoded
// values below, so that anything this file pins still wins.
//
// The private app this is derived from loaded `.env.local` specifically, to
// keep the suite from ever seeing the live Neon URLs in `.env`. That separation
// is dropped here on purpose — this project keeps everything in one `.env`, and
// its Neon database is a disposable sandbox rather than a decade of
// irreplaceable history. The protection is not the file boundary anyway: the
// `Object.assign` below overwrites whatever dotenv set, `testEnv` forwards only
// the Plaid names to the workers, and `support/guard.ts` refuses to run against
// anything but the local container. Three checks, none of which depend on which
// file the values came from.
loadEnv({ path: '.env', quiet: true })

// The local Docker Postgres from compose.yaml, and the single source of truth
// for how the integration suite connects. These are deliberately hardcoded
// rather than read from a `.env` file: they're the fixed, non-secret credentials
// of a throwaway container, and a suite that TRUNCATEs between tests must not be
// able to inherit a connection string from the ambient shell.
// `support/guard.ts` is the second check and `support/db.ts` the third.
const DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/personal_finance_demo_test?schema=public'

const env = {
  DATABASE_URL,
  // `prisma.config.ts` reads DIRECT_URL for `migrate deploy`.
  DIRECT_URL: DATABASE_URL,
  // Pinned, not inherited. `src/lib/plaid/client.ts` chooses its secret from
  // this variable and bakes it into every request header, so an ambient
  // `PLAID_ENV=production` would point the suite at real institutions and
  // create real billable items. `test/integration/support/plaid.ts` re-checks
  // it before every item it creates.
  PLAID_ENV: 'sandbox',
}

// `test.env` below covers the worker processes that run the tests. The global
// setup runs in *this* process, where it shells out to `prisma migrate deploy`,
// so it needs the same values on process.env. Assigning wins over the shell for
// the same reason `override: true` would: no ambient DATABASE_URL may leak in.
// It also wins over `prisma.config.ts`'s `import 'dotenv/config'`, because
// dotenv leaves an already-set variable alone.
Object.assign(process.env, env)

// Vitest runs specs in separate worker processes, which receive `test.env`
// rather than this process's `process.env`. The Plaid credentials are secrets,
// so they are forwarded by name and only when actually present — a missing one
// leaves the specs to skip via `hasPlaidCredentials()` instead of failing.
//
// Note what is NOT forwarded: DATABASE_URL and DIRECT_URL reach the workers
// only as the hardcoded values in `env` above. There is no path by which a
// worker sees the Neon URL that `loadEnv` just read.
const PLAID_PASSTHROUGH = [
  'PLAID_CLIENT_ID',
  'PLAID_SANDBOX_SECRET',
  // Not a secret, and not required: `link-token.ts` falls back to
  // `http://localhost:3000`, which is registered for this client. Passed
  // through only so a developer can point at a different registered URI.
  // Forwarded only when truthy — an empty value must stay unset, since `??`
  // in `link-token.ts` would not fall back on `''`.
  'PLAID_REDIRECT_URI',
] as const

const testEnv: Record<string, string> = { ...env }
for (const name of PLAID_PASSTHROUGH) {
  const value = process.env[name]
  if (value) {
    testEnv[name] = value
  }
}

export default defineConfig({
  resolve: {
    alias: {
      // tsconfig.json declares one path per top-level directory; this single
      // `@` → `src` alias is a deliberate superset, matching vitest.config.mts.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Every module in `src/lib/db` opens with `import 'server-only'`, which
      // throws outside a React Server Component. Point vitest at the same empty
      // module Next resolves it to under the `react-server` condition, exactly
      // as the unit config does — see the long note there for why this weakens
      // nothing.
      'server-only': fileURLToPath(
        new URL('./node_modules/server-only/empty.js', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    // Suites are split by what they need to run, not by what they cover: these
    // require Postgres, so they sit under `test/integration/` and the unit
    // config's `test/unit/**` glob can never pick them up. Specs below this
    // mirror the `src/` path of what they cover, same as the unit suite.
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['./test/integration/support/setup.ts'],
    globalSetup: ['./test/integration/support/global-setup.ts'],
    // One shared database, truncated between tests, so files can't run in
    // parallel — they would race on the same rows.
    fileParallelism: false,
    // Generous next to the unit suite's default: the first test pays for the
    // connection, and CI's Postgres is a cold container.
    // Generous again for the Plaid specs, which make real round trips to the
    // sandbox API.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: testEnv,
  },
})
