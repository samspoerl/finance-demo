import { logError } from '@/lib/errors'
import { plaidClient } from '@/lib/plaid/client'
import { callPlaid } from '@/lib/plaid/errors'
import { syncTransactions } from '@/lib/plaid/sync-transactions'
import prisma from '@/lib/prisma'
import { compare } from '@/lib/utils/secure-compare'
import {
  decodeProtectedHeader,
  importJWK,
  JWTPayload,
  jwtVerify,
  JWTVerifyResult,
} from 'jose'
import { sha256 } from 'js-sha256'
import { after, NextRequest, NextResponse } from 'next/server'
import { isPlaidWebhook, PlaidWebhook } from './types'

/**
 * Plaid's webhook endpoint.
 *
 * Unauthenticated in the session sense — Plaid has no session and there is no
 * `requireUser()` here. It authenticates on the `Plaid-Verification` JWT and a
 * SHA-256 comparison of the request body, in `verifyPlaidWebhook` below.
 *
 * The `after()` work runs once the response is already on the wire, so it is
 * the one place a throw would otherwise vanish entirely — hence its own catch.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const reqBody: unknown = await request.json()

    // Validate required webhook fields
    if (!isPlaidWebhook(reqBody)) {
      return NextResponse.json(
        { error: 'Invalid webhook payload: missing required fields' },
        { status: 400 }
      )
    }

    const webhook: PlaidWebhook = reqBody

    // Response to return to Plaid to indicate success or failure
    const response = await verifyPlaidWebhook(request, webhook)

    if (!response.ok) {
      // Non-200 responses trigger retries
      const resBody = await response.json()
      console.error(`${response.status}  ${resBody.error}`)
      return response
    }

    // Process the webhook asynchronously after the response is sent.
    // The response has already been returned by the time this runs, so a
    // rejection here has no caller to surface to — catch and report it, or it
    // is lost.
    after(async () => {
      try {
        await handlePlaidWebhook(webhook)
      } catch (error) {
        logError(
          error,
          `Webhook handling failed: ${webhook.webhook_type}/${webhook.webhook_code}`
        )
      }
    })

    return response
  } catch (error) {
    logError(error, 'Error processing webhook')
    return NextResponse.json({ error: 'Unhandled error' }, { status: 500 })
  }
}

async function verifyPlaidWebhook(request: NextRequest, reqBody: PlaidWebhook) {
  // Extract the Plaid-Verification header, which contains a JWT.
  // This is used to authenticate the request came from Plaid.
  const plaidJwt = request.headers.get('Plaid-Verification')

  if (!plaidJwt) {
    return NextResponse.json(
      { error: 'Plaid-Verification header is missing' },
      { status: 400 }
    )
  }

  // Extract alg and kid fields from JWT header.
  const { alg, kid } = decodeProtectedHeader(plaidJwt)

  // Verify valid alg field.
  // This is recommended by Plaid.
  if (alg !== 'ES256') {
    return NextResponse.json(
      { error: 'Invalid JWT header: alg field is not ES256' },
      { status: 400 }
    )
  }

  // Verify kid field is present. This is sent to the
  // webhook_verification_key endpoint to retrieve the
  // public key corresponding to the private key used
  // to sign the request.
  if (!kid) {
    return NextResponse.json(
      { error: 'Invalid JWT header: kid field is missing' },
      { status: 400 }
    )
  }

  const response = await callPlaid(() =>
    plaidClient.webhookVerificationKeyGet({
      key_id: kid,
    })
  )
  const verifiedKey = response.key

  // Verify key hasn't expired.
  if (verifiedKey.expired_at !== null) {
    return NextResponse.json(
      { error: 'Webhook verification key expired' },
      { status: 400 }
    )
  }

  let verifiedPayload: JWTPayload
  try {
    // Validate the signature and iat
    const keyLike = await importJWK(verifiedKey)
    // This will throw an error if verification fails
    const jwtVerifyResult: JWTVerifyResult = await jwtVerify(
      plaidJwt,
      keyLike,
      {
        maxTokenAge: '5 min',
      }
    )
    verifiedPayload = jwtVerifyResult.payload
  } catch (error) {
    console.error('Unabled to verify webhook:', error)
    return NextResponse.json(
      { error: 'Unable to verify webhook: invalid signature' },
      { status: 401 }
    )
  }

  // Verify request_body_sha256 field is present in JWT payload.
  // This is used to compare the expected request body hash to actual.
  const { request_body_sha256: claimedBodyHash } = verifiedPayload
  if (typeof claimedBodyHash !== 'string' || !claimedBodyHash) {
    return NextResponse.json(
      { error: 'Invalid JWT payload: request_body_sha256 field is missing' },
      { status: 400 }
    )
  }

  // Compare hashes.
  const actualBodyHash = sha256(JSON.stringify(reqBody, null, 2))
  const bodyHashesMatch: boolean = compare(actualBodyHash, claimedBodyHash)

  if (!bodyHashesMatch) {
    return NextResponse.json(
      {
        error:
          'Unable to verify webhook: actual request body did not match the request body claimed in the JWT',
      },
      { status: 401 }
    )
  }

  // Webhook successful
  return NextResponse.json(
    { message: 'Webhook received successfully' },
    { status: 200 }
  )
}

async function handlePlaidWebhook(webhook: PlaidWebhook) {
  console.log('Received webhook:', webhook)

  switch (webhook.webhook_type) {
    case 'ITEM':
      switch (webhook.webhook_code) {
        case 'ERROR':
          await updateConnection(
            { plaidErrorCode: webhook.error.error_code },
            webhook.item_id
          )
          break
        case 'LOGIN_REPAIRED':
          await updateConnection({ plaidErrorCode: null }, webhook.item_id)
          break
        case 'NEW_ACCOUNTS_AVAILABLE':
          await updateConnection(
            { plaidNewAccountsAvailable: true },
            webhook.item_id
          )
          break
        case 'PENDING_DISCONNECT':
        case 'USER_PERMISSION_REVOKED':
        case 'USER_ACCOUNT_REVOKED':
          await updateConnection(
            { plaidErrorCode: webhook.webhook_code },
            webhook.item_id
          )
          break
        case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
          console.log(`Webhook updated to '${webhook.new_webhook_url}'`)
          break
        default:
          console.error(
            `Webhook code not handled: ${(webhook as PlaidWebhook).webhook_code}`
          )
      }
      break
    case 'TRANSACTIONS':
      switch (webhook.webhook_code) {
        case 'SYNC_UPDATES_AVAILABLE':
          await syncTransactions(webhook.item_id)
          break
        default:
          console.error(
            `Webhook code not handled: ${(webhook as PlaidWebhook).webhook_code}`
          )
      }
      break
    default:
      console.error(
        `Webhook type not handled: ${(webhook as PlaidWebhook).webhook_type}`
      )
  }
}

async function updateConnection(
  data: { plaidErrorCode: string | null } | { plaidNewAccountsAvailable: true },
  plaidItemId: string
) {
  await prisma.connection.update({
    data,
    where: { plaidItemId },
  })
}
