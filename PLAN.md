# Build plan — Personal Finance Demo

A public, sandbox-only demo of a private predecessor app, built for a
portfolio: full-stack Next.js with a real third-party API integration (Plaid).

**This file is scaffolding for the build, not a permanent repo document.** Once
the app is finished its durable content moves into `AGENTS.md` and `README.md`
and this file is deleted. Until then it is the handover: everything needed to
pick this up cold is here.

## Where this stands

The app **works end to end** and is committed in ten commits on `main`. The
backend is done; the UI is built and rendering real Plaid sandbox data.

| Check                       | State                                                  |
| --------------------------- | ------------------------------------------------------ |
| `pnpm run typecheck`        | green                                                  |
| `pnpm run lint`             | green                                                  |
| `pnpm run format:check`     | green                                                  |
| `pnpm test` (unit)          | 290 passing                                            |
| `pnpm run test:integration` | 81 passing, against real Postgres + real Plaid sandbox |
| `pnpm run build`            | green                                                  |

**Not yet verified: how it actually looks.** The Chrome extension was not
connected during the build, so no screenshot was ever taken. The DOM was checked
for the right sections and figures and the production build passes, but layout
problems — collisions, overflow, a chart rendering wrong, dark mode reading badly
— would not show up in any of that. **A visual pass in light and dark is the
first thing to do.**

## Running it

Prerequisites: `.env` is already filled in (git-ignored; Neon dev database,
Plaid sandbox credentials, generated secrets). Docker is needed only for the
integration suite.

```bash
pnpm install
pnpm run generate     # prisma client + next types
pnpm dev              # http://localhost:3000

pnpm run db:up            # local Postgres for the integration suite
pnpm run test:integration
pnpm run ci               # everything CI runs
```

The Neon dev database already holds one demo user with a seeded Plaid sandbox
connection — 14 accounts, 48 transactions, 13 holdings — so the populated page
renders without clicking through Link. It also holds ~25 throwaway users from
spike testing; they are harmless and the purge will reap them.

A browser that already has a session cookie will reuse it. To see the **empty
state**, open a private window.

## Outstanding work

In rough order:

1. **Visual pass, light and dark.** See above. Nothing else should be built on
   top of an unlooked-at UI.
2. **Manual account CRUD.** The whole data layer exists —
   `createManualAccount` / `updateAccount` / `deleteManualAccount` actions, and
   `getInstitutions` for the institution picker — but there is no form. This is
   the "Add manual account" button in `AccountsSection` and the "Add manually"
   button on the empty state, both of which currently do nothing.
3. **Reset-my-data control.** `db.deleteUsers` already does the work; this needs
   an action and a confirm dialog. It is in the design's header but not the code.
4. **`AGENTS.md` and `README.md`**, then delete this file.
5. **PostHog** — page views, basic logs and metrics, all anonymous.
   **No session replay.** `src/lib/errors.ts` is the single seam it plugs into.
6. **Webhook demo trigger** (deferred by choice). Sandbox items only fire
   webhooks when poked via `/sandbox/item/fire_webhook`. A "simulate a bank
   update" control would make the webhook path visible to a portfolio viewer
   instead of invisible infrastructure.
7. **Seeded demo data** (deferred by choice, pending the live look at the empty
   state).

### Before deploying

- Vercel project, pointed at a **new production Neon database**.
- Environment variables per `.env.example`. `PLAID_ENV` must be `sandbox` —
  `plaid/client.ts` throws on anything else, deliberately.
- `ENABLE_EXPERIMENTAL_COREPACK=1` in Vercel, or the install fails with a
  misleading pnpm error. See `.env.example` for why.
- Repository **variable** `APP_URL` and repository **secret** `PURGE_SECRET`, or
  the nightly purge workflow does nothing.
- `PLAID_WEBHOOK_URI` pointing at the deployed domain, and that URL registered in
  the Plaid dashboard along with `PLAID_REDIRECT_URI`.
- Once green, copy this repo to its public home. This
  staging repo exists so the public one carries no history from the private app.

## Decisions

| Area          | Decision                                                            |
| ------------- | ------------------------------------------------------------------- |
| Name          | **Personal Finance Demo**; package `finance-demo`                   |
| Auth          | Better Auth **anonymous plugin**. String ids, Better Auth–generated |
| Routing       | One page. No sidebar, no route groups, no other routes              |
| Manual entry  | Plaid **and** manual accounts (CRUD not yet built)                  |
| Transactions  | List, plus recategorize / flip `TransactionType`                    |
| Holdings      | Descriptive only. `Balance` is the sole source of account value     |
| Chart history | Reconstructed backward from the transaction ledger                  |
| Write path    | `revalidatePath('/')`                                               |
| Lifecycle     | Nightly GitHub Actions purge, 7-day idle TTL                        |
| Observability | `console` behind one seam. No Sentry. PostHog deferred              |
| License       | MIT                                                                 |
| UI            | Bespoke, Base UI primitives, Tailwind `stone`, `next-themes`        |

## Architecture

```
src/
├── proxy.ts                  # creates the anonymous session; only place that can
├── app/
│   ├── page.tsx              # the single page — server-rendered composition
│   ├── layout.tsx            # fonts, ThemeProvider, Toaster
│   ├── globals.css           # the token system
│   └── api/
│       ├── auth/[...all]/    # Better Auth
│       ├── plaid-webhook-handler/
│       └── purge/            # authenticated, called by GitHub Actions
├── components/               # see "Component rules"
├── hooks/
│   └── use-server-action.ts  # runs an action, surfaces its failure
└── lib/
    ├── auth/{index,client}.ts
    ├── session.ts            # getSession / requireUser
    ├── db/                   # pure Prisma; userId is a parameter
    ├── actions/              # 'use server' adapters over db/ and plaid/
    ├── plaid/                # all Plaid I/O; plain functions, no session
    ├── utils/                # pure functions
    ├── errors.ts             # the one logging seam
    ├── server-result.ts
    └── select-schemas.ts
```

Three `eslint.config.mjs` rules make the layering real rather than aspirational,
and they are why the structure holds:

1. Only `src/app/**` and `src/lib/actions/**` may import `lib/db` or `lib/plaid`
   at runtime (type-only imports allowed).
2. `'use server'` may only appear in `src/lib/actions/**`.
3. `lib/db` and `lib/plaid` must each declare `server-only` — a local rule,
   because no stock rule asserts an import is _present_.

Each db module is imported as `import * as db`. Actions and db modules pair one
to one by resource, so the namespace never collides; an action needing two would
be a sign it straddles two resources.

## Component rules

New components default to the last bucket and earn their way out.

- **`ui/`** — primitives. The bar: _would this exist, unchanged, in a completely
  different app?_ A primitive absorbs variation as props, not sibling files.
  Currently `Button`, `Card`, `Toast`.
- **`icons/`** — SVG marks lucide doesn't ship. A kind, not a usage tier. Empty.
- **`shared/`** — the _exact same_ UI in two or more resources. Strict; this is
  the only thing between `shared/` and a junk drawer. **Currently empty, and
  correctly so** — nothing yet repeats.
- **Concern directories** — only when the concern already exists in `lib/`.
- **Everything else** — bespoke, grouped by resource: `accounts/`, `holdings/`,
  `nav/`, `netWorth/`, `onboarding/`, `plaid/`, `summary/`, `theme/`,
  `transactions/`.

Prefer plain markup to a wrapper. Extract on the second or third real use, not in
anticipation. Repeated Tailwind strings are not a reason to abstract; a repeated
_behaviour_ is. (`Stat` inside `SummarySection` is the worked example — used five
times on one screen and deliberately not promoted.)

`'use client'` goes at the lowest component owning mutable state or touching a
browser API — never at the level that fetches, because nothing fetches on the
client. There are exactly three client boundaries: `ThemeToggle`,
`NetWorthChart` (period selector), `TransactionCategoryMenu`.

**Base UI** is for widgets with correctness you can't see — dismissal, focus
return, viewport-edge positioning, ARIA. A `<button onClick>` has no invisible
half; hand-roll it. Import from the subpath (`@base-ui/react/menu`), put Tailwind
classes on the parts, and remember popups portal to `<body>`.

**Comment verbosity is medium.** Comment where something is non-obvious or where
an explicit decision was made — a constraint that looks removable but isn't, an
ordering that matters, a shape chosen over the more natural one. No inline
essays. The private app's comments are much heavier; trim when porting.

## The token system

`src/app/globals.css`. Structure and naming follow
another private project of mine; the palette is Tailwind `stone` rather
than `zinc`, which is warmer and where this design already sat. It is aliased
behind a `--color-base-*` scale at the top of the file, so changing the app's
neutral is a find-replace of the palette name across one eleven-line block.

Components name the **role** a colour plays — `text-foreground-muted`, never
`text-<palette>-500 dark:text-<palette>-400` (a placeholder because Tailwind
scans prose, and a real class name here compiles into the bundle). The
light/dark pairing lives in `:root` and `.dark` and nowhere else, so **no
component carries a `dark:` variant for colour at all**. Swapping the accent
is one line.

Five things there are load-bearing and easy to break:

- `@custom-variant dark (&:where(.dark, .dark *))` — Tailwind v4's built-in
  `dark:` keys on `prefers-color-scheme`, which cannot see an explicit choice.
- `@theme inline` — without `inline`, a utility compiles to a _copy_ of the
  token's value and freezes at its light value.
- A plain `@theme` for `--color-base-*` — the mirror of the line above. `inline`
  there would resolve `bg-base-800` straight to `--color-stone-800` and skip the
  base layer, so a `--color-base-*` override would move the semantic tokens but
  not the utilities. Safe as a plain `@theme` only because the palette vars it
  aliases are static.
- The preflight `border-color` override — lets `border` be written with no colour
  at all, which is the common case.
- `color-scheme` on both — without it a dark page keeps white scrollbars and
  flashes white on load.

Dark mode is `next-themes`: `attribute="class"`, `defaultTheme="system"`,
`enableSystem`, `disableTransitionOnChange`, and `suppressHydrationWarning` on
`<html>` (required — the inline script writes `class` before React hydrates).
`ThemeToggle` renders **both** buttons and lets CSS pick which shows; branching
on the resolved theme would mean a mount wait and a swap, because that value is
unknowable on the server and on the first client render.

Design reference:
an internal design canvas — light,
dark, empty state, tokens. Its working files were session scratch and are gone;
the canvas can be read back with the `design` skill's `--extract` if it ever
needs editing.

## Net worth history

The one piece with nothing to port. The private app's chart is meaningful only
because a nightly cron accumulated a real `Balance` snapshot per account per day.
This demo has no cron, so a visitor who connected a bank thirty seconds ago has
one snapshot per account and a chart with a single point.

`src/lib/utils/net-worth-history.ts` walks today's balances **backward** through
the transaction ledger. Plaid supplies 730 days of it (`link-token.ts` asks).

Two things about it that are easy to get wrong:

- **The direction of the walk depends on account type.** For an asset a positive
  Plaid amount left the account, so the balance before it was higher. For a
  liability the stored balance is what is _owed_ and a positive amount is a
  purchase that increased the debt, so before it less was owed. Same ledger,
  opposite arithmetic. A sign error does not throw — it draws a smooth curve
  pointing the wrong way, which is why all 15 tests pin arithmetic and inject
  `today`.
- **`getTransactionsForHistory` returns raw Plaid-convention amounts**, unlike
  every other read in that module, which flips the sign for display. An
  integration test asserts the two functions _disagree_, so the inconsistency
  cannot be tidied away by accident.

Accounts with no ledger (investment, manual) hold flat across the window. That
falls out of the algorithm rather than being special-cased, and the chart says so
in a footnote — the difference between a limitation and a lie.

## Schema notes

`prisma/schema.prisma`, one squashed `init` migration.

Two id conventions, deliberately: Better Auth owns `User`, `Session`,
`UserAccount`, `Verification` and generates **string** ids for them; everything
app-owned keeps `Int @default(autoincrement())`. The private app forced serial
integers via `advanced.database.generateId`, which meant `Number(user.id)` at
every session read; delegating is the simpler contract.

Dropped from the private app: `Household`, `HouseholdMember`, `AccountShare`.
Added: `User.isAnonymous` (the plugin declares it) and `@@index([updatedAt])` on
`Session`, which is the purge's TTL anchor — Better Auth maintains it on its own
`updateAge` schedule, so no app code has to.

A `User.lastActiveAt` column was tried and removed: it needs a write on every
request, and the only thing running on every request is the proxy, which is Edge
and has no Prisma.

## Gotchas worth knowing before touching things

- **The proxy validates the session, it does not check the cookie exists.** The
  purge deletes idle users while their cookies remain valid, so a returning
  visitor arrives with a well-formed cookie for a deleted user. A presence check
  passes it, sign-in is skipped, and with no sign-in UI the page is permanently
  dead for that browser. This was a real bug, found live.
- **The replayed cookie replaces a same-named stale one rather than being
  appended.** Better Auth reads the first occurrence; appending leaves the dead
  cookie in front and the render is still signed out.
- **`plaid/client.ts` throws at import if `PLAID_ENV !== 'sandbox'`.** That is
  the guarantee no configuration reaches production, and it is why the
  per-endpoint sandbox checks were removed.
- **Never log a raw `AxiosError` from Plaid.** `.config.data` carries the access
  token and `.config.headers` carries `PLAID-SECRET`. `callPlaid` logs a named
  projection; two test files assert this, each with a control case proving the
  same serializer _does_ find the credentials on the raw error.
- **The integration suite TRUNCATEs.** Three independent guards keep it on the
  local container; the database name `personal_finance_demo_test` is load-bearing
  in four places (`compose.yaml`, `support/guard.ts`,
  `vitest.integration.config.mts`, `ci.yml`).
- **`react-hooks/purity` lint rejects `Date.now()` in a Server Component.** Push
  the clock read down into the lib or db function.
- **`handle-server-result.ts` was never ported.** It depended on `sonner`;
  `src/hooks/use-server-action.ts` replaces it against Base UI's toast.

## Two security fixes made during the port

Both because the audience changed from a handful of trusted household users to
anonymous strangers on the public internet:

- `resetItemErrorCode` matched on `plaidItemId` alone. A Server Action id is
  reachable by direct POST, so an unscoped `updateMany` let anyone clear anyone
  else's error state by guessing an item id. Now scoped by `userId`.
- `updateTransaction` forwarded its payload to Prisma unvalidated, which the
  private app documented as a known hole. Now parsed with a **strict** Zod
  schema, where `.strict()` is the load-bearing part.

`create-connection` also drops the private app's Sentry failsafe that logged the
encrypted access token when every persist retry failed. That was a deliberate
trade in production — an orphaned item is billable and unrevocable without a
Plaid support request. Sandbox items are free and disposable, so there is nothing
to buy and no reason to put a token in a log.
