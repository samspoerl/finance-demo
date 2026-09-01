import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests only. Almost everything under test here is a pure function from
// `src/lib/utils`; the exceptions are the modules guarded by `server-only` (see
// the alias below). Either way there is no DOM and no Next.js request context
// to set up — `node` is both the fastest environment and the honest one.
export default defineConfig({
  resolve: {
    alias: {
      // tsconfig.json declares one path per top-level directory
      // (`@/lib/*`, `@/components/*`, …); this single `@` → `src` alias is a
      // deliberate superset of those. Anything it would resolve that tsconfig
      // would not is caught by `tsc` in the same `pnpm run ci`.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws on import outside a React Server Component, which
      // is exactly its job in the app and exactly what makes a guarded module
      // untestable here. Next resolves it to an empty module under the
      // `react-server` condition; point vitest at that same empty module so a
      // guarded module can be imported under test. This weakens nothing: the
      // guard is a *build-time* failure — a client-graph import resolves to
      // `index.js`, which throws at module scope and fails the bundle — and
      // vitest never builds a client bundle. That build runs on Vercel; `pnpm
      // run ci` does not run `next build`.
      //
      // The literal `node_modules` path is deliberate: the package exposes no
      // `server-only/empty.js` subpath export, so `require.resolve` cannot
      // reach it. It resolves under pnpm too, but only because `server-only`
      // is a *direct* dependency — pnpm symlinks those into the root of
      // node_modules. It would not resolve for a transitive one.
      'server-only': fileURLToPath(
        new URL('./node_modules/server-only/empty.js', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    // Deliberately narrow: the integration suite needs a database and must not
    // be picked up by a plain `pnpm test`.
    include: ['test/unit/**/*.test.ts'],
  },
})
