import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/lib/auth'
import { describe, expect, it } from 'vitest'

/**
 * Better Auth's Prisma adapter reaches for `prisma[modelName]` with the
 * configured string verbatim, and Prisma exposes `model User` as `prisma.user`.
 * A `modelName` is therefore the *client property*, never the schema model.
 *
 * Getting it wrong is invisible to `tsc` — the option is typed `string` — and
 * nothing else in either suite builds a query through the adapter, so the first
 * symptom is every request failing with `Prisma schema mismatch / Missing
 * tables`. Hence a test that needs no database: it only compares the configured
 * strings against the generated client's own model list.
 */
const clientProperty = (model: string) =>
  model.charAt(0).toLowerCase() + model.slice(1)

const CLIENT_PROPERTIES = new Set(
  Object.values(Prisma.ModelName).map(clientProperty)
)

const CONFIGURED: Record<string, string | undefined> = {
  user: auth.options.user?.modelName,
  session: auth.options.session?.modelName,
  account: auth.options.account?.modelName,
  verification: auth.options.verification?.modelName,
}

describe('auth model names', () => {
  it.each(Object.entries(CONFIGURED))(
    '%s resolves to a Prisma client property',
    (_core, modelName) => {
      expect(modelName).toBeDefined()
      expect(CLIENT_PROPERTIES).toContain(modelName)
    }
  )

  // Control. The PascalCase schema names are the ones that look right, and are
  // what broke the app; without this, an assertion that happened to accept
  // anything would still pass above.
  it('does not accept the PascalCase schema names', () => {
    for (const model of ['User', 'Session', 'UserAccount', 'Verification']) {
      expect(CLIENT_PROPERTIES).not.toContain(model)
    }
  })
})
