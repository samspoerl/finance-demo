import { ConnectBankButton } from '@/components/plaid/ConnectBankButton'
import { CreditCardIcon, LockIcon } from 'lucide-react'

/**
 * What a visitor sees before connecting anything.
 *
 * The sandbox credentials are printed here on purpose. Nobody guesses
 * `user_good` / `pass_good`, and a demo whose front door cannot be opened is
 * not a demo.
 *
 * The card is width-capped rather than width-fixed: at 620px flat it ran wider
 * than a phone, and a centered column inside an overflowing page clips at *both*
 * edges, taking the credentials with it. The top offset drops on small screens
 * too — 96px of empty canvas above the fold is a luxury a 700px-tall viewport
 * does not have.
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center px-4 pt-10 pb-12 sm:px-8 sm:pt-24">
      <div className="bg-surface flex w-full max-w-[620px] flex-col items-center rounded-xl border p-6 sm:p-10">
        <CreditCardIcon
          className="text-positive mb-4 size-9 sm:size-10"
          strokeWidth={1.4}
        />

        <h2 className="text-foreground-strong text-center text-xl font-bold tracking-tight text-balance sm:text-2xl">
          Connect a sandbox bank
        </h2>

        <p className="mt-2 max-w-[420px] text-center text-sm leading-relaxed text-pretty">
          This is a live Plaid integration running against Plaid&rsquo;s
          sandbox. No real bank, no real money, and nothing you enter reaches a
          financial institution.
        </p>

        <div className="bg-surface-strong mt-5 flex w-full flex-col gap-2.5 rounded-lg border px-4 py-3.5 sm:px-5 sm:py-4">
          <span className="text-foreground-muted text-[11px] font-semibold tracking-wider uppercase">
            Use these credentials
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-foreground-subtle text-xs">Username</span>
              <span className="text-foreground-strong font-mono text-sm font-medium">
                user_good
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground-subtle text-xs">Password</span>
              <span className="text-foreground-strong font-mono text-sm font-medium">
                pass_good
              </span>
            </div>
          </div>
        </div>

        <ConnectBankButton className="mt-5 h-11 w-full text-sm" />
      </div>

      {/* `items-start`, not `items-center`: the note wraps to two lines on a
          phone, and a lock centered against a two-line block reads as floating
          between them rather than marking the line it belongs to. */}
      <div className="text-foreground-subtle mt-6 flex max-w-[620px] items-start gap-2 text-xs">
        <LockIcon className="mt-px size-3.5 shrink-0" />
        <span className="text-pretty">
          Your demo session is anonymous. Data is deleted after 7 days of
          inactivity.
        </span>
      </div>
    </div>
  )
}
