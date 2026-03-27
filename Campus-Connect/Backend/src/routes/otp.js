const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const { sendEmailOTP } = require("../lib/email");
const { generateOTP, setOTP, getOTP, markVerified, deleteOTP, isExpired } = require("../lib/otp");
const { isValidInstituteEmail } = require("../lib/helpers");
const { EMAIL_REGEX } = require("../config/constants");

// ================= SEND OTP (General signup) =================
router.post("/send", (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false, message: "Email is required" });
  if (!EMAIL_REGEX.test(email))
    return res.json({ success: false, message: "Please enter a valid email address (e.g. name@domain.com)" });

  db.query("SELECT id FROM users WHERE email = ?", [email], async (err, rows) => {
    if (rows && rows.length > 0)
      return res.json({ success: false, message: "This email is already registered" });

    const otp = generateOTP();
    setOTP(email, otp);
    console.log(`>>> OTP for ${email}: ${otp}`);

    try {
      await sendEmailOTP(email, otp);
      res.json({ success: true, message: `OTP sent to ${email}` });
    } catch (e) {
      console.error("Email send failed:", e.message);
      res.json({ success: true, message: "OTP generated (check terminal)", dev_otp: otp });
    }
  });
});

// ================= SEND OTP (Institute/verified signup) =================
router.post("/send-institute", (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false, message: "Email is required" });
  if (!EMAIL_REGEX.test(email))
    return res.json({ success: false, message: "Please enter a valid email address" });
  if (!isValidInstituteEmail(email))
    return res.json({ success: false, message: "Email domain not recognized. Use your official institute email (e.g. b22000@students.iitmandi.ac.in)" });

  db.query("SELECT id FROM users WHERE email = ?", [email], async (err, rows) => {
    if (rows && rows.length > 0)
      return res.json({ success: false, message: "This email is already registered" });

    const otp = generateOTP();
    setOTP(email, otp);
    console.log(`>>> Institute OTP for ${email}: ${otp}`);

    try {
      await sendEmailOTP(email, otp);
      res.json({ success: true, message: `OTP sent to ${email}` });
    } catch (e) {
      console.error("Email send failed:", e.message);
      res.json({ success: true, message: "OTP generated (check terminal)", dev_otp: otp });
    }
  });
});

// ================= VERIFY OTP =================
router.post("/verify", (req, res) => {
  const { target, otp } = req.body;
  if (!target || !otp) return res.json({ success: false, message: "Missing fields" });

  const record = getOTP(target);
  if (!record) return res.json({ success: false, message: "No OTP found. Please request a new one." });
  if (isExpired(record)) {
    deleteOTP(target);
    return res.json({ success: false, message: "OTP expired. Please request a new one." });
  }
  if (record.otp !== otp.trim())
    return res.json({ success: false, message: "Incorrect OTP. Try again." });

  markVerified(target);
  res.json({ success: true, message: "Email verified successfully!" });
});

module.exports = router;
