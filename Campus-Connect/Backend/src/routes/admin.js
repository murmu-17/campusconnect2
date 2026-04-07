const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../db/connection");
const { logActivity } = require("../lib/helpers");

// ================= PENDING VERIFICATIONS =================
router.get("/pending", (req, res) => {
  db.query(
    "SELECT id,full_name,email,institute,batch,degree,branch,user_subtype,document_path,disparity_message,created_at FROM users WHERE verification_status='pending' ORDER BY created_at DESC",
    (err, results) => {
      if (err) { console.error("PENDING:", err.message); return res.json({ success: false, message: "DB error: " + err.message }); }
      res.json({ success: true, pending: results });
    }
  );
});

// ================= VERIFY USER =================
router.post("/verify", (req, res) => {
  const { user_id, action, admin_id, admin_name, admin_role } = req.body;
  if (!["approved", "rejected"].includes(action))
    return res.json({ success: false, message: "Invalid action" });

  db.query("SELECT full_name FROM users WHERE id=?", [user_id], (err, result) => {
    const userName = result && result[0] ? result[0].full_name : "Unknown";
    db.query(
      "UPDATE users SET verification_status=? WHERE id=?",
      [action, user_id],
      (err, r) => {
        if (err || r.affectedRows === 0)
          return res.json({ success: false, message: "Update failed" });
        logActivity(admin_id, admin_name, admin_role, `User ${action}`, user_id, userName);
        res.json({ success: true, message: `User ${action}` });
      }
    );
  });
});

// ================= RAISE DISPARITY =================
router.post("/disparity", (req, res) => {
  const { user_id, message, admin_id, admin_name, admin_role } = req.body;
  if (!user_id || !message)
    return res.json({ success: false, message: "Required fields missing" });

  db.query("SELECT full_name FROM users WHERE id=?", [user_id], (err, result) => {
    const userName = result && result[0] ? result[0].full_name : "Unknown";
    db.query(
      "UPDATE users SET disparity_message=?,verification_status='pending' WHERE id=?",
      [message, user_id],
      (err) => {
        if (err) return res.json({ success: false, message: "DB error" });
        logActivity(admin_id, admin_name, admin_role, `Raised disparity: ${message}`, user_id, userName);
        res.json({ success: true, message: "Disparity raised" });
      }
    );
  });
});

// ================= VERIFIER MANAGEMENT =================
router.get("/verifiers", (req, res) => {
  db.query(
    "SELECT id,name,email,role,is_active,created_at FROM admins ORDER BY role DESC,created_at ASC",
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, verifiers: results });
    }
  );
});

router.post("/verifiers/create", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.json({ success: false, message: "All fields required" });
  if (password.length < 8)
    return res.json({ success: false, message: "Password min 8 chars" });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO admins (name,email,password,role) VALUES (?,?,?,?)",
      [name, email, hash, "verifier"],
      (err) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY")
            return res.json({ success: false, message: "Email exists" });
          return res.json({ success: false, message: "DB error" });
        }
        res.json({ success: true, message: "Verifier created" });
      }
    );
  } catch (e) {
    res.json({ success: false, message: "Server error" });
  }
});

router.post("/verifiers/toggle", (req, res) => {
  const { verifier_id } = req.body;
  db.query(
    "UPDATE admins SET is_active=NOT is_active WHERE id=? AND role='verifier'",
    [verifier_id],
    (err, result) => {
      if (err || result.affectedRows === 0)
        return res.json({ success: false, message: "Update failed" });
      res.json({ success: true });
    }
  );
});

router.post("/verifiers/change-password", async (req, res) => {
  const { verifier_id, new_password } = req.body;
  if (!new_password || new_password.length < 8)
    return res.json({ success: false, message: "Password min 8 chars" });

  try {
    const hash = await bcrypt.hash(new_password, 10);
    db.query(
      "UPDATE admins SET password=? WHERE id=? AND role='verifier'",
      [hash, verifier_id],
      (err, result) => {
        if (err || result.affectedRows === 0)
          return res.json({ success: false, message: "Update failed" });
        res.json({ success: true, message: "Password updated" });
      }
    );
  } catch (e) {
    res.json({ success: false, message: "Server error" });
  }
});

router.post("/verifiers/delete", (req, res) => {
  const { verifier_id } = req.body;
  db.query(
    "DELETE FROM admins WHERE id=? AND role='verifier'",
    [verifier_id],
    (err, result) => {
      if (err || result.affectedRows === 0)
        return res.json({ success: false, message: "Delete failed" });
      res.json({ success: true });
    }
  );
});

// ================= ACTIVITY LOGS =================
router.get("/logs", (req, res) => {
  db.query(
    "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200",
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, logs: results });
    }
  );
});

// ================= REPORTS =================
router.get("/reports", (req, res) => {
  db.query(
    `SELECT r.*,
      u1.full_name as reporter_name, u1.email as reporter_email,
      u2.full_name as reported_name, u2.email as reported_email
     FROM reports r
     JOIN users u1 ON u1.id=r.reporter_id
     JOIN users u2 ON u2.id=r.reported_id
     ORDER BY r.created_at DESC`,
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, reports: results });
    }
  );
});

router.post("/reports/update", (req, res) => {
  const { report_id, status } = req.body;
  if (!["pending", "reviewed", "resolved"].includes(status))
    return res.json({ success: false, message: "Invalid status" });

  db.query(
    "UPDATE reports SET status=? WHERE id=?",
    [status, report_id],
    (err) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true });
    }
  );
});

// ================= DELETE USER =================
router.post("/users/delete", (req, res) => {
  const { user_id, admin_id, admin_name, admin_role } = req.body;
  if (!user_id) return res.json({ success: false, message: "User ID required" });

  db.query("SELECT full_name FROM users WHERE id=?", [user_id], (err, result) => {
    const userName = result && result[0] ? result[0].full_name : "Unknown";
    db.query("DELETE FROM users WHERE id=?", [user_id], (err) => {
      if (err) return res.json({ success: false, message: "DB error" });
      logActivity(admin_id, admin_name, admin_role, "Deleted user account", user_id, userName);
      res.json({ success: true, message: "User deleted" });
    });
  });
});

// ================= SUSPEND / UNSUSPEND USER =================
router.post("/users/suspend", (req, res) => {
  const { user_id, admin_id, admin_name, admin_role } = req.body;
  if (!user_id) return res.json({ success: false, message: "User ID required" });

  db.query("SELECT full_name, is_suspended FROM users WHERE id=?", [user_id], (err, result) => {
    if (err || result.length === 0)
      return res.json({ success: false, message: "User not found" });

    const userName = result[0].full_name || "Unknown";
    const newStatus = result[0].is_suspended ? 0 : 1;
    const action = newStatus ? "Suspended" : "Unsuspended";

    db.query("UPDATE users SET is_suspended=? WHERE id=?", [newStatus, user_id], (err2) => {
      if (err2) return res.json({ success: false, message: "DB error" });
      logActivity(admin_id, admin_name, admin_role, action + " user", user_id, userName);
      res.json({ success: true, suspended: newStatus, message: "User " + action.toLowerCase() + " successfully" });
    });
  });
});

// ================= INSTITUTE TOGGLE =================
router.post("/institutes/toggle", (req, res) => {
  const { institute_id } = req.body;
  if (!institute_id) return res.json({ success: false, message: "Institute ID required" });

  db.query(
    "UPDATE institutes SET is_enabled = NOT is_enabled WHERE id = ?",
    [institute_id],
    (err, result) => {
      if (err || result.affectedRows === 0)
        return res.json({ success: false, message: "Update failed" });
      res.json({ success: true });
    }
  );
});

// ================= COMPANIES =================
router.get("/companies", (req, res) => {
  db.query(
    "SELECT id,name,email,phone,website,industry,description,document_path,status,rejection_message,created_at FROM companies ORDER BY created_at DESC",
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, companies: results });
    }
  );
});

router.post("/companies/verify", (req, res) => {
  const { company_id, action, rejection_message, admin_id, admin_name, admin_role } = req.body;
  if (!["approved", "rejected"].includes(action))
    return res.json({ success: false, message: "Invalid action" });

  db.query("SELECT name FROM companies WHERE id=?", [company_id], (err, result) => {
    const companyName = result && result[0] ? result[0].name : "Unknown";
    db.query(
      "UPDATE companies SET status=?, rejection_message=? WHERE id=?",
      [action, rejection_message || null, company_id],
      (err, r) => {
        if (err || r.affectedRows === 0)
          return res.json({ success: false, message: "Update failed" });
        logActivity(admin_id, admin_name, admin_role, `Company ${action}: ${companyName}`, null, companyName);
        res.json({ success: true, message: `Company ${action}` });
      }
    );
  });
});

router.post("/companies/delete", (req, res) => {
  const { company_id, admin_id, admin_name, admin_role } = req.body;
  if (!company_id) return res.json({ success: false, message: "Company ID required" });

  db.query("SELECT name FROM companies WHERE id=?", [company_id], (err, result) => {
    const companyName = result && result[0] ? result[0].name : "Unknown";
    db.query("DELETE FROM companies WHERE id=?", [company_id], (err) => {
      if (err) return res.json({ success: false, message: "DB error" });
      logActivity(admin_id, admin_name, admin_role, "Deleted company", null, companyName);
      res.json({ success: true, message: "Company deleted" });
    });
  });
});
// ================= WARN USER =================
// Add this BEFORE module.exports in Backend/src/routes/admin.js

router.post("/users/warn", (req, res) => {
  const { user_id, warning_message, admin_id, admin_name, admin_role } = req.body;
  if (!user_id || !warning_message) return res.json({ success: false, message: "User ID and message required" });

  db.query("SELECT full_name, email FROM users WHERE id=?", [user_id], (err, result) => {
    if (err || result.length === 0) return res.json({ success: false, message: "User not found" });

    const userName = result[0].full_name || "User";
    const userEmail = result[0].email;

    db.query(
      "UPDATE users SET warning_message=?, warning_seen=0 WHERE id=?",
      [warning_message, user_id],
      (err2) => {
        if (err2) return res.json({ success: false, message: "DB error" });

        logActivity(admin_id, admin_name, admin_role, "Warned user: " + warning_message, user_id, userName);

        // Send warning email
        const { sendWarningEmail } = require("../lib/email");
        sendWarningEmail(userEmail, userName, warning_message).catch(e => console.error("Email error:", e));

        res.json({ success: true, message: "Warning sent to " + userName });
      }
    );
  });
});
// ================= EXPORT ================= 
module.exports = router;
