// Round-trip tests for the AES-256-GCM helpers that protect Plaid access
// tokens at rest.
//
// Two rules govern this file:
//   1. No real access token appears here. Every fixture is an obviously-fake
//      string, and none of them is ever logged.
//   2. Keys are generated per-test from `randomBytes` and written to
//      `process.env` only for the duration of the test. No key is hard-coded,
//      so nothing here could ever collide with a real deployment key.
//
// `cipher-core` is imported (not `cipher`), because `cipher` adds the
// `server-only` guard, which throws outside a React Server Component.

import {
  decrypt,
  encrypt,
  getDecryptedAccessToken,
} from '@/lib/utils/cipher-core'
import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const KEY_ID = 'TEST'
const OTHER_KEY_ID = 'TEST_OTHER'

// Obviously-fake stand-ins. Plaid's real tokens look like
// `access-production-<uuid>`; nothing below is or resembles a live credential.
const FAKE_TOKEN = 'access-sandbox-not-a-real-token-0000'
const FAKE_TOKEN_2 = 'access-sandbox-also-not-real-1111'

function newKey(): string {
  return randomBytes(32).toString('base64')
}

// Only these three vars are ever touched, and each is restored individually.
// Reassigning `process.env` wholesale would work for the values but would
// replace Node's special env object with a plain one, losing its
// string-coercion for the rest of the worker.
const MANAGED_VARS = [
  `ENCRYPTION_KEY_${KEY_ID}`,
  `ENCRYPTION_KEY_${OTHER_KEY_ID}`,
  'ENCRYPTION_KEY_CURRENT_ID',
] as const

const savedEnv = new Map(MANAGED_VARS.map((k) => [k, process.env[k]]))

beforeEach(() => {
  process.env[`ENCRYPTION_KEY_${KEY_ID}`] = newKey()
  process.env[`ENCRYPTION_KEY_${OTHER_KEY_ID}`] = newKey()
  process.env.ENCRYPTION_KEY_CURRENT_ID = KEY_ID
})

afterEach(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('encrypt / decrypt round trip', () => {
  it('returns the original plaintext', () => {
    const { encrypted, keyId } = encrypt(FAKE_TOKEN)
    expect(decrypt(encrypted, keyId)).toBe(FAKE_TOKEN)
  })

  it('reports the current key id', () => {
    expect(encrypt(FAKE_TOKEN).keyId).toBe(KEY_ID)
  })

  it('round-trips an empty string', () => {
    const { encrypted, keyId } = encrypt('')
    expect(decrypt(encrypted, keyId)).toBe('')
  })

  it('round-trips multi-byte UTF-8 without mangling it', () => {
    const plaintext = 'wéîrd ünïcode ✓ 日本語 🔐'
    const { encrypted, keyId } = encrypt(plaintext)
    expect(decrypt(encrypted, keyId)).toBe(plaintext)
  })

  it('round-trips a long value', () => {
    const plaintext = 'x'.repeat(10_000)
    const { encrypted, keyId } = encrypt(plaintext)
    expect(decrypt(encrypted, keyId)).toBe(plaintext)
  })

  it('round-trips a value containing the colon delimiter', () => {
    // The stored format is colon-separated, so a colon in the plaintext must
    // not confuse the parser — it is inside the base64 payload, not beside it.
    const plaintext = 'a:b:c:d'
    const { encrypted, keyId } = encrypt(plaintext)
    expect(decrypt(encrypted, keyId)).toBe(plaintext)
  })

  it('round-trips under a non-current key id', () => {
    process.env.ENCRYPTION_KEY_CURRENT_ID = OTHER_KEY_ID
    const { encrypted, keyId } = encrypt(FAKE_TOKEN)
    expect(keyId).toBe(OTHER_KEY_ID)
    expect(decrypt(encrypted, keyId)).toBe(FAKE_TOKEN)
  })
})

describe('ciphertext shape', () => {
  it('is three colon-separated base64 parts', () => {
    const parts = encrypt(FAKE_TOKEN).encrypted.split(':')
    expect(parts).toHaveLength(3)
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9+/]*={0,2}$/)
    }
  })

  it('uses a 12-byte IV and a 16-byte auth tag', () => {
    const [ivB64, tagB64] = encrypt(FAKE_TOKEN).encrypted.split(':')
    expect(Buffer.from(ivB64, 'base64')).toHaveLength(12)
    expect(Buffer.from(tagB64, 'base64')).toHaveLength(16)
  })

  it('does not contain the plaintext', () => {
    const { encrypted } = encrypt(FAKE_TOKEN)
    expect(encrypted).not.toContain(FAKE_TOKEN)
    expect(
      Buffer.from(encrypted.split(':')[2], 'base64').toString('utf8')
    ).not.toBe(FAKE_TOKEN)
  })

  it('uses a fresh IV per call, so the same plaintext encrypts differently', () => {
    const a = encrypt(FAKE_TOKEN).encrypted
    const b = encrypt(FAKE_TOKEN).encrypted
    expect(a).not.toBe(b)
    expect(a.split(':')[0]).not.toBe(b.split(':')[0])
  })

  it('keeps distinct plaintexts distinguishable after a round trip', () => {
    const first = encrypt(FAKE_TOKEN)
    const second = encrypt(FAKE_TOKEN_2)
    expect(decrypt(first.encrypted, first.keyId)).toBe(FAKE_TOKEN)
    expect(decrypt(second.encrypted, second.keyId)).toBe(FAKE_TOKEN_2)
  })
})

describe('authentication', () => {
  it('rejects a ciphertext decrypted with the wrong key', () => {
    const { encrypted } = encrypt(FAKE_TOKEN)
    expect(() => decrypt(encrypted, OTHER_KEY_ID)).toThrow()
  })

  it('rejects a tampered ciphertext body', () => {
    const [iv, tag, body] = encrypt(FAKE_TOKEN).encrypted.split(':')
    const bytes = Buffer.from(body, 'base64')
    bytes[0] ^= 0xff
    expect(() =>
      decrypt([iv, tag, bytes.toString('base64')].join(':'), KEY_ID)
    ).toThrow()
  })

  it('rejects a tampered auth tag', () => {
    const [iv, tag, body] = encrypt(FAKE_TOKEN).encrypted.split(':')
    const bytes = Buffer.from(tag, 'base64')
    bytes[0] ^= 0xff
    expect(() =>
      decrypt([iv, bytes.toString('base64'), body].join(':'), KEY_ID)
    ).toThrow()
  })

  it('rejects a tampered IV', () => {
    const [iv, tag, body] = encrypt(FAKE_TOKEN).encrypted.split(':')
    const bytes = Buffer.from(iv, 'base64')
    bytes[0] ^= 0xff
    expect(() =>
      decrypt([bytes.toString('base64'), tag, body].join(':'), KEY_ID)
    ).toThrow()
  })

  it('rejects an auth tag and body swapped between two ciphertexts', () => {
    const [ivA, , bodyA] = encrypt(FAKE_TOKEN).encrypted.split(':')
    const [, tagB] = encrypt(FAKE_TOKEN_2).encrypted.split(':')
    expect(() => decrypt([ivA, tagB, bodyA].join(':'), KEY_ID)).toThrow()
  })
})

describe('malformed input', () => {
  it('rejects a ciphertext without three parts', () => {
    expect(() => decrypt('onlyonepart', KEY_ID)).toThrow(
      /expected 3 colon-separated parts/
    )
    expect(() => decrypt('a:b', KEY_ID)).toThrow(
      /expected 3 colon-separated parts/
    )
    expect(() => decrypt('a:b:c:d', KEY_ID)).toThrow(
      /expected 3 colon-separated parts/
    )
  })

  it('rejects a wrong-length IV before attempting to decrypt', () => {
    const [, tag, body] = encrypt(FAKE_TOKEN).encrypted.split(':')
    const shortIv = randomBytes(8).toString('base64')
    expect(() => decrypt([shortIv, tag, body].join(':'), KEY_ID)).toThrow(
      /expected IV length 12/
    )
  })

  it('rejects a wrong-length auth tag before attempting to decrypt', () => {
    const [iv, , body] = encrypt(FAKE_TOKEN).encrypted.split(':')
    const shortTag = randomBytes(8).toString('base64')
    expect(() => decrypt([iv, shortTag, body].join(':'), KEY_ID)).toThrow(
      /expected auth tag length 16/
    )
  })
})

describe('key configuration', () => {
  it('throws a named error when the current key id is unset', () => {
    delete process.env.ENCRYPTION_KEY_CURRENT_ID
    expect(() => encrypt(FAKE_TOKEN)).toThrow(
      'Missing env var: ENCRYPTION_KEY_CURRENT_ID'
    )
  })

  it('throws a named error when the key env var is missing', () => {
    delete process.env[`ENCRYPTION_KEY_${KEY_ID}`]
    expect(() => encrypt(FAKE_TOKEN)).toThrow(
      'Missing encryption key env var: ENCRYPTION_KEY_TEST'
    )
    expect(() => decrypt('a:b:c', KEY_ID)).toThrow(
      'Missing encryption key env var: ENCRYPTION_KEY_TEST'
    )
  })

  it('rejects a key that is not exactly 32 bytes', () => {
    process.env[`ENCRYPTION_KEY_${KEY_ID}`] = randomBytes(16).toString('base64')
    expect(() => encrypt(FAKE_TOKEN)).toThrow(/must be exactly 32 bytes/)

    process.env[`ENCRYPTION_KEY_${KEY_ID}`] = randomBytes(64).toString('base64')
    expect(() => encrypt(FAKE_TOKEN)).toThrow(/must be exactly 32 bytes/)
  })

  it('does not leak the key material into the error message', () => {
    const key = randomBytes(16).toString('base64')
    process.env[`ENCRYPTION_KEY_${KEY_ID}`] = key
    try {
      encrypt(FAKE_TOKEN)
      throw new Error('expected encrypt to throw')
    } catch (error) {
      expect((error as Error).message).not.toContain(key)
    }
  })

  it('supports rotation: an old ciphertext still decrypts under its own key', () => {
    const old = encrypt(FAKE_TOKEN)
    // Rotate: new writes go to the other key, but the old record keeps its id.
    process.env.ENCRYPTION_KEY_CURRENT_ID = OTHER_KEY_ID
    const fresh = encrypt(FAKE_TOKEN_2)

    expect(fresh.keyId).toBe(OTHER_KEY_ID)
    expect(decrypt(old.encrypted, old.keyId)).toBe(FAKE_TOKEN)
    expect(decrypt(fresh.encrypted, fresh.keyId)).toBe(FAKE_TOKEN_2)
  })
})

describe('getDecryptedAccessToken', () => {
  it('decrypts a token that carries a key id', () => {
    const { encrypted, keyId } = encrypt(FAKE_TOKEN)
    expect(
      getDecryptedAccessToken({
        plaidAccessToken: encrypted,
        encryptionKeyId: keyId,
      })
    ).toBe(FAKE_TOKEN)
  })

  it('passes a legacy unencrypted token through when there is no key id', () => {
    // Pre-migration rows stored the token in the clear; a null key id is the
    // marker for that, and losing this branch would lose those tokens.
    expect(
      getDecryptedAccessToken({
        plaidAccessToken: FAKE_TOKEN,
        encryptionKeyId: null,
      })
    ).toBe(FAKE_TOKEN)
  })

  it('throws rather than returning ciphertext when the key id is an empty string', () => {
    // `encryptionKeyId` is `String?` in the schema, so '' is storable, but
    // nothing writes it: a legacy unencrypted row has a NULL key id. An empty
    // key id is therefore a corrupt row, not a legacy one, and must not take
    // the passthrough branch — doing so would hand the caller the ciphertext
    // as if it were the access token, and the caller sends that to Plaid.
    const { encrypted } = encrypt(FAKE_TOKEN)
    expect(() =>
      getDecryptedAccessToken({
        plaidAccessToken: encrypted,
        encryptionKeyId: '',
      })
    ).toThrow(/empty string/)
  })

  it('does not return the ciphertext for any falsy-but-present key id', () => {
    // Guards the regression directly: whatever the function does with a
    // non-null key id it must never be "hand back the stored value".
    const { encrypted } = encrypt(FAKE_TOKEN)
    for (const encryptionKeyId of ['', ' ', '0', 'nope']) {
      let returned: string | undefined
      try {
        returned = getDecryptedAccessToken({
          plaidAccessToken: encrypted,
          encryptionKeyId,
        })
      } catch {
        // Throwing is an acceptable outcome; returning the ciphertext is not.
      }
      expect(returned).not.toBe(encrypted)
    }
  })

  it('throws rather than returning ciphertext when the key id is wrong', () => {
    const { encrypted } = encrypt(FAKE_TOKEN)
    expect(() =>
      getDecryptedAccessToken({
        plaidAccessToken: encrypted,
        encryptionKeyId: OTHER_KEY_ID,
      })
    ).toThrow()
  })
})
