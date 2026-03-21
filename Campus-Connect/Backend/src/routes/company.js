const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcrypt");
const fs      = require("fs");
const db      = require("../db/connection");
const { upload, uploadJobDoc } = require("../lib/upload");

// ================= COMPANY REGISTER =================
router.post("/register", (req, res) => {
  upload.single("document")(req, res, async (uploadErr) => {
    if (uploadErr) return res.json({ success: false, message: uploadErr.message });
    const { name, email, phone, website, password, description, industry, cin, pan, address } = req.body;
    const docFile = req.file;
    if (!name || !email || !password) {
      if (docFile) fs.unlinkSync(docFile.path);
      return res.json({ success: false, message: "Name, email and password are required" });
    }
    if (password.length < 8) {
      if (docFile) fs.unlinkSync(docFile.path);
      return res.json({ success: false, message: "Password must be at least 8 characters" });
    }
    if (!docFile) return res.json({ success: false, message: "Verification document is required" });
    try {
      const hash = await bcrypt.hash(password, 10);
      db.query(
        "INSERT INTO companies (name,email,phone,website,password,description,industry,cin,pan,address,document_path,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [name, email||null, phone||null, website||null, hash, description||null, industry||null, cin||null, pan||null, address||null, "uploads/"+docFile.filename, "pending"],
        (err) => {
          if (err) {
            if (docFile) fs.unlinkSync(docFile.path);
            if (err.code === "ER_DUP_ENTRY") return res.json({ success: false, message: "Email already registered" });
            return res.json({ success: false, message: "DB error: " + err.message });
          }
          res.json({ success: true, message: "Registration submitted. Await admin approval." });
        }
      );
    } catch(e) {
      if (docFile) fs.unlinkSync(docFile.path);
      res.json({ success: false, message: "Server error" });
    }
  });
});

// ================= COMPANY LOGIN =================
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ success: false, message: "All fields required" });
  db.query("SELECT * FROM companies WHERE email=?", [email], async (err, result) => {
    if (err || result.length === 0) return res.json({ success: false, message: "Invalid credentials" });
    const company = result[0];
    const valid = await bcrypt.compare(password, company.password);
    if (!valid) return res.json({ success: false, message: "Invalid credentials" });
    var companyStatus = company.status || company.verification_status;
    if (companyStatus === "pending")
      return res.json({ success: false, message: "Your registration is under review.", status: "pending" });
    if (companyStatus === "rejected")
      return res.json({ success: false, message: "Your registration was rejected.", status: "rejected" });
    res.json({
      success: true, message: "Login successful",
      company: { id: company.id, name: company.name, email: company.email, website: company.website, industry: company.industry, status: companyStatus }
    });
  });
});

// ================= GET COMPANY JOBS =================
router.get("/:company_id/jobs", (req, res) => {
  db.query("SELECT * FROM jobs WHERE company_id=? ORDER BY created_at DESC", [req.params.company_id], (err, results) => {
    if (err) return res.json({ success: false, message: "DB error" });
    res.json({ success: true, jobs: results });
  });
});

// ================= CREATE JOB (with optional PDF) =================
router.post("/jobs/create", (req, res) => {
  uploadJobDoc.single("job_pdf")(req, res, function(uploadErr) {
    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return res.json({ success: false, message: uploadErr.message });
    }

    // req.body is now available after multer runs
    console.log("req.body:", req.body);
    console.log("req.file:", req.file);

    if (!req.body) {
      return res.json({ success: false, message: "Request body is empty" });
    }

    const company_id    = req.body.company_id;
    const title         = req.body.title;
    const type          = req.body.type          || "internship";
    const location      = req.body.location      || null;
    const stipend       = req.body.stipend        || null;
    const duration      = req.body.duration       || null;
    const apply_link    = req.body.apply_link     || null;
    const description   = req.body.description;
    const min_cgpa      = parseFloat(req.body.min_cgpa) || 0;
    const max_backlogs  = parseInt(req.body.max_backlogs) || 0;
    const pdfFile       = req.file;

    if (!company_id || !title || !description) {
      if (pdfFile) fs.unlinkSync(pdfFile.path);
      return res.json({ success: false, message: "Company ID, title and description required" });
    }

    // Parse JSON arrays
    var branchesStr = null, degreesStr = null, batchesStr = null;
    try {
      var branches = req.body.allowed_branches ? JSON.parse(req.body.allowed_branches) : [];
      var degrees  = req.body.allowed_degrees  ? JSON.parse(req.body.allowed_degrees)  : [];
      var batches  = req.body.eligible_batches ? JSON.parse(req.body.eligible_batches) : [];
      if (branches.length > 0) branchesStr = JSON.stringify(branches);
      if (degrees.length  > 0) degreesStr  = JSON.stringify(degrees);
      if (batches.length  > 0) batchesStr  = JSON.stringify(batches);
    } catch(e) { console.error("JSON parse error:", e); }

    var pdfPath = pdfFile ? "uploads/" + pdfFile.filename : null;

    db.query(
      "INSERT INTO jobs (company_id,title,type,location,stipend,duration,apply_link,description,status,min_cgpa,allowed_branches,allowed_degrees,max_backlogs,eligible_batches,pdf_path) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [company_id, title, type, location, stipend, duration, apply_link, description, "active",
       min_cgpa, branchesStr, degreesStr, max_backlogs, batchesStr, pdfPath],
      (err, result) => {
        if (err) {
          if (pdfFile) fs.unlinkSync(pdfFile.path);
          console.error("DB error:", err);
          return res.json({ success: false, message: "DB error: " + err.message });
        }
        res.json({ success: true, message: "Job posted successfully!", job_id: result.insertId });
      }
    );
  });
});

// ================= DELETE JOB =================
router.post("/jobs/delete", (req, res) => {
  const { job_id, company_id } = req.body;
  db.query("SELECT pdf_path FROM jobs WHERE id=? AND company_id=?", [job_id, company_id], (err, result) => {
    if (result && result[0] && result[0].pdf_path) {
      try { fs.unlinkSync(result[0].pdf_path); } catch(e) {}
    }
    db.query("DELETE FROM jobs WHERE id=? AND company_id=?", [job_id, company_id], (err, res2) => {
      if (err || res2.affectedRows === 0) return res.json({ success: false, message: "Delete failed" });
      res.json({ success: true, message: "Job deleted" });
    });
  });
});

// ================= EXPORT AS EXCEL (must be BEFORE /:job_id/applicants) =================
router.get("/jobs/:job_id/applicants/export", (req, res) => {
  const { job_id } = req.params;
  db.query(
    `SELECT u.full_name, u.email, u.institute, u.batch, u.degree, u.branch,
            u.cgpa, u.backlogs, a.cover_letter, a.status, a.created_at
     FROM applications a JOIN users u ON u.id = a.student_id
     WHERE a.job_id=? ORDER BY a.created_at DESC`,
    [job_id],
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error: " + err.message });
      if (results.length === 0) return res.json({ success: false, message: "No applicants found" });
      try {
        const XLSX = require("xlsx");
        var data = results.map(function(r) {
          return {
            "Name":         r.full_name    || "",
            "Email":        r.email        || "",
            "Institute":    r.institute    || "",
            "Batch":        r.batch        || "",
            "Degree":       r.degree       || "",
            "Branch":       r.branch       || "",
            "CGPA":         r.cgpa         || "",
            "Backlogs":     r.backlogs     || 0,
            "Cover Letter": r.cover_letter || "",
            "Status":       r.status       || "",
            "Applied On":   new Date(r.created_at).toLocaleDateString("en-IN")
          };
        });
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(data);
        ws["!cols"] = [{wch:22},{wch:30},{wch:20},{wch:8},{wch:14},{wch:32},{wch:8},{wch:10},{wch:45},{wch:12},{wch:14}];
        XLSX.utils.book_append_sheet(wb, ws, "Applicants");
        var buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="applicants-job-${job_id}.xlsx"`);
        res.send(buf);
      } catch(e) {
        res.json({ success: false, message: "xlsx package missing. Run: npm install xlsx" });
      }
    }
  );
});

// ================= GET JOB APPLICANTS =================
router.get("/jobs/:job_id/applicants", (req, res) => {
  db.query(
    `SELECT a.*, u.full_name, u.email, u.institute, u.batch, u.degree, u.branch, u.cgpa, u.backlogs
     FROM applications a JOIN users u ON u.id = a.student_id
     WHERE a.job_id=? ORDER BY a.created_at DESC`,
    [req.params.job_id],
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error: " + err.message });
      res.json({ success: true, applicants: results });
    }
  );
});

// ================= UPDATE APPLICATION STATUS + EMAIL =================
router.post("/applications/update", (req, res) => {
  const { application_id, status } = req.body;
  if (!["pending","accepted","rejected"].includes(status))
    return res.json({ success: false, message: "Invalid status" });
  db.query(
    `SELECT a.*, u.email as student_email, u.full_name,
            j.title as job_title, c.name as company_name
     FROM applications a
     JOIN users u ON u.id = a.student_id
     JOIN jobs j ON j.id = a.job_id
     JOIN companies c ON c.id = j.company_id
     WHERE a.id=?`,
    [application_id],
    (err, result) => {
      if (err || !result.length) return res.json({ success: false, message: "Application not found" });
      const app = result[0];
      db.query("UPDATE applications SET status=? WHERE id=?", [status, application_id], (err) => {
        if (err) return res.json({ success: false, message: "DB error" });
        try {
          const nodemailer = require("nodemailer");
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
          });
          const emailHtml = status === "accepted"
            ? `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;background:#f9f5ef;border-radius:16px;"><h2 style="color:#2e7d32;">🎉 Congratulations, ${app.full_name}!</h2><p>Your application for <strong>${app.job_title}</strong> at <strong>${app.company_name}</strong> has been <span style="color:#2e7d32;font-weight:700;">ACCEPTED</span>!</p><p style="margin-top:16px;">The company will reach out to you soon.</p><p style="color:#8b7d6b;font-size:12px;margin-top:24px;">— Campus Connect Team</p></div>`
            : `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;background:#f9f5ef;border-radius:16px;"><h2 style="color:#c62828;">Application Update</h2><p>Dear <strong>${app.full_name}</strong>,</p><p>Your application for <strong>${app.job_title}</strong> at <strong>${app.company_name}</strong> was not selected this time.</p><p style="margin-top:16px;">Keep applying!</p><p style="color:#8b7d6b;font-size:12px;margin-top:24px;">— Campus Connect Team</p></div>`;
          transporter.sendMail({
            from: `"Campus Connect" <${process.env.EMAIL_USER}>`,
            to: app.student_email,
            subject: status === "accepted" ? `🎉 Accepted — ${app.job_title}` : `Application Update — ${app.job_title}`,
            html: emailHtml
          }).catch(e => console.error("Email error:", e.message));
        } catch(e) { console.error("Email setup error:", e.message); }
        res.json({ success: true, message: `Application ${status}` });
      });
    }
  );
});

module.exports = router;
