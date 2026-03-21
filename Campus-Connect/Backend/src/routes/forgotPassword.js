const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../db/connection");
const { sendPasswordResetOTP } = require("../lib/email");
const { generateOTP, setOTP, getOTP, markVerified, deleteOTP, isExpired } = require("../lib/otp");

const FP_PREFIX = "fp_";

// ================= SEND RESET OTP =================
router.post("/send-otp", async (req, res) => {
  const { email, resend } = req.body;
  if (!email) return res.json({ success: false, message: "Email is required" });

  db.query("SELECT id FROM users WHERE email = ?", [email], async (err, rows) => {
    if (!resend && (!rows || rows.length === 0))
      return res.json({ success: false, message: "No account found with this email" });

    const otp = generateOTP();
    setOTP(FP_PREFIX + email, otp);
    console.log(`>>> FORGOT PASSWORD OTP for ${email}: ${otp}`);

    try {
      await sendPasswordResetOTP(email, otp);
      res.json({ success: true, message: `OTP sent to ${email}` });
    } catch (e) {
      console.error("Email send failed:", e.message);
      res.json({ success: true, message: "OTP generated (check terminal)", dev_otp: otp });
    }
  });
});

// ================= VERIFY RESET OTP =================
router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.json({ success: false, message: "Missing fields" });

  const record = getOTP(FP_PREFIX + email);
  if (!record) return res.json({ success: false, message: "No OTP found. Please request a new one." });
  if (isExpired(record)) {
    deleteOTP(FP_PREFIX + email);
    return res.json({ success: false, message: "OTP expired. Please request a new one." });
  }
  if (record.otp !== otp.trim())
    return res.json({ success: false, message: "Incorrect OTP. Try again." });

  markVerified(FP_PREFIX + email);
  res.json({ success: true, message: "OTP verified!" });
});

// ================= RESET PASSWORD =================
router.post("/reset", async (req, res) => {
  const { email, new_password } = req.body;
  if (!email || !new_password)
    return res.json({ success: false, message: "Missing fields" });
  if (new_password.length < 8)
    return res.json({ success: false, message: "Password must be at least 8 characters" });

  const record = getOTP(FP_PREFIX + email);
  if (!record || !record.verified)
    return res.json({ success: false, message: "Please verify your OTP first" });

  try {
    const hash = await bcrypt.hash(new_password, 10);
    db.query(
      "UPDATE users SET password = ? WHERE email = ?",
      [hash, email],
      (err, result) => {
        if (err) return res.json({ success: false, message: "DB error" });
        if (result.affectedRows === 0)
          return res.json({ success: false, message: "Email not found" });
        deleteOTP(FP_PREFIX + email);
        res.json({ success: true, message: "Password updated successfully!" });
      }
    );
  } catch (e) {
    res.json({ success: false, message: "Server error" });
  }
});

module.exports = router;
