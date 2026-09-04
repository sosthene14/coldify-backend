import type { ServerWebSocket } from "bun"
import type { Elysia } from "elysia"

interface WebSocketData {
  userId?: string
}

const userSockets = new Map<string, Set<ServerWebSocket<WebSocketData>>>()

/**
 * Initialize WebSocket tracking
 */
export function initWebSocket(_app: Elysia) {
  console.log("[WebSocket] Tracking initialized")

  // Clean up dead sockets every 30 seconds
  setInterval(() => {
    cleanupDeadSockets()
  }, 30000)
}

/**
 * Clean up dead/closed sockets from all organizations
 */
function cleanupDeadSockets() {
  let totalCleaned = 0

  userSockets.forEach((sockets, userId) => {
    const deadSockets: ServerWebSocket<WebSocketData>[] = []

    sockets.forEach((ws) => {
      // Check if socket is closed or closing
      if (ws.readyState !== 1) {
        // 1 = OPEN
        deadSockets.push(ws)
      }
    })

    deadSockets.forEach((ws) => {
      sockets.delete(ws)
      totalCleaned++
    })

    // Clean up empty user sets
    if (sockets.size === 0) {
      userSockets.delete(userId)
    }
  })

  if (totalCleaned > 0) {
    console.log(`[WebSocket] Cleanup: Removed ${totalCleaned} dead sockets`)
  }
}

export interface WebSocketMessage {
  type: string
  data?: unknown
}

/**
 * Broadcast message to specific user
 */
export function broadcastToUser(userId: string, message: WebSocketMessage) {
  const sockets = userSockets.get(userId)

  if (!sockets || sockets.size === 0) {
    console.log(`[WebSocket] No clients connected for user: ${userId}`)
    return
  }

  const messageStr = JSON.stringify(message)
  let sent = 0
  const deadSockets: ServerWebSocket<WebSocketData>[] = []

  sockets.forEach((ws) => {
    try {
      // Check if socket is still open
      if (ws.readyState === 1) {
        // 1 = OPEN
        ws.send(messageStr)
        sent++
      } else {
        // Socket is closed or closing, mark for removal
        deadSockets.push(ws)
      }
    } catch (error) {
      console.error("[WebSocket] Error sending message:", error)
      deadSockets.push(ws)
    }
  })

  // Clean up dead sockets
  deadSockets.forEach((ws) => {
    sockets.delete(ws)
    console.log(`[WebSocket] Removed dead socket from user: ${userId}`)
  })

  console.log(
    `[WebSocket] Broadcasted to ${sent} clients for user: ${userId} (${deadSockets.length} dead sockets removed)`,
  )

  // Clean up empty sets
  if (sockets.size === 0) {
    userSockets.delete(userId)
  }
}

/**
 * Add socket to user room
 */
export function joinUser(ws: ServerWebSocket<WebSocketData>, userId: string) {
  leaveUser(ws)

  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set())
  }

  const sockets = userSockets.get(userId)
  if (!sockets) {
    // This should never happen since we just set it above
    console.error(`[WebSocket] Failed to get sockets for user: ${userId}`)
    return
  }

  sockets.add(ws)
  ws.data.userId = userId

  console.log(`[WebSocket] Client joined user: ${userId} (${sockets.size} total clients)`)
}

/**
 * Remove socket from user room
 */
export function leaveUser(ws: ServerWebSocket<WebSocketData>) {
  const userId = ws.data.userId

  if (userId) {
    const sockets = userSockets.get(userId)
    if (sockets) {
      sockets.delete(ws)

      if (sockets.size === 0) {
        userSockets.delete(userId)
      }

      console.log(`[WebSocket] Client left user: ${userId}`)
    }
  }
}

/**
 * Emit email opened event to user
 */
export function emitEmailOpened(
  userId: string,
  data: {
    emailHistoryId: string
    recipient: string
    openedAt: string
    userAgent?: string
    totalOpens: number
  },
) {
  broadcastToUser(userId, {
    type: "email:opened",
    data,
  })
}
