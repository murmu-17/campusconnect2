const express = require("express");
const router = express.Router();
const db = require("../db/connection");

// ================= ALL USERS (admin/general use) =================
router.get("/", (req, res) => {
  const { institute, batch, branch, degree, account_type } = req.query;
  let query = "SELECT id,full_name,email,phone,institute,batch,degree,branch,account_type,verification_status FROM users WHERE 1=1";
  const params = [];

  if (account_type) { query += " AND account_type=?"; params.push(account_type); }
  if (institute)    { query += " AND institute=?";    params.push(institute); }
  if (batch)        { query += " AND batch=?";        params.push(parseInt(batch)); }
  if (branch)       { query += " AND branch LIKE ?";  params.push("%" + branch + "%"); }
  if (degree)       { query += " AND degree=?";       params.push(degree); }

  query += " ORDER BY batch DESC,full_name ASC LIMIT 100";
  db.query(query, params, (err, results) => {
    if (err) return res.json({ success: false, message: "DB error" });
    res.json({ success: true, users: results, total: results.length });
  });
});

// ================= NETWORK SEARCH (only enabled institutes) =================
router.get("/search", (req, res) => {
  const { institute, batch, branch, degree, name, viewer_id } = req.query;
  let query =
    "SELECT u.id,u.full_name,u.institute,u.batch,u.degree,u.branch,u.account_type " +
    "FROM users u WHERE u.verification_status='approved' AND u.account_type='verified'" +
    " AND u.institute IN (SELECT name FROM institutes WHERE is_enabled=1)";
  const params = [];

  if (viewer_id) {
    query += " AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=? UNION SELECT blocker_id FROM blocks WHERE blocked_id=?)";
    params.push(viewer_id, viewer_id);
  }
  if (name)      { query += " AND u.full_name LIKE ?"; params.push("%" + name + "%"); }
  if (institute) { query += " AND u.institute=?";      params.push(institute); }
  if (batch)     { query += " AND u.batch=?";          params.push(parseInt(batch)); }
  if (branch)    { query += " AND u.branch LIKE ?";    params.push("%" + branch + "%"); }
  if (degree)    { query += " AND u.degree=?";         params.push(degree); }
  if (viewer_id) { query += " AND u.id!=?";            params.push(viewer_id); }

  query += " ORDER BY u.full_name ASC LIMIT 50";
  db.query(query, params, (err, results) => {
    if (err) return res.json({ success: false, message: "DB error: " + err.message });
    res.json({ success: true, users: results });
  });
});

module.exports = router;
