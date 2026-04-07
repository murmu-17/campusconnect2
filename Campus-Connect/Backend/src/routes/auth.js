const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const fs = require("fs");
const db = require("../db/connection");
const { upload } = require("../lib/upload");
const { getOTP, deleteOTP } = require("../lib/otp");
const { isValidInstituteEmail, logActivity, hasUserSubtypeColumn } = require("../lib/helpers");
const { EMAIL_REGEX } = require("../config/constants");

// ================= GENERAL SIGNUP =================
router.post("/signup", async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  if (!password || (!email && !phone))
    return res.json({ success: false, message: "Email and password required" });
  if (password.length < 8)
    return res.json({ success: false, message: "Password must be at least 8 characters" });

  if (email) {
    const record = getOTP(email);
    if (!record || !record.verified)
      return res.json({ success: false, message: "Please verify your email OTP first" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (full_name,email,phone,password,account_type,verification_status) VALUES (?,?,?,?,?,?)",
      [full_name || null, email || null, phone || null, hash, "general", "approved"],
      (err) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY")
            return res.json({ success: false, message: "Email already registered" });
          return res.json({ success: false, message: "Server error" });
        }
        if (email) deleteOTP(email);
        res.json({ success: true, message: "Account created successfully!" });
      }
    );
  } catch (e) {
    res.json({ success: false, message: "Server error" });
  }
});

// ================= VERIFIED SIGNUP =================
router.post("/verified-signup", (req, res) => {
  upload.single("document")(req, res, async (uploadErr) => {
    if (uploadErr) return res.json({ success: false, message: uploadErr.message });

    const { full_name, email, password, institute, batch, degree, branch, phone } = req.body;
    const userSubtype = req.body.user_subtype === "alumni" ? "alumni" : "student";
    const docFile = req.file;

    if (!full_name || !email || !password || !institute || !batch || !degree || !branch) {
      if (docFile) fs.unlinkSync(docFile.path);
      return res.json({ success: false, message: "All required fields must be filled" });
    }
    if (!docFile) return res.json({ success: false, message: "Verification document required" });
    if (password.length < 8) {
      fs.unlinkSync(docFile.path);
      return res.json({ success: false, message: "Password must be at least 8 characters" });
    }
    if (!EMAIL_REGEX.test(email)) {
      fs.unlinkSync(docFile.path);
      return res.json({ success: false, message: "Invalid email address" });
    }
    if (userSubtype === "student" && !isValidInstituteEmail(email)) {
      fs.unlinkSync(docFile.path);
      return res.json({ success: false, message: "Email domain not recognized. Use your official institute email (e.g. b22000@students.iitmandi.ac.in)" });
    }

    const record = getOTP(email);
    if (!record || !record.verified) {
      fs.unlinkSync(docFile.path);
      return res.json({ success: false, message: userSubtype === "student" ? "Please verify your institute email OTP first" : "Please verify your email OTP first" });
    }

    try {
      const hash = await bcrypt.hash(password, 10);
      hasUserSubtypeColumn((hasSubtypeColumn) => {
        const query = hasSubtypeColumn
          ? "INSERT INTO users (full_name,email,phone,password,account_type,user_subtype,institute,batch,degree,branch,document_path,verification_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
          : "INSERT INTO users (full_name,email,phone,password,account_type,institute,batch,degree,branch,document_path,verification_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)";
        const params = hasSubtypeColumn
          ? [full_name, email, phone || null, hash, "verified", userSubtype, institute, parseInt(batch), degree, branch, "uploads/" + docFile.filename, "pending"]
          : [full_name, email, phone || null, hash, "verified", institute, parseInt(batch), degree, branch, "uploads/" + docFile.filename, "pending"];

        db.query(query, params, (err) => {
          if (err) {
            if (err.code === "ER_DUP_ENTRY") {
              fs.unlinkSync(docFile.path);
              return res.json({ success: false, message: "Email already registered" });
            }
            return res.json({ success: false, message: "DB error: " + err.message });
          }
          deleteOTP(email);
          res.json({ success: true, message: "Verification submitted. Await admin approval." });
        });
      });
    } catch (e) {
      fs.unlinkSync(docFile.path);
      res.json({ success: false, message: "Server error" });
    }
  });
});

// ================= USER LOGIN =================
router.post("/login", (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.json({ success: false, message: "All fields required" });

  db.query(
    "SELECT * FROM users WHERE email=? OR phone=?",
    [identifier, identifier],
    async (err, result) => {
      if (err || result.length === 0)
        return res.json({ success: false, message: "Invalid credentials" });

      const user = result[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.json({ success: false, message: "Invalid credentials" });

      // ── SUSPENDED CHECK ──
      if (user.is_suspended === 1)
        return res.json({ success: false, message: "Your account has been suspended. Contact support@campusconnect.in" });

      if (user.verification_status === "rejected")
        return res.json({ success: false, message: "Account rejected. Contact support." });

      res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          account_type: user.account_type,
          user_subtype: user.user_subtype,
          institute: user.institute,
          batch: user.batch,
          degree: user.degree,
          branch: user.branch,
          verification_status: user.verification_status,
          disparity_message: user.disparity_message,
        },
      });
    }
  );
});

// ================= ADMIN LOGIN =================
router.post("/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.json({ success: false, message: "All fields required" });

  db.query(
    "SELECT * FROM admins WHERE email=? AND is_active=1",
    [email],
    async (err, result) => {
      if (err || result.length === 0)
        return res.json({ success: false, message: "Invalid credentials" });

      const admin = result[0];
      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) return res.json({ success: false, message: "Invalid credentials" });

      logActivity(admin.id, admin.name, admin.role, "Logged in", null, null);
      res.json({
        success: true,
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
      });
    }
  );
});

module.exports = router;
