import type { Elysia } from "elysia";
import type { ServerWebSocket } from "bun";

interface WebSocketData {
  organizationId?: string;
}

const organizationSockets = new Map<string, Set<ServerWebSocket<WebSocketData>>>();

/**
 * Initialize WebSocket tracking
 */
export function initWebSocket(_app: Elysia) {
  console.log("[WebSocket] Tracking initialized");
  
  // Clean up dead sockets every 30 seconds
  setInterval(() => {
    cleanupDeadSockets();
  }, 30000);
}

/**
 * Clean up dead/closed sockets from all organizations
 */
function cleanupDeadSockets() {
  let totalCleaned = 0;
  
  organizationSockets.forEach((sockets, orgId) => {
    const deadSockets: ServerWebSocket<WebSocketData>[] = [];
    
    sockets.forEach((ws) => {
      // Check if socket is closed or closing
      if (ws.readyState !== 1) { // 1 = OPEN
        deadSockets.push(ws);
      }
    });
    
    deadSockets.forEach(ws => {
      sockets.delete(ws);
      totalCleaned++;
    });
    
    // Clean up empty org sets
    if (sockets.size === 0) {
      organizationSockets.delete(orgId);
    }
  });
  
  if (totalCleaned > 0) {
    console.log(`[WebSocket] Cleanup: Removed ${totalCleaned} dead sockets`);
  }
}

/**
 * Broadcast message to all clients in an organization
 */
export function broadcastToOrganization(organizationId: string, message: any) {
  const sockets = organizationSockets.get(organizationId);
  
  if (!sockets || sockets.size === 0) {
    console.log(`[WebSocket] No clients connected for org: ${organizationId}`);
    return;
  }

  const messageStr = JSON.stringify(message);
  let sent = 0;
  const deadSockets: ServerWebSocket<WebSocketData>[] = [];

  sockets.forEach((ws) => {
    try {
      // Check if socket is still open
      if (ws.readyState === 1) { // 1 = OPEN
        ws.send(messageStr);
        sent++;
      } else {
        // Socket is closed or closing, mark for removal
        deadSockets.push(ws);
      }
    } catch (error) {
      console.error("[WebSocket] Error sending message:", error);
      deadSockets.push(ws);
    }
  });

  // Clean up dead sockets
  deadSockets.forEach(ws => {
    sockets.delete(ws);
    console.log(`[WebSocket] Removed dead socket from org: ${organizationId}`);
  });

  console.log(`[WebSocket] Broadcasted to ${sent} clients in org: ${organizationId} (${deadSockets.length} dead sockets removed)`);

  // Clean up empty sets
  if (sockets.size === 0) {
    organizationSockets.delete(organizationId);
  }
}

/**
 * Add socket to organization room
 */
export function joinOrganization(ws: ServerWebSocket<WebSocketData>, organizationId: string) {
  // First, remove this socket from any previous organization
  leaveOrganization(ws);
  
  if (!organizationSockets.has(organizationId)) {
    organizationSockets.set(organizationId, new Set());
  }
  
  const sockets = organizationSockets.get(organizationId)!;
  sockets.add(ws);
  ws.data.organizationId = organizationId;
  
  console.log(`[WebSocket] Client joined org: ${organizationId} (${sockets.size} total clients)`);
}

/**
 * Remove socket from organization room
 */
export function leaveOrganization(ws: ServerWebSocket<WebSocketData>) {
  const organizationId = ws.data.organizationId;
  
  if (organizationId) {
    const sockets = organizationSockets.get(organizationId);
    if (sockets) {
      sockets.delete(ws);
      
      if (sockets.size === 0) {
        organizationSockets.delete(organizationId);
      }
      
      console.log(`[WebSocket] Client left org: ${organizationId}`);
    }
  }
}

/**
 * Emit email opened event to organization members
 */
export function emitEmailOpened(organizationId: string, data: {
  emailHistoryId: string;
  recipient: string;
  openedAt: string;
  userAgent?: string;
  totalOpens: number;
}) {
  broadcastToOrganization(organizationId, {
    type: "email:opened",
    data,
  });
}
