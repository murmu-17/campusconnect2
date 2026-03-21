const { WebSocketServer } = require("ws");
const db = require("../db/connection");

// Connected clients: userId (string) → WebSocket
const clients = new Map();

function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let userId = null;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);

        // ---- REGISTER ----
        if (msg.type === "register") {
          userId = String(msg.user_id);
          clients.set(userId, ws);
          return;
        }

        // ---- SEND MESSAGE ----
        if (msg.type === "message") {
          const { sender_id, receiver_id, content } = msg;

          // Check for blocks in either direction
          db.query(
            "SELECT id FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)",
            [sender_id, receiver_id, receiver_id, sender_id],
            (err, blocks) => {
              if (blocks && blocks.length > 0) {
                ws.send(JSON.stringify({ type: "error", message: "Cannot send message" }));
                return;
              }

              db.query(
                "INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)",
                [sender_id, receiver_id, content],
                (err, result) => {
                  if (err) {
                    ws.send(JSON.stringify({ type: "error", message: "Failed to send" }));
                    return;
                  }

                  const payload = JSON.stringify({
                    type: "message",
                    id: result.insertId,
                    sender_id,
                    receiver_id,
                    content,
                    created_at: new Date().toISOString(),
                  });

                  // Deliver to receiver if online
                  const receiverWs = clients.get(String(receiver_id));
                  if (receiverWs && receiverWs.readyState === 1) receiverWs.send(payload);

                  // Echo back to sender
                  ws.send(payload);
                }
              );
            }
          );
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    });

    ws.on("close", () => {
      if (userId) clients.delete(userId);
    });
  });

  console.log("WebSocket server initialized");
}

module.exports = { initWebSocket };
