/**
 * Seed the categories table with the full Plaid PFC v2 taxonomy.
 *
 * Safe to run multiple times — uses upsert on plaidDetailed (unique key).
 *
 * Usage:
 *   pnpm run seed:categories
 */

import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import {
  PFC_TAXONOMY,
  formatPlaidDetailed,
  formatPlaidPrimary,
} from '../src/lib/utils/plaid-categories'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  let count = 0

  for (const [plaidPrimary, detailedList] of Object.entries(PFC_TAXONOMY)) {
    const category = formatPlaidPrimary(plaidPrimary)

    for (const plaidDetailed of detailedList) {
      const subcategory = formatPlaidDetailed(plaidPrimary, plaidDetailed)

      await prisma.category.upsert({
        where: { plaidDetailed },
        update: { category, subcategory },
        create: { plaidPrimary, plaidDetailed, category, subcategory },
        select: { id: true },
      })

      count++
    }
  }

  console.log(`Done. ${count} categories upserted.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
