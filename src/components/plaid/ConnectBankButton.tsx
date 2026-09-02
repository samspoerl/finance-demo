'use client'

import { LaunchLink } from '@/components/plaid/LaunchLink'
import { Button } from '@/components/ui/Button'
import { useServerAction } from '@/hooks/use-server-action'
import { createLinkToken } from '@/lib/actions/plaid'
import { useCallback, useState, type ComponentProps } from 'react'

type ButtonProps = ComponentProps<typeof Button>

interface ConnectBankButtonProps {
  variant?: ButtonProps['variant']
  className?: string
  children?: React.ReactNode
}

/**
 * Fetches a link token, then mounts `LaunchLink`, which opens Plaid Link on
 * mount. The token is cleared when Link closes so a second click mints a fresh
 * one — a link token is single-use and short-lived.
 */
export function ConnectBankButton({
  variant = 'primary',
  className,
  children = 'Connect a bank',
}: ConnectBankButtonProps) {
  const { run, pending } = useServerAction()
  const [linkToken, setLinkToken] = useState<string | null>(null)

  const handleClick = () =>
    run({
      action: () => createLinkToken(),
      onSuccess: (token) => setLinkToken(token.link_token),
    })

  const handleFinished = useCallback(() => setLinkToken(null), [])

  return (
    <>
      <Button
        variant={variant}
        className={className}
        disabled={pending || linkToken !== null}
        onClick={handleClick}
      >
        {children}
      </Button>
      {linkToken && (
        <LaunchLink linkToken={linkToken} onFinished={handleFinished} />
      )}
    </>
  )
}
