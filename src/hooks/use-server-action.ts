'use client'

import type { ServerResult } from '@/lib/server-result'
import { Toast } from '@base-ui/react/toast'
import { useCallback, useState } from 'react'

interface RunOptions<T> {
  action: () => Promise<ServerResult<T>>
  onSuccess?: (data: T) => void
  /** Shown on success. Omit for mutations whose result is visible on the page. */
  success?: string
}

/**
 * Runs a Server Action and surfaces its failure, so no call site has to
 * remember to.
 *
 * A hook rather than the private app's plain `handleServerResult` function
 * because Base UI's toast manager is context-bound — sonner exposed a
 * module-level `toast.error()`, Base UI does not. The behaviour is otherwise
 * the same, including the distinction the `ServerResult` union exists for: a
 * returned `{ ok: false }` is an expected failure with a message written for a
 * user, while a thrown error is a fault and gets a generic one.
 */
export function useServerAction() {
  const toast = Toast.useToastManager()
  const [pending, setPending] = useState(false)

  const run = useCallback(
    async <T>({ action, onSuccess, success }: RunOptions<T>) => {
      setPending(true)
      try {
        const result = await action()

        if (!result.ok) {
          toast.add({
            title: 'Something went wrong',
            description: result.message,
            type: 'error',
          })
          return
        }

        if (success) {
          toast.add({ title: success })
        }

        onSuccess?.(result.data)
      } catch (error) {
        console.error(error)
        toast.add({
          title: 'Something went wrong',
          description: 'The request could not be completed.',
          type: 'error',
        })
      } finally {
        setPending(false)
      }
    },
    [toast]
  )

  return { run, pending }
}
