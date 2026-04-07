const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const { hasUserSubtypeColumn } = require("../lib/helpers");

// ================= ALL USERS (admin/general use) =================
router.get("/", (req, res) => {
  const { institute, batch, branch, degree, account_type } = req.query;
  hasUserSubtypeColumn((hasSubtypeColumn) => {
    let query = "SELECT id,full_name,email,phone,institute,batch,degree,branch,account_type," +
      (hasSubtypeColumn ? "user_subtype," : "NULL AS user_subtype,") +
      "verification_status,is_suspended FROM users WHERE 1=1";
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
});

// ================= NETWORK SEARCH (only enabled institutes) =================
router.get("/search", (req, res) => {
  const { institute, batch, branch, degree, name, viewer_id, user_id } = req.query;
  let query =
    "SELECT u.id,u.full_name,u.institute,u.batch,u.degree,u.branch,u.account_type,u.verification_status " +
    "FROM users u WHERE u.verification_status='approved' AND u.account_type='verified'" +
    " AND u.institute IN (SELECT name FROM institutes WHERE is_enabled=1)";
  const params = [];

  if (viewer_id) {
    query += " AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=? UNION SELECT blocker_id FROM blocks WHERE blocked_id=?)";
    params.push(viewer_id, viewer_id);
  }
  if (user_id)   { query += " AND u.id=?";             params.push(parseInt(user_id)); }
  if (name)      { query += " AND u.full_name LIKE ?"; params.push("%" + name + "%"); }
  if (institute) { query += " AND u.institute=?";      params.push(institute); }
  if (batch)     { query += " AND u.batch=?";          params.push(parseInt(batch)); }
  if (branch)    { query += " AND u.branch LIKE ?";    params.push("%" + branch + "%"); }
  if (degree)    { query += " AND u.degree=?";         params.push(degree); }
  if (viewer_id && !user_id) { query += " AND u.id!=?"; params.push(viewer_id); }

  query += " ORDER BY u.full_name ASC LIMIT 50";
  db.query(query, params, (err, results) => {
    if (err) return res.json({ success: false, message: "DB error: " + err.message });
    res.json({ success: true, users: results });
  });
});

// ================= SAVE PROFILE =================
router.post("/profile/save", (req, res) => {
  const { user_id, headline, about, experience, internships, education, projects, skills, achievements, profile_pic, visibility } = req.body;
  if (!user_id) return res.json({ success: false, message: "User ID required" });

  db.query(
    `INSERT INTO user_profiles (user_id, headline, about, experience, internships, education, projects, skills, achievements, profile_pic, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       headline=VALUES(headline),
       about=VALUES(about),
       experience=VALUES(experience),
       internships=VALUES(internships),
       education=VALUES(education),
       projects=VALUES(projects),
       skills=VALUES(skills),
       achievements=VALUES(achievements),
       profile_pic=VALUES(profile_pic),
       visibility=VALUES(visibility)`,
    [
      user_id,
      headline || null,
      about || null,
      JSON.stringify(experience || []),
      JSON.stringify(internships || []),
      JSON.stringify(education || []),
      JSON.stringify(projects || []),
      JSON.stringify(skills || []),
      JSON.stringify(achievements || []),
      profile_pic || null,
      JSON.stringify(visibility || {})
    ],
    (err) => {
      if (err) return res.json({ success: false, message: "DB error: " + err.message });
      res.json({ success: true, message: "Profile saved" });
    }
  );
});

// ================= GET PROFILE =================
router.get("/profile/:user_id", (req, res) => {
  const { user_id } = req.params;
  db.query(
    "SELECT * FROM user_profiles WHERE user_id=?",
    [user_id],
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      if (results.length === 0) return res.json({ success: true, profile: {} });
      var p = results[0];
      try {
        function safeparse(val, def) {
          if (!val) return def;
          if (typeof val === 'object') return val;
          try { return JSON.parse(val); } catch(e) { return def; }
        }
        res.json({
          success: true,
          profile: {
            headline:     p.headline,
            about:        p.about,
            experience:   safeparse(p.experience,   []),
            internships:  safeparse(p.internships,  []),
            education:    safeparse(p.education,    []),
            projects:     safeparse(p.projects,     []),
            skills:       safeparse(p.skills,       []),
            achievements: safeparse(p.achievements, []),
            profile_pic:  p.profile_pic,
            visibility:   safeparse(p.visibility,   {})
          }
        });
      } catch(e) {
        console.error("Profile parse error:", e);
        res.json({ success: false, message: "Parse error" });
      }
    }
  );
});

// ================= GET WARNING =================
router.get("/warning/:user_id", (req, res) => {
  db.query("SELECT warning_message, warning_seen FROM users WHERE id=?", [req.params.user_id], (err, results) => {
    if (err || results.length === 0) return res.json({ success: false });
    var u = results[0];
    if (u.warning_message && u.warning_seen === 0) {
      return res.json({ success: true, has_warning: true, warning_message: u.warning_message });
    }
    res.json({ success: true, has_warning: false });
  });
});

// ================= MARK WARNING SEEN =================
router.post("/warning/seen/:user_id", (req, res) => {
  db.query("UPDATE users SET warning_seen=1 WHERE id=?", [req.params.user_id], (err) => {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

module.exports = router;
