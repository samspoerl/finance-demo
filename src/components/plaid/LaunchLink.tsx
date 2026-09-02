'use client'

import { useServerAction } from '@/hooks/use-server-action'
import { exchangeAndCreateConnection } from '@/lib/actions/create-connection'
import { saveInitialBalances, syncTransactions } from '@/lib/actions/plaid'
import { useCallback, useEffect } from 'react'
import {
  usePlaidLink,
  type PlaidLinkError,
  type PlaidLinkOnSuccess,
  type PlaidLinkOnSuccessMetadata,
  type PlaidLinkOptions,
} from 'react-plaid-link'

interface LaunchLinkProps {
  linkToken: string
  onFinished: () => void
}

/**
 * Opens Plaid Link as soon as it is mounted, and renders nothing.
 *
 * The two fire-and-forget calls keep their position: *after* the connection
 * result has come back ok, which is what guarantees the encrypted access token
 * is already at rest before either goes looking for it.
 */
export function LaunchLink({ linkToken, onFinished }: LaunchLinkProps) {
  const { run } = useServerAction()

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    (publicToken: string | null, metadata: PlaidLinkOnSuccessMetadata) => {
      // Item-based flows always return a public token, but the SDK types it as
      // nullable for flows that do not create an Item. Bail out loudly rather
      // than attempting an exchange we know will fail.
      if (publicToken === null) {
        console.error('Plaid Link succeeded without a public token')
        onFinished()
        return
      }

      void run({
        action: () => exchangeAndCreateConnection(publicToken, metadata),
        success: 'Bank connected',
        onSuccess: (connection) => {
          saveInitialBalances(connection.plaidItemId).catch(console.error)
          // An initial, likely empty, sync is what activates the
          // SYNC_UPDATES_AVAILABLE webhook for this item.
          syncTransactions(connection.plaidItemId).catch(console.error)
          onFinished()
        },
      })
    },
    [run, onFinished]
  )

  const onExit = useCallback(
    (error: PlaidLinkError | null) => {
      if (error) console.error(error)
      onFinished()
    },
    [onFinished]
  )

  const config: PlaidLinkOptions = { token: linkToken, onSuccess, onExit }
  const { open, ready } = usePlaidLink(config)

  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  return null
}
