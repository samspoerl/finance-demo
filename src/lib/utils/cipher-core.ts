// Core AES-256-GCM encrypt/decrypt logic.
// No `server-only` guard here so this module can also be imported by
// Node.js scripts (e.g. migration scripts run with tsx).
// All Next.js app code should import from `cipher.ts`, which re-exports
// everything from here and adds the `server-only` guard.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV is the recommended length for GCM
const AUTH_TAG_LENGTH = 16 // 128-bit auth tag

function getKey(keyId: string): Buffer {
  const envVar = `ENCRYPTION_KEY_${keyId}`
  const raw = process.env[envVar]

  if (!raw) {
    throw new Error(`Missing encryption key env var: ${envVar}`)
  }

  const key = Buffer.from(raw, 'base64')

  if (key.length !== 32) {
    throw new Error(
      `${envVar} must be exactly 32 bytes (got ${key.length}). Provide a base64-encoded 32-byte value.`
    )
  }

  return key
}

function getCurrentKeyId(): string {
  const keyId = process.env.ENCRYPTION_KEY_CURRENT_ID

  if (!keyId) {
    throw new Error('Missing env var: ENCRYPTION_KEY_CURRENT_ID')
  }

  return keyId
}

export function encrypt(plaintext: string): {
  encrypted: string
  keyId: string
} {
  const keyId = getCurrentKeyId()
  const key = getKey(keyId)
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  // Stored format: iv:authTag:ciphertext (all base64)
  const storedValue = [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')

  return { encrypted: storedValue, keyId }
}

export function decrypt(ciphertext: string, keyId: string): string {
  const key = getKey(keyId)

  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error(
      `Invalid ciphertext format: expected 3 colon-separated parts, got ${parts.length}`
    )
  }

  const [ivB64, authTagB64, encryptedB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `Invalid ciphertext format: expected IV length ${IV_LENGTH}, got ${iv.length}`
    )
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid ciphertext format: expected auth tag length ${AUTH_TAG_LENGTH}, got ${authTag.length}`
    )
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * Convenience: decrypt the access token from a connection record.
 *
 * Three cases, deliberately distinguished:
 *
 * - `encryptionKeyId === null` — a pre-migration row whose token was stored in
 *   the clear. A SQL NULL is the marker for that, so the token is returned
 *   as-is. This is the only branch that returns the stored value.
 * - `encryptionKeyId === ''` — corrupt. Nothing writes an empty key id:
 *   `encrypt()` always returns the id from `ENCRYPTION_KEY_CURRENT_ID`, and
 *   `getCurrentKeyId()` rejects an empty value. A row that has one is in a
 *   state this code cannot reason about, and the safe reading is *not* "it
 *   must be legacy plaintext" — the column is `String?`, so a legacy row would
 *   be NULL, not `''`. Treating `''` as legacy would hand the caller the
 *   ciphertext as if it were the access token, which then goes to Plaid.
 *   Throwing fails one connection loudly; guessing corrupts an outbound
 *   credential silently. Hence the explicit throw.
 * - anything else — a real key id, so decrypt under it.
 *
 * The test is `=== null`, not `!` and not `== null`. `!` is the original bug:
 * it let `''` through. `== null` would additionally admit `undefined` — the
 * shape you get when a Prisma `select` omits the column — and hand back the
 * stored value for a row that is genuinely encrypted, which is the same defect
 * through a different door. No call site does that today (every selection
 * includes `encryptionKeyId`, and the type makes omitting it a compile error),
 * but `=== null` costs nothing and fails closed if one ever does: `undefined`
 * falls through to `getKey(undefined)`, which throws on the missing env var.
 * Only a real SQL NULL means "legacy".
 */
export function getDecryptedAccessToken(connection: {
  plaidAccessToken: string
  encryptionKeyId: string | null
}): string {
  if (connection.encryptionKeyId === null) {
    // Legacy unencrypted token (pre-migration)
    return connection.plaidAccessToken
  }

  if (connection.encryptionKeyId === '') {
    throw new Error(
      'Corrupt connection: encryptionKeyId is an empty string. A legacy ' +
        'unencrypted row must have a NULL key id; refusing to treat the ' +
        'stored ciphertext as an access token.'
    )
  }

  return decrypt(connection.plaidAccessToken, connection.encryptionKeyId)
}
