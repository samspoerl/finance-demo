# AGENTS.md

A public, Plaid-**sandbox-only** personal finance demo: net worth, accounts, transactions and holdings on one page. 

## Commands

```sh
pnpm dev                  # Next dev server
pnpm run ci               # generate + typecheck + test + lint + format:check
pnpm test                 # unit suite
pnpm run db:up            # local Postgres for the integration suite
pnpm run test:integration # integration suite (needs db:up)
pnpm run seed:categories  # category taxonomy
```

`pnpm run ci` is what CI runs. Run it before considering work done.

## Hard constraints

- **`PLAID_ENV` must be `sandbox`.** `src/lib/plaid/client.ts` throws at import otherwise. That is the guarantee no configuration reaches production, and it is why per-endpoint sandbox checks were removed. Do not weaken it.
- **Never log a raw `AxiosError` from Plaid.** `.config.data` carries the access token; `.config.headers` carries `PLAID-SECRET`. `callPlaid` logs a named projection. Two test files assert this, each with a control case proving the same serializer _does_ find the credentials on the raw error.
- **Every `db/` read and write takes `userId` as a parameter and filters on it.** A Server Action id is reachable by direct POST; scoping is the only thing between one demo visitor and another's data.
- **Parse Server Action input with Zod before it reaches `db/`.** The `TransactionUpdateDto` type is a compile-time constraint only.
- **No `delete` in `db/transaction.ts`.** Plaid's `/transactions/sync` cursor only moves forward, so history deleted locally never comes back.

## Layering

```
src/
├── proxy.ts              # creates the anonymous session; the only place that can
├── app/
│   ├── page.tsx          # the single page - server-rendered composition
│   ├── layout.tsx        # fonts, ThemeProvider, Toaster
│   ├── globals.css       # the token system
│   └── api/{auth,plaid-webhook-handler,purge}/
├── components/           # see Component rules
├── hooks/use-server-action.ts
└── lib/
    ├── auth/{index,client}.ts, session.ts
    ├── db/               # pure Prisma; userId is a parameter
    ├── actions/          # 'use server' adapters over db/ and plaid/
    ├── plaid/            # all Plaid I/O; plain functions, no session
    ├── utils/            # pure functions
    └── errors.ts         # the one logging seam
```

Three `eslint.config.mjs` rules make this real rather than aspirational:

1. Only `src/app/**` and `src/lib/actions/**` may import `lib/db` or `lib/plaid` at runtime (type-only imports allowed).
2. `'use server'` may only appear in `src/lib/actions/**`.
3. `lib/db` and `lib/plaid` must each declare `server-only` — a local rule, because no stock rule asserts an import is _present_.

Import db modules as `import * as db from '@/lib/db/account'`, so a call reads `db.getAccounts()`. Actions and db modules pair one to one by resource; an action needing two db namespaces is a sign it straddles two resources.

## Component rules

New components default to the last bucket and earn their way out.

- **`ui/`** — primitives. The bar: _would this exist, unchanged, in a completely different app?_ A primitive absorbs variation as props, not sibling files.
- **`icons/`** — SVG marks lucide doesn't ship. A kind, not a usage tier.
- **`shared/`** — the _exact same_ UI in two or more resources. Strict; this is the only thing between `shared/` and a junk drawer. Currently empty, correctly.
- **Concern directories** — only when the concern already exists in `lib/`.
- **Everything else** — bespoke, grouped by resource.

Prefer plain markup to a wrapper. Extract on the second or third real use, not in anticipation. Repeated Tailwind strings are not a reason to abstract; a repeated _behavior_ is. (`Stat` inside `SummarySection` is the worked example — used five times on one screen and deliberately not promoted.)

`'use client'` goes at the lowest component owning mutable state or touching a browser API, never at the level that fetches, because nothing fetches on the client. There are exactly three client boundaries: `ThemeToggle`, `NetWorthChart`, `TransactionCategoryMenu`.

**Base UI** is for widgets with correctness you can't see — dismissal, focus return, viewport-edge positioning, ARIA. A `<button onClick>` has no invisible half; hand-roll it. Import from the subpath (`@base-ui/react/menu`), put Tailwind classes on the parts, and remember popups portal to `<body>`.

## Color

Components name the **role** a color plays — `text-foreground-muted`, never `text-stone-500 dark:text-stone-400`. The light/dark pairing lives in `:root` and `.dark` in `globals.css` and nowhere else, so no component carries a `dark:` variant for color at all.

Four lines there are load-bearing and easy to break:

- `@custom-variant dark (&:where(.dark, .dark *))` — Tailwind v4's built-in `dark:` keys on `prefers-color-scheme`, which cannot see an explicit choice.
- `@theme inline` — without `inline`, a utility compiles to a _copy_ of the token's value and freezes at its light value.
- The preflight `border-color` override — lets `border` be written with no color, the common case.
- `color-scheme` on both — without it a dark page keeps white scrollbars and flashes white on load.

## Comments

**Medium verbosity.** Comment where something is non-obvious or where an explicit decision was made — a constraint that looks removable but isn't, an ordering that matters, a shape chosen over the more natural one. No inline essays.

## Gotchas

- **The proxy validates the session; it does not check the cookie exists.** The purge deletes idle users while their cookies stay valid, so a returning visitor arrives with a well-formed cookie for a deleted user. A presence check passes it, sign-in is skipped, and with no sign-in UI that browser is permanently dead.
- **The replayed cookie replaces a same-named stale one rather than being appended.** Better Auth reads the first occurrence.
- **`getTransactionsForHistory` returns raw Plaid-convention amounts**, unlike every other read in that module, which flips the sign for display. `reconstructNetWorthHistory` needs the convention the balances were produced under. An integration test asserts the two _disagree_, so the inconsistency cannot be tidied away by accident.
- **The net worth walk inverts for liabilities.** A sign error does not throw — it draws a smooth curve pointing the wrong way.
- **The integration suite TRUNCATEs.** Three guards keep it on the local container; the database name `personal_finance_demo_test` is load-bearing in `compose.yaml`, `support/guard.ts`, `vitest.integration.config.mts`, and `ci.yml`.
- **`react-hooks/purity` rejects `Date.now()` in a Server Component.** Push the clock read down into the lib or db function.
- **Two id conventions, deliberately.** Better Auth owns `User`, `Session`, `UserAccount`, `Verification` and generates string ids; everything app-owned keeps `Int @default(autoincrement())`.
