// The `server-only` guard is load-bearing, not decorative: this module reads
// PLAID_CLIENT_ID and the Plaid secret out of `process.env` and bakes them into
// every request header. If it were ever pulled into a client bundle those
// credentials would ship to the browser. `errors.ts` carries the same guard;
// between the two, every module in `src/lib/plaid/` imports a guarded module
// directly or transitively, which seals the whole directory.

import 'server-only'

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

/**
 * This app is a sandbox demo and has no production mode. The private app chose
 * its secret from `PLAID_ENV`, so setting that variable to `production` was
 * enough to point it at real institutions; here the same value is a startup
 * failure instead.
 *
 * Throwing rather than silently falling back to sandbox is the point: a deploy
 * configured for production is a mistake someone needs to see, not one to paper
 * over. `PLAID_SANDBOX_SECRET` is named for the environment it belongs to so a
 * production secret cannot be pasted in without noticing.
 */
if (process.env.PLAID_ENV && process.env.PLAID_ENV !== 'sandbox') {
  throw new Error(
    `PLAID_ENV must be "sandbox" — this app is a demo and must never reach ` +
      `Plaid production. Got "${process.env.PLAID_ENV}".`
  )
}

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SANDBOX_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
})

export const plaidClient = new PlaidApi(plaidConfig)
