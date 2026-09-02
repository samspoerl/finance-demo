import { describe, expect, it } from 'vitest'
import { prisma } from './support/db'

/**
 * Proves the harness itself is pointed where it thinks it is, before any spec
 * relies on it. If this file fails, nothing else in the suite means anything.
 */
describe('integration harness', () => {
  it('is connected to the local throwaway database, not Neon', async () => {
    const [row] = await prisma.$queryRaw<
      { database: string; neon_tenant: string | null }[]
    >`SELECT current_database() AS database, current_setting('neon.tenant_id', true) AS neon_tenant`

    expect(row.database).toBe('personal_finance_demo_test')
    expect(row.neon_tenant).toBeNull()
  })

  it('starts each test from an empty database', async () => {
    expect(await prisma.user.count()).toBe(0)
  })
})
