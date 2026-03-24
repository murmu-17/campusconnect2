const express = require("express");
const router = express.Router();
const db = require("../db/connection");

// ================= BLOCK =================
router.post("/block", (req, res) => {
  const { blocker_id, blocked_id } = req.body;
  db.query(
    "INSERT IGNORE INTO blocks (blocker_id,blocked_id) VALUES (?,?)",
    [blocker_id, blocked_id],
    (err) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, message: "User blocked" });
    }
  );
});

// ================= UNBLOCK =================
router.post("/unblock", (req, res) => {
  const { blocker_id, blocked_id } = req.body;
  db.query(
    "DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?",
    [blocker_id, blocked_id],
    (err) => {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});

// ================= REPORT =================
router.post("/report", (req, res) => {
  const { reporter_id, reported_id, reason, details } = req.body;
  if (!reporter_id || !reported_id || !reason)
    return res.json({ success: false, message: "Missing fields" });

  db.query(
    "INSERT INTO reports (reporter_id,reported_id,reason,details) VALUES (?,?,?,?)",
    [reporter_id, reported_id, reason, details || null],
    (err) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, message: "Report submitted" });
    }
  );
});

// ================= INSTITUTES LIST =================
router.get("/institutes", (req, res) => {
  db.query(
    "SELECT id,name,category,is_enabled FROM institutes ORDER BY display_order ASC",
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, institutes: results });
    }
  );
});

// ================= MESSAGE REQUEST =================
router.post("/message-request", (req, res) => {
  const { sender_id, receiver_id } = req.body;
  if (!sender_id || !receiver_id)
    return res.json({ success: false, message: "Missing fields" });

  db.query(
    "INSERT INTO message_requests (sender_id, receiver_id) VALUES (?,?) ON DUPLICATE KEY UPDATE status='pending', created_at=NOW()",
    [sender_id, receiver_id],
    (err) => {
      if (err) return res.json({ success: false, message: "DB error: " + err.message });
      res.json({ success: true, message: "Message request sent!" });
    }
  );
});

// ================= GET MESSAGE REQUESTS =================
router.get("/message-requests/:user_id", (req, res) => {
  const { user_id } = req.params;
  db.query(
    `SELECT mr.*, u.full_name, u.institute, u.batch, u.branch 
     FROM message_requests mr 
     JOIN users u ON u.id = mr.sender_id 
     WHERE mr.receiver_id=? AND mr.status='pending'
     ORDER BY mr.created_at DESC`,
    [user_id],
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, requests: results });
    }
  );
});

// ================= ACCEPT/REJECT MESSAGE REQUEST =================
router.post("/message-request/respond", (req, res) => {
  const { request_id, action } = req.body;
  if (!["accepted","rejected"].includes(action))
    return res.json({ success: false, message: "Invalid action" });

  db.query(
    "UPDATE message_requests SET status=?, accepted_at=? WHERE id=?",
    [action, action === "accepted" ? new Date() : null, request_id],
    (err) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, message: "Request " + action });
    }
  );
});
module.exports = router;
