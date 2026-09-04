const _PADDLE_API_KEY = process.env.PADDLE_API_KEY
const PADDLE_ENVIRONMENT = process.env.PADDLE_ENVIRONMENT || "sandbox"
const _PADDLE_API_URL = PADDLE_ENVIRONMENT === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com"

export const paddleService = {
  /**
   * Get Paddle client-side token from environment
   */
  getClientToken(): string {
    const token = process.env.PADDLE_CLIENT_TOKEN
    if (!token) {
      throw new Error("PADDLE_CLIENT_TOKEN not configured")
    }
    return token
  },

  /**
   * Get Paddle environment
   */
  getEnvironment(): "sandbox" | "production" {
    return process.env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox"
  },
}
