# Personal Finance Demo

A personal finance dashboard wired to [Plaid](https://plaid.com) — net worth, accounts, transactions and investment holdings on a single page.

**Live demo: [finance-demo.samspoerl.com](https://finance-demo.samspoerl.com)**

No sign-up. Opening the page creates an anonymous session, so you can connect a sandbox bank and see real data flow through immediately.

> **Sandbox only.** This app talks exclusively to Plaid's sandbox environment. It holds no real financial data and cannot be pointed at production — the Plaid client throws at import if `PLAID_ENV` is anything but `sandbox`.

## Try it

Click **Connect a bank**, pick any institution, and use Plaid's sandbox credentials:

```
username: user_good
password: pass_good
```

Anything else Plaid's sandbox accepts works too — see [Plaid docs](https://plaid.com/docs/sandbox/test-credentials/) for all available test credentials.

## What it demonstrates

**Plaid integration**

- Link token creation and the OAuth redirect flow
- `/transactions/sync` with cursor persistence — the cursor only moves forward, so the local ledger is append-only by design
- `/investments/holdings/get` for securities, decoupled from account balances
- Webhook handling with JWT verification and SHA-256 body comparison
- Item error states surfaced to the user with a re-authentication path

**Handling credentials properly**

- Plaid access tokens are encrypted at rest with AES-256-GCM, through a key registry that supports rotation. Though sandbox tokens are not sensitive, this ensures production tokens would be safe from day 0.
- Plaid errors are logged as a named projection, never as the raw `AxiosError` — its `.config.data` carries the access token and `.config.headers` carries the API secret. Tests assert this, each with a control case proving the same serializer _does_ find the credentials on the raw error.

**Multi-tenancy without accounts**

Every visitor gets an anonymous [Better Auth](https://better-auth.com) session, created in `proxy.ts` because a Server Component cannot set a cookie. Every database read and write takes a `userId` and filters on it, so concurrent visitors never see each other's data. Idle users and their Plaid items are revoked and deleted by a nightly job.

**A chart that tells the truth**

Net worth history is reconstructed backward through the transaction ledger rather than accumulated by a nightly snapshot job, so a visitor who connected a bank thirty seconds ago still sees a year of history. The walk inverts for liabilities — for an asset a positive Plaid amount left the account, for a liability it increased what is owed. Accounts with no ledger hold flat across the window, and the chart says so in a footnote.

## Stack

Next.js 16 (App Router, React 19, React Compiler) · TypeScript · Prisma 7 on Neon Postgres · Better Auth (anonymous plugin) · Tailwind v4 with semantic tokens · Base UI primitives · Recharts · Vitest · Vercel

The UI is bespoke — no component library beyond unstyled primitives for the widgets whose correctness you can't see (dismissal, focus return, ARIA). Light and dark are driven entirely by CSS custom properties; no component carries a `dark:` variant for color.

## Architecture

```
proxy.ts        creates the anonymous session (the only place that can)
app/            one page, server-rendered; API routes for auth, webhooks, purge
components/     bespoke by resource; ui/ holds only true primitives
lib/db/         pure Prisma. userId is a parameter, always
lib/actions/    'use server' adapters over db/ and plaid/
lib/plaid/      all Plaid I/O. Plain functions, no session
lib/utils/      pure functions
```

Three ESLint rules enforce the layering: only route handlers and actions may reach `db/` or `plaid/` at runtime; `'use server'` may only appear in `actions/`; and `db/` and `plaid/` must each declare `server-only` — a local rule, because no stock rule asserts an import is _present_.

See [AGENTS.md](AGENTS.md) for the full conventions.

## Running locally

Requires Node 22+, pnpm, and Docker (for the integration suite only).

```sh
pnpm install
cp .env.example .env      # then fill it in — every variable is documented there
pnpm run generate         # prisma generate + next typegen
pnpm run prisma:migrate
pnpm run seed:categories
pnpm dev
```

You'll need a free [Plaid dashboard](https://dashboard.plaid.com) account for a client ID and **sandbox** secret, and a Postgres database — the app is built against [Neon](https://neon.tech), which has a generous free tier.

Webhooks need a publicly reachable URL. Point `PLAID_WEBHOOK_URI` at an [ngrok](https://ngrok.com/) tunnel to exercise that path locally; the app runs fine without it.

## Tests

```sh
pnpm test                  # unit
pnpm run db:up             # local Postgres
pnpm run test:integration  # integration
pnpm run ci                # everything CI runs
```

Unit tests cover the pure logic; integration tests cover Plaid and database functions. Database tests run against a real Postgres in Docker, guarded three ways so the suite can never TRUNCATE a database that isn't the local test container.

## Limitations

Deliberate:

- Sandbox only. No real bank data, by construction.
- Anonymous sessions are deleted after 7 days idle, along with their Plaid items. Come back later and you start fresh.
- No cron, so balances are not snapshotted; history is derived from the ledger as described above.

## About

Derived from a private personal finance app syncing real data through Plaid. This version exists to be public and forkable: simple, sandbox only, anonymous sessions. It exists as a starting point for developers who want to run their own personal finance app. Fork it, swap in production Plaid credentials and production auth, and start connecting your banks.

Built with the help of [Claude Code](https://claude.com/claude-code).

## License

MIT — see [LICENSE](LICENSE).
