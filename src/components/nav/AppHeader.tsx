import { ConnectBankButton } from '@/components/plaid/ConnectBankButton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { cn } from '@/lib/utils'
import { TrendingUpIcon } from 'lucide-react'

/**
 * `showActions` is false on the empty state, where the page itself already
 * carries one prominent "Connect a bank" — two of the same call to action on
 * one screen is a worse page, not a more helpful one.
 *
 * The bar is one fixed-height row at every width, so everything in it has to
 * survive a phone without wrapping. The title is the only thing allowed to
 * shrink; the badge and the actions keep their width. That leaves the badge
 * competing with the "Connect a bank" button for the last ~90px on a narrow
 * screen, and the title losing to both — so the badge steps aside on small
 * screens *only* in the variant that has the button. It stays on the empty
 * state, which is where the sandbox claim has to be visible: that is the screen
 * a visitor reads before typing credentials into Plaid Link.
 */
export function AppHeader({ showActions = true }: { showActions?: boolean }) {
  return (
    <header className="bg-surface sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b px-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <TrendingUpIcon className="text-positive size-5 shrink-0" />
        <h1 className="text-foreground-strong truncate text-sm font-bold tracking-tight sm:text-[15px]">
          Personal Finance Demo
        </h1>
        <span
          className={cn(
            'text-foreground-muted shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap',
            showActions && 'hidden sm:inline-block'
          )}
        >
          <span className="hidden sm:inline">PLAID </span>SANDBOX
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        {showActions && <ConnectBankButton />}
      </div>
    </header>
  )
}
