// src/shared/lib/crypto.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import jwt from "jsonwebtoken"

const SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production"
const EMAIL_CONTENT_ALGORITHM = "aes-256-gcm"
const EMAIL_CONTENT_KEY_ENV = "EMAIL_CONTENT_ENCRYPTION_KEY"

function getEmailContentKey(): Buffer {
  const key = process.env[EMAIL_CONTENT_KEY_ENV]

  if (!key) {
    throw new Error(`${EMAIL_CONTENT_KEY_ENV} environment variable is required`)
  }

  return createHash("sha256").update(key, "utf8").digest()
}

/**
 * Encrypt sensitive data using JWT
 */
export function encrypt(data: string): string {
  return jwt.sign({ data }, SECRET, { expiresIn: "100y" })
}

/**
 * Decrypt data that was encrypted with JWT
 */
export function decrypt(encryptedData: string): string {
  try {
    const decoded = jwt.verify(encryptedData, SECRET) as { data: string }
    return decoded.data
  } catch (_error) {
    throw new Error("Failed to decrypt data")
  }
}

/**
 * Encrypt email content with authenticated encryption.
 * The payload format is versioned so the key format can evolve safely.
 */
export function encryptEmailContent(data: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(EMAIL_CONTENT_ALGORITHM, getEmailContentKey(), iv)
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return ["v1", iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".")
}

/**
 * Decrypt email content encrypted by encryptEmailContent.
 */
export function decryptEmailContent(encryptedData: string): string {
  try {
    const [version, ivBase64, authTagBase64, contentBase64] = encryptedData.split(".")

    if (version !== "v1" || !ivBase64 || !authTagBase64 || !contentBase64) {
      throw new Error("Invalid encrypted email content")
    }

    const decipher = createDecipheriv(EMAIL_CONTENT_ALGORITHM, getEmailContentKey(), Buffer.from(ivBase64, "base64"))
    decipher.setAuthTag(Buffer.from(authTagBase64, "base64"))

    return Buffer.concat([
      decipher.update(Buffer.from(contentBase64, "base64")),
      decipher.final(),
    ]).toString("utf8")
  } catch (_error) {
    throw new Error("Failed to decrypt email content")
  }
}
