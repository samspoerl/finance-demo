// Encrypt and decrypt Plaid access tokens at rest using AES-256-GCM.
//
// Keys are stored in env vars using a registry pattern for rotation:
//   ENCRYPTION_KEY_<id> = base64-encoded 32-byte key
//   ENCRYPTION_KEY_CURRENT_ID = id of the key used for new encryptions
//
// Stored format: iv:authTag:ciphertext (all base64)
//
// The `server-only` guard prevents this module from being bundled in
// client components. Node.js scripts (e.g. migration scripts) should
// import from `cipher-core` directly to avoid the guard.

import 'server-only'

export {
  decrypt,
  encrypt,
  getDecryptedAccessToken,
} from '@/lib/utils/cipher-core'
