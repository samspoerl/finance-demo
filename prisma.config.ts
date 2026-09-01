import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not Prisma's `env()` helper, which throws when unset — `generate` never
    // connects, so CI can run it without a database URL.
    url: process.env.DIRECT_URL!,
  },
})
