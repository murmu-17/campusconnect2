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
     JOIN messages m ON ((m.sender_id=u.id AND m.receiver_id=?) OR (m.receiver_id=u.id AND m.sender_id=?))
     WHERE u.id!=?
     GROUP BY u.id
     ORDER BY last_time DESC`,
    [user_id, user_id, user_id, user_id],
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
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
     WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
     ORDER BY m.created_at ASC`,
    [user1, user2, user2, user1],
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      // Mark messages as read
      db.query("UPDATE messages SET is_read=1 WHERE receiver_id=? AND sender_id=?", [user1, user2], () => {});
      res.json({ success: true, messages: results });
    }
  );
});

module.exports = router;
