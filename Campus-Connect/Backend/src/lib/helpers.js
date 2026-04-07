const { VALID_DOMAINS } = require("../config/constants");
const db = require("../db/connection");
let hasUserSubtypeColumnCache = null;

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

function hasUserSubtypeColumn(callback) {
  if (typeof hasUserSubtypeColumnCache === "boolean") {
    return callback(hasUserSubtypeColumnCache);
  }

  db.query("SHOW COLUMNS FROM users LIKE 'user_subtype'", (err, results) => {
    if (err) {
      console.error("User subtype column check:", err.message);
      hasUserSubtypeColumnCache = false;
      return callback(false);
    }
    hasUserSubtypeColumnCache = results.length > 0;
    callback(hasUserSubtypeColumnCache);
  });
}

module.exports = { isValidInstituteEmail, logActivity, hasUserSubtypeColumn };
