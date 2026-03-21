const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db/connection");

const router = express.Router();

// Small helper: create a default subscription for demo/MVP.
function createDemoSubscription(company_id, included_shortlists = 30) {
  // 6 months from now (MySQL handles DATE_ADD)
  const sql =
    "INSERT INTO company_subscriptions (company_id, plan_name, end_at, included_shortlists, extra_shortlists, status) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 6 MONTH),?,?,?)";
  const params = [company_id, "six_months", included_shortlists, 0, "active"];
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result && result.insertId ? result.insertId : null);
    });
  });
}

// ================= COMPANY SIGNUP =================
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, phone, website } = req.body || {};
    if (!name || !email || !password) {
      return res.json({ success: false, message: "name, email, password required" });
    }
    if (password.length < 8) {
      return res.json({ success: false, message: "Password min 8 chars" });
    }

    const hash = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO companies (name,email,phone,website,password) VALUES (?,?,?,?,?)",
      [name, email, phone || null, website || null, hash],
      async (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.json({ success: false, message: "Email already registered" });
          }
          return res.json({ success: false, message: "DB error: " + err.message });
        }

        const company_id = result && result.insertId ? result.insertId : null;
        try {
          const subId = await createDemoSubscription(company_id, 30);
          res.json({
            success: true,
            company: { id: company_id, name, email },
            subscription_id: subId,
          });
        } catch (subErr) {
          res.json({ success: false, message: "Subscription creation failed: " + subErr.message });
        }
      }
    );
  } catch (e) {
    res.json({ success: false, message: "Server error" });
  }
});

// ================= COMPANY LOGIN =================
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.json({ success: false, message: "Email and password required" });

  db.query("SELECT * FROM companies WHERE email=? AND is_active=1", [email], async (err, result) => {
    if (err) return res.json({ success: false, message: "DB error: " + err.message });
    if (!result || result.length === 0) return res.json({ success: false, message: "Invalid credentials" });

    const company = result[0];
    const valid = await bcrypt.compare(password, company.password);
    if (!valid) return res.json({ success: false, message: "Invalid credentials" });

    // Return active subscription (if any)
    db.query(
      "SELECT * FROM company_subscriptions WHERE company_id=? AND status='active' AND end_at>=NOW() ORDER BY end_at DESC LIMIT 1",
      [company.id],
      (subErr, subRes) => {
        if (subErr) {
          return res.json({ success: false, message: "DB error: " + subErr.message });
        }
        const sub = subRes && subRes.length ? subRes[0] : null;
        res.json({
          success: true,
          company: {
            id: company.id,
            name: company.name,
            email: company.email,
            phone: company.phone || null,
            website: company.website || null,
            verification_status: company.verification_status,
          },
          subscription: sub,
        });
      }
    );
  });
});

module.exports = router;

