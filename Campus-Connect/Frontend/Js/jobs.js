const express = require("express");
const router  = express.Router();
const db      = require("../db/connection");
const { upload } = require("../lib/upload");
const fs = require("fs");

// ================= GET ALL ACTIVE JOBS =================
router.get("/", (req, res) => {
  db.query(
    `SELECT j.*, c.name as company_name, c.website as company_website, c.industry
     FROM jobs j JOIN companies c ON c.id = j.company_id
     WHERE j.status='active' AND c.status='approved'
     ORDER BY j.created_at DESC`,
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, jobs: results });
    }
  );
});

// ================= GET SINGLE JOB =================
router.get("/:job_id", (req, res) => {
  const { job_id } = req.params;
  if (job_id === "apply") return; // skip if it's the apply route
  db.query(
    `SELECT j.*, c.name as company_name, c.website as company_website, c.industry
     FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id=?`,
    [job_id],
    (err, results) => {
      if (err || results.length === 0) return res.json({ success: false, message: "Job not found" });
      res.json({ success: true, job: results[0] });
    }
  );
});

// ================= GET MY APPLICATIONS (student) =================
router.get("/my-applications/:student_id", (req, res) => {
  db.query(
    `SELECT a.id, a.status, a.created_at,
            j.title, j.type, j.location, j.stipend,
            c.name as company_name
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN companies c ON c.id = j.company_id
     WHERE a.student_id=?
     ORDER BY a.created_at DESC`,
    [req.params.student_id],
    (err, results) => {
      if (err) return res.json({ success: false, message: "DB error" });
      res.json({ success: true, applications: results });
    }
  );
});

// ================= APPLY TO JOB =================
router.post("/apply", (req, res) => {
  upload.single("resume")(req, res, (uploadErr) => {
    if (uploadErr) return res.json({ success: false, message: uploadErr.message });
    const { job_id, student_id, cover_letter } = req.body;
    const resumeFile = req.file;
    if (!job_id || !student_id) return res.json({ success: false, message: "Missing required fields" });

    db.query("SELECT id FROM applications WHERE job_id=? AND student_id=?", [job_id, student_id], (err, existing) => {
      if (existing && existing.length > 0) {
        if (resumeFile) fs.unlinkSync(resumeFile.path);
        return res.json({ success: false, message: "You have already applied to this job" });
      }
      db.query(
        "INSERT INTO applications (job_id,student_id,cover_letter,resume_path,status) VALUES (?,?,?,?,?)",
        [job_id, student_id, cover_letter||null, resumeFile ? "uploads/"+resumeFile.filename : null, "pending"],
        (err) => {
          if (err) {
            if (resumeFile) fs.unlinkSync(resumeFile.path);
            return res.json({ success: false, message: "DB error: " + err.message });
          }
          res.json({ success: true, message: "Application submitted successfully!" });
        }
      );
    });
  });
});

// ================= CHECK IF ALREADY APPLIED =================
router.get("/:job_id/applied/:student_id", (req, res) => {
  const { job_id, student_id } = req.params;
  db.query("SELECT id, status FROM applications WHERE job_id=? AND student_id=?", [job_id, student_id], (err, results) => {
    if (err) return res.json({ success: false });
    res.json({ success: true, applied: results.length > 0, status: results[0]?.status || null });
  });
});

module.exports = router;
