const express = require("express");
const router = express.Router();
const db = require("../db/connection");

// ================= INBOX (conversation list) =================
router.get("/inbox/:user_id", (req, res) => {
  const { user_id } = req.params;
  db.query(
    `SELECT u.id, u.full_name, u.institute, u.batch,
       m.content as last_message, m.created_at as last_time, m.sender_id,
       SUM(CASE WHEN m.is_read=0 AND m.receiver_id=? THEN 1 ELSE 0 END) as unread_count
     FROM users u
     JOIN messages m ON m.id = (
       SELECT id FROM messages
       WHERE (sender_id=u.id AND receiver_id=?) OR (sender_id=? AND receiver_id=u.id)
       ORDER BY created_at DESC LIMIT 1
     )
     WHERE u.id!=?
     GROUP BY u.id
     ORDER BY last_time DESC`,
    [user_id, user_id, user_id, user_id],
    (err, results) => {
      if (err) { console.error("INBOX ERROR:", err.message); return res.json({ success: false, message: "DB error" }); }
      res.json({ success: true, conversations: results });
    }
  );
});

// ================= CONVERSATION MESSAGES =================
router.get("/:user1/:user2", (req, res) => {
  const { user1, user2 } = req.params;
  db.query(
    `SELECT m.*, u.full_name as sender_name
     FROM messages m
     JOIN users u ON u.id=m.sender_id
     WHERE ((m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?))
     AND m.deleted_for_everyone=0
     AND NOT (m.sender_id=? AND m.deleted_by_sender=1)
     AND NOT (m.receiver_id=? AND m.deleted_by_receiver=1)
     ORDER BY m.created_at ASC`,
    [user1, user2, user2, user1, user1, user1],
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      db.query("UPDATE messages SET is_read=1 WHERE receiver_id=? AND sender_id=?", [user1, user2], () => {});
      res.json({ success: true, messages: results });
    }
  );
});
// ================= DELETE MESSAGE =================
router.post("/delete/:message_id", (req, res) => {
  const { message_id } = req.params;
  const { user_id, delete_for_everyone } = req.body;

  db.query("SELECT sender_id, receiver_id FROM messages WHERE id=?", [message_id], (err, result) => {
    if (err || result.length === 0) return res.json({ success: false, message: "Message not found" });
    
    var msg = result[0];
    var isSender = msg.sender_id == user_id;
    var isReceiver = msg.receiver_id == user_id;

    if (delete_for_everyone && isSender) {
      db.query("UPDATE messages SET deleted_for_everyone=1 WHERE id=?", [message_id], (err2) => {
        if (err2) return res.json({ success: false, message: "DB error" });
        res.json({ success: true, type: "everyone" });
      });
    } else if (isSender) {
      db.query("UPDATE messages SET deleted_by_sender=1 WHERE id=?", [message_id], (err2) => {
        if (err2) return res.json({ success: false, message: "DB error" });
        res.json({ success: true, type: "sender" });
      });
    } else if (isReceiver) {
      db.query("UPDATE messages SET deleted_by_receiver=1 WHERE id=?", [message_id], (err2) => {
        if (err2) return res.json({ success: false, message: "DB error" });
        res.json({ success: true, type: "receiver" });
      });
    } else {
      res.json({ success: false, message: "Not authorized" });
    }
  });
});
// ================= DELETE ENTIRE CHAT =================
router.post("/delete-chat", (req, res) => {
  const { user_id, other_user_id } = req.body;
  if (!user_id || !other_user_id) {
    return res.json({ success: false, message: "Missing user IDs" });
  }

  // Mark all messages deleted for this user (both sent and received)
  db.query(
    `UPDATE messages SET deleted_by_sender=1 
     WHERE sender_id=? AND receiver_id=?`,
    [user_id, other_user_id],
    (err1) => {
      if (err1) return res.json({ success: false, message: "DB error" });

      db.query(
        `UPDATE messages SET deleted_by_receiver=1 
         WHERE sender_id=? AND receiver_id=?`,
        [other_user_id, user_id],
        (err2) => {
          if (err2) return res.json({ success: false, message: "DB error" });
          res.json({ success: true, message: "Chat deleted" });
        }
      );
    }
  );
});

module.exports = router;