import { createAuthClient } from 'better-auth/react'

/**
 * Browser-side auth. Thin by design: there is no sign-in or sign-out UI, so
 * this exists only for components that need to read the session client-side.
 *
 * Separate from `./index.ts` because that module reaches the database through
 * Prisma and must never enter a client bundle.
 */
export const { useSession } = createAuthClient({})
