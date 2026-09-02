'use client'

import { Toast } from '@base-ui/react/toast'

/**
 * The app's toast surface. Base UI rather than hand-rolled because a toast is
 * almost entirely correctness you cannot see: an ARIA live region, focus
 * management, auto-dismiss timers, stacking and swipe-to-close. The private app
 * used sonner; Base UI ships the same behaviour and is already a dependency.
 *
 * Renders nothing until something is added, so it can sit in the layout
 * unconditionally.
 */
export function Toaster() {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="bg-surface flex items-start gap-3 rounded-lg border p-3 shadow-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <Toast.Title
                className={
                  toast.type === 'error'
                    ? 'text-negative text-[13px] font-semibold'
                    : 'text-foreground-strong text-[13px] font-semibold'
                }
              />
              <Toast.Description className="text-foreground-muted text-xs" />
            </div>
            <Toast.Close
              aria-label="Dismiss"
              className="text-foreground-subtle hover:text-foreground-strong ml-auto text-xs"
            >
              ✕
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
