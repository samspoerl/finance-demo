# Build plan — personal finance demo

A public, sandbox-only demo of a private predecessor app, built for a
portfolio: full-stack Next.js with a real third-party API integration (Plaid).

This file is scaffolding for the build. It is **not** a permanent repo document —
once the app works, its durable content moves into `AGENTS.md` and `README.md`
and this file is deleted.

## Why a separate repo

- The private app stays private so it can ship rough code without an audience.
- This is not a business. A public _demo_ carries none of the operational or
  regulatory risk of running a production financial app.
- Consequently: **Plaid sandbox only**, no real financial data, ever.

## Decisions

| Area          | Decision                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Auth          | Better Auth **anonymous plugin**. String user ids, Better Auth–delegated.                                |
| Routing       | One page. No sidebar, no route groups, no other routes.                                                  |
| Page content  | KPI row, net-worth chart, accounts grouped by category with rollups, Plaid Link, transactions, holdings. |
| Seed data     | None. Empty state, pending live testing.                                                                 |
| Manual entry  | Plaid **and** manual accounts (full CRUD).                                                               |
| Transactions  | List, plus recategorize / flip `TransactionType`.                                                        |
| Holdings      | Descriptive only. `Balance` is the sole source of account value.                                         |
| Chart history | Derived backward from transactions.                                                                      |
| Write path    | `revalidatePath`.                                                                                        |
| Lifecycle     | Nightly GitHub Actions purge, 7-day idle TTL.                                                            |
| Observability | `console.log` / `console.error` behind one seam. No Sentry. PostHog deferred.                            |
| License       | MIT                                                                                                      |
| UI            | Bespoke, on Base UI primitives. No shadcn.                                                               |

### Naming

Settled: **Personal Finance App Demo**. Package name stays
`personal-finance-demo`; `client_name` in `lib/plaid/link-token.ts` (visible
inside the Plaid Link modal) uses the display name.

## Architecture

Carried over from the private app, because it is the part worth showing:

```
src/
├── proxy.ts                  # creates the anonymous session; only place that can
├── app/
│   ├── page.tsx              # the single page
│   ├── layout.tsx            # + icon.tsx, apple-icon.tsx, global-error.tsx,
│   │                         #   globals.css, global-providers.tsx
│   └── api/
│       ├── auth/[...all]/    # Better Auth
│       ├── plaid-webhook-handler/
│       └── purge/            # authenticated, called by GitHub Actions
├── components/               # see "Component rules" below
└── lib/
    ├── auth/
    │   ├── index.ts          # server-side Better Auth config
    │   └── client.ts         # browser-side; no Prisma
    ├── session.ts            # getSession / requireUser
    ├── db/                   # pure Prisma; userId is a parameter
    ├── actions/              # 'use server' adapters over db/ and plaid/
    ├── plaid/                # all Plaid I/O; plain functions, no session
    ├── utils/                # pure functions
    ├── errors.ts             # the one logging seam
    ├── server-result.ts      # ServerResult<T> + ok/err
    └── select-schemas.ts
```

The four `eslint.config.mjs` boundary rules come across intact, because they are
what make the layering real rather than aspirational:

1. Only `src/app/**` and `src/lib/actions/**` may import `lib/db` or `lib/plaid`
   at runtime (type-only imports allowed).
2. `'use server'` may only appear in `src/lib/actions/**`.
3. `lib/db` and `lib/plaid` must each declare `server-only` (local plugin rule).
4. (The `/debug` seal is dropped along with the `/debug` zone.)

### Component rules

New components default to the last bucket and earn their way out.

- **`ui/`** — primitives. The bar: _would this exist, unchanged, in a completely
  different app?_ A primitive absorbs variation as props, not sibling files.
- **`icons/`** — SVG marks lucide doesn't ship. A kind, not a usage tier.
- **`shared/`** — the _exact same_ UI in two or more resources. Strict; this is
  the only thing between `shared/` and a junk drawer. Expect it to start empty.
- **Concern directories** — only when the concern already exists in `lib/`.
- **Everything else** — bespoke, grouped by resource.

Prefer plain markup to a wrapper. Extract on the second or third real use, not
in anticipation. Repeated Tailwind strings are not a reason to abstract; a
repeated _behavior_ is.

`'use client'` goes at the lowest component owning mutable state or touching a
browser API — never at the level that fetches, because nothing fetches on the
client. Server data crosses as props: `initial*` when the client will mutate it,
plain when it won't.

**Base UI** is for widgets with correctness you can't see — dismissal, focus
return, viewport-edge positioning, ARIA. A `<button onClick>` has no invisible
half; hand-roll it. Import from the subpath (`@base-ui/react/popover`), put
Tailwind classes directly on the parts, and remember popups portal to `<body>`.

## Schema

Starting point is the private app's `prisma/schema.prisma`, with:

**Dropped:** `Household`, `HouseholdMember`, `AccountShare`. Fallout:
`calculateAdjustedBalance` loses `ownershipShare` and collapses into
`normalizeBalance`; `lib/db/household.ts` and its tests go; `getNetWorthHistory`
stops widening past the one user.

**Changed:** `User.id` → `String @id`, Better Auth–generated. Same for
`Session`, `UserAccount`, `Verification`. `userId` → `String` on `Connection`,
`Account`, `Balance`, `Transaction`, `Holding`. App-owned models keep
`Int @default(autoincrement())` — Better Auth never touches them.

**Added:** `User.isAnonymous Boolean` (declared by the anonymous plugin) and
`@@index([updatedAt])` on `Session`. A `User.lastActiveAt` column was tried and
removed: it needs a write on every request, and the only code that runs on every
request is the proxy, which runs on the Edge runtime where Prisma is
unavailable. Better Auth already maintains `Session.updatedAt` on its `updateAge`
schedule, so the purge anchors on that instead and no app code maintains it.

**Kept:** `Transaction` + `Category`, `Holding` + `Security`, `Connection`,
`Account`, `Balance`, `Institution`, and the three enums.

Migrations squash to a single `init`. The private app's 13 migrations document a
history this repo does not have.

## Net worth history

The one requirement with no implementation to port. `saveInitialBalances` writes
**one** `Balance` row per account at connect time, and the private app's chart is
only meaningful because a nightly cron accumulated a year of snapshots. Dropping
cron makes a fresh demo user's chart a single point.

Solution: reconstruct it. Walk the current balance backward day by day,
reversing each transaction, to produce a daily series. Plaid gives us the ledger
— `link-token.ts` already requests 730 days.

- Pure function in `lib/utils/`, unit-tested before any UI exists.
- Covers accounts with a ledger: cash and credit.
- Accounts **without** one (investment, manual real-asset) are held flat at
  their current balance across the window. The chart says so rather than
  implying the line is measured.

## Environment

| Variable                                                                                          | Notes                                                      |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`                                                                      | New Neon project                                           |
| `ENCRYPTION_KEY_0`, `ENCRYPTION_KEY_CURRENT_ID`                                                   | Plaid access tokens stay encrypted at rest even in sandbox |
| `PLAID_CLIENT_ID`, `PLAID_SANDBOX_SECRET`, `PLAID_ENV`, `PLAID_REDIRECT_URI`, `PLAID_WEBHOOK_URI` | Sandbox credentials only                                   |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                                           |                                                            |
| `PURGE_SECRET`                                                                                    | Authenticates the GitHub Actions purge                     |
| `ENABLE_EXPERIMENTAL_COREPACK`                                                                    | Vercel project settings only; see `.env.example`           |

Dropped: `DEV_AUTH_PASSWORD`, `DISABLE_SIGNUP`, `GITHUB_*`, `GOOGLE_*`,
`CRON_SECRET`, `SENTRY_*`. Deferred: `NEXT_PUBLIC_POSTHOG_*`.

## What ports, what's rebuilt, what's dropped

**Ports nearly untouched** — `lib/utils/*` (notably `account-types.ts`, the
5-type × ~90-subtype hierarchy with `category` and `sortOrder` that the rollups
need), `lib/plaid/*`, `lib/db/*` minus household, `cipher` + `cipher-core`,
`server-result.ts`, `handle-server-result.ts`, `select-schemas.ts`,
`eslint.config.mjs`, `.github/`, `.vscode/{launch,settings}.json`, most of
`test/`.

**Rebuilt from scratch** — every component. `ui/` re-derived against the
primitive bar above, on Base UI. Page sections bespoke per resource.
`shared/typography.tsx` does not come across; pages write their own headings.

**Dropped** — Sentry (10 source files, not 2 configs), the `/debug` zone (25
files), the `(auth)` route group and all dev-auth, sidebar + breadcrumb +
`@breadcrumb` parallel route, cron, 7 of 8 `scripts/`, `LICENSE.md`,
`certificates/`, `backups/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, the
`@/contexts/*` tsconfig alias (points at a directory that does not exist).

## Sequence

1. ~~**Spike Better Auth anonymous + string ids**~~ — done. Session is created
   in `src/proxy.ts` on the first request and is readable in that same render
   (the new cookie is replayed onto the request, not just the response). String
   ids throughout, no `Number(user.id)` anywhere. Repeat requests reuse the
   session. IP tracking is off.

   Two things the spike caught that the plan had not: the proxy must **validate**
   the session rather than check the cookie is present, or a visitor whose row
   the purge job deleted is permanently stuck on a dead page; and the replayed
   cookie must **replace** a same-named stale cookie rather than being appended
   after it, since Better Auth reads the first occurrence.

2. ~~Scaffold~~ — done.
3. ~~Data layer~~ — done. `lib/db`, `lib/plaid`, `lib/actions`, `session.ts`,
   `errors.ts`, plus the webhook handler and the purge endpoint. 260 unit and 81
   integration tests pass; the integration suite runs against real Postgres and
   the real Plaid sandbox.
4. ~~`net-worth-history.ts`~~ — done, tests first, 15 of them.
5. ~~UI, per the component rules~~ — done. Tokens follow another private project
   (`--foreground-strong` … `--border-strong`, `@theme inline`, the preflight
   border-color override, `color-scheme`), on Tailwind `stone` rather than
   `zinc`, plus `--positive`/`--negative` and a `--border-soft` for the row
   separators dense tables need. Dark mode is `next-themes`, `attribute="class"`,
   `defaultTheme="system"`; the toggle renders both buttons and lets CSS pick,
   so nothing waits for mount and nothing flashes.

   Still outstanding on the page: manual account CRUD, the reset-my-data
   control, and a per-account view (deliberately absent — single page).

6. ~~Purge workflow~~ — done, shipped with step 3. A reset-my-data control is
   still outstanding.
7. `AGENTS.md` / `README.md`; delete this file.
8. PostHog — page views, basic logs/metrics. Anonymous. **No session replay.**

## Carried forward

Things deferred with a reason, so they are not quietly lost:

- **`handle-server-result.ts`** is not ported. It depends on `sonner`, which was
  dropped in favour of Base UI's Toast, so it lands with the toast primitive.
- **A "reset my demo data" control.** The purge covers abandonment; this covers
  a visitor who wants a clean slate now. `db.deleteUsers` already does the work.
- **The chart's flat-line caveat.** Accounts with no ledger hold flat across the
  window. The UI has to say so rather than implying the whole line is measured.
- **Two security fixes** made during the port, both because the audience changed
  from trusted household users to anonymous strangers: `resetItemErrorCode` is
  now scoped by `userId`, and `updateTransaction` parses its payload with a
  strict Zod schema.

## Deferred

- **Webhook demo trigger.** The handler is worth keeping, but sandbox items only
  fire webhooks when poked via `/sandbox/item/fire_webhook`. A "simulate a bank
  update" control would make the webhook path visible to a portfolio viewer
  instead of invisible infrastructure. Build it after live testing.
- Seeded demo data, pending live testing of the empty state.
