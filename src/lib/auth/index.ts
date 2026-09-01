import prisma from '@/lib/prisma'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { anonymous } from 'better-auth/plugins/anonymous'

/**
 * Auth for a public demo: no sign-in, no credentials, no PII.
 *
 * Every visitor gets an anonymous session on first request (see
 * `src/middleware.ts`). It exists so that two people demoing at once don't see
 * each other's data — every query in `src/lib/db` is scoped by `userId` — not
 * to protect anything valuable. The data behind it is Plaid sandbox data the
 * visitor generated themselves.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  plugins: [
    anonymous({
      // `.invalid` is reserved by RFC 2606, so these can never resolve.
      emailDomainName: 'demo.invalid',
    }),
    // Must stay last: it wraps the response so Set-Cookie survives the
    // Server Action / route handler boundary.
    nextCookies(),
  ],
  advanced: {
    // This app's whole privacy stance is that it holds nothing about the
    // visitor. Sessions are created from middleware, so Better Auth would
    // otherwise record the server's own address anyway — but leaving that to
    // chance would mean real IPs start being stored the moment sign-in moves.
    ipAddress: { disableIpTracking: true },
  },
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    customRules: {
      // The only unauthenticated endpoint that creates rows.
      '/sign-in/anonymous': { window: 60, max: 5 },
    },
  },
  user: {
    modelName: 'User',
  },
  session: {
    modelName: 'Session',
    // A week, where the private app uses ten minutes. There is nothing here
    // worth a short window, and a visitor returning to an open tab should not
    // find the demo empty. `updateAge` also sets how often `updatedAt` moves,
    // which is what the purge job reads.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  account: {
    modelName: 'UserAccount',
  },
  verification: {
    modelName: 'Verification',
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
