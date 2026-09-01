import { getSession } from '@/lib/session'

// Spike page: proves middleware creates an anonymous session and that the
// server can read it back. Replaced by the real single page.
export default async function Page() {
  const session = await getSession()

  return (
    <main className="mx-auto max-w-2xl p-8 font-mono text-sm">
      <h1 className="mb-4 text-lg font-semibold">Session spike</h1>
      <pre className="overflow-x-auto rounded bg-black/5 p-4">
        {JSON.stringify(session, null, 2) ?? 'null'}
      </pre>
    </main>
  )
}
