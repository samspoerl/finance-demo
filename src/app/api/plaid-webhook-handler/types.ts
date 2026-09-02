/**
 * Plaid Webhook Types
 *
 * Tree-structured discriminated union covering all handled webhook types.
 * Add new webhook_types or webhook_codes by extending the union.
 */

export type PlaidWebhook = { item_id: string } & (
  | ({ webhook_type: 'ITEM' } & (
      | { webhook_code: 'ERROR'; error: { error_code: string } }
      | { webhook_code: 'LOGIN_REPAIRED' }
      | { webhook_code: 'NEW_ACCOUNTS_AVAILABLE' }
      | { webhook_code: 'PENDING_DISCONNECT' }
      | { webhook_code: 'USER_PERMISSION_REVOKED' }
      | { webhook_code: 'USER_ACCOUNT_REVOKED' }
      | { webhook_code: 'WEBHOOK_UPDATE_ACKNOWLEDGED'; new_webhook_url: string }
    ))
  | ({ webhook_type: 'TRANSACTIONS' } & {
      webhook_code: 'SYNC_UPDATES_AVAILABLE'
    })
)

/**
 * Validates that the request body has the required base webhook fields.
 * Returns 400 if any are missing.
 */
export function isPlaidWebhook(body: unknown): body is PlaidWebhook {
  return (
    typeof body === 'object' &&
    body !== null &&
    'webhook_type' in body &&
    'webhook_code' in body &&
    'item_id' in body &&
    typeof (body as PlaidWebhook).webhook_type === 'string' &&
    typeof (body as PlaidWebhook).webhook_code === 'string' &&
    typeof (body as PlaidWebhook).item_id === 'string'
  )
}
