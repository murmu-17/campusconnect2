const { VALID_DOMAINS } = require("../config/constants");
const db = require("../db/connection");

function isValidInstituteEmail(email) {
  return VALID_DOMAINS.some((d) => email.toLowerCase().endsWith(d));
}

function logActivity(adminId, adminName, adminRole, action, targetUserId, targetUserName) {
  db.query(
    "INSERT INTO activity_logs (admin_id,admin_name,admin_role,action,target_user_id,target_user_name) VALUES (?,?,?,?,?,?)",
    [adminId, adminName, adminRole, action, targetUserId || null, targetUserName || null],
    (err) => { if (err) console.error("Log error:", err.message); }
  );
}

module.exports = { isValidInstituteEmail, logActivity };
