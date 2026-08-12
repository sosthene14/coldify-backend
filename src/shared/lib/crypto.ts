// src/shared/lib/crypto.ts
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'

/**
 * Encrypt sensitive data using JWT
 */
export function encrypt(data: string): string {
  return jwt.sign({ data }, SECRET, { expiresIn: '100y' })
}

/**
 * Decrypt data that was encrypted with JWT
 */
export function decrypt(encryptedData: string): string {
  try {
    const decoded = jwt.verify(encryptedData, SECRET) as { data: string }
    return decoded.data
  } catch (error) {
    throw new Error('Failed to decrypt data')
  }
}
