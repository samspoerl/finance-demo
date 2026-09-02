import { ConnectBankButton } from '@/components/plaid/ConnectBankButton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { TrendingUpIcon } from 'lucide-react'

/**
 * `showActions` is false on the empty state, where the page itself already
 * carries one prominent "Connect a bank" — two of the same call to action on
 * one screen is a worse page, not a more helpful one.
 */
export function AppHeader({ showActions = true }: { showActions?: boolean }) {
  return (
    <header className="bg-surface flex h-16 items-center justify-between border-b px-8">
      <div className="flex items-center gap-3">
        <TrendingUpIcon className="text-positive size-5" />
        <h1 className="text-foreground-strong text-[15px] font-bold tracking-tight">
          Personal Finance App Demo
        </h1>
        <span className="text-foreground-muted rounded-sm border px-1.5 py-0.5 text-[11px] font-medium tracking-wide">
          PLAID SANDBOX
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {showActions && <ConnectBankButton />}
      </div>
    </header>
  )
}
