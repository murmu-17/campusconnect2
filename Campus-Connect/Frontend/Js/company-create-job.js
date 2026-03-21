const BASE_URL = "http://43.205.171.240";

var company = JSON.parse(sessionStorage.getItem("company") || "null");
if (!company) { window.location.href = "company-login.html"; }

async function createJob() {
  var title       = document.getElementById("jobTitle").value.trim();
  var type        = document.getElementById("jobType").value;
  var location    = document.getElementById("jobLocation").value.trim();
  var stipend     = document.getElementById("jobStipend").value.trim();
  var duration    = document.getElementById("jobDuration").value.trim();
  var applyLink   = document.getElementById("jobApplyLink").value.trim();
  var description = document.getElementById("jobDescription").value.trim();
  var minCGPA     = parseFloat(document.getElementById("minCGPA").value) || 0;
  var maxBacklogs = parseInt(document.getElementById("maxBacklogs").value) || 0;
  var batchesRaw  = document.getElementById("eligibleBatches").value.trim();
  var pdfFile     = document.getElementById("jobPdf").files[0];

  var statusMsg = document.getElementById("statusMsg");
  var btn       = document.getElementById("submitBtn");

  statusMsg.style.display = "none";

  if (!title) {
    showMsg(statusMsg, "Job title is required.", "error"); return;
  }
  if (!description) {
    showMsg(statusMsg, "Job description is required.", "error"); return;
  }

  // Get checked degrees
  var allowedDegrees = [];
  document.querySelectorAll("#degreesGrid input:checked").forEach(function(cb) {
    allowedDegrees.push(cb.value);
  });

  // Get checked branches
  var allowedBranches = [];
  document.querySelectorAll("#branchesGrid input:checked").forEach(function(cb) {
    allowedBranches.push(cb.value);
  });

  // Parse batches
  var eligibleBatches = [];
  if (batchesRaw) {
    eligibleBatches = batchesRaw.split(",").map(function(b){ return b.trim(); }).filter(Boolean);
  }

  btn.disabled    = true;
  btn.textContent = "Posting...";

  try {
    // Use FormData to support PDF upload
    var formData = new FormData();
    formData.append("company_id",       company.id);
    formData.append("title",            title);
    formData.append("type",             type);
    formData.append("location",         location);
    formData.append("stipend",          stipend);
    formData.append("duration",         duration);
    formData.append("apply_link",       applyLink);
    formData.append("description",      description);
    formData.append("min_cgpa",         minCGPA);
    formData.append("max_backlogs",     maxBacklogs);
    formData.append("allowed_degrees",  JSON.stringify(allowedDegrees.length  > 0 ? allowedDegrees  : []));
    formData.append("allowed_branches", JSON.stringify(allowedBranches.length > 0 ? allowedBranches : []));
    formData.append("eligible_batches", JSON.stringify(eligibleBatches.length > 0 ? eligibleBatches : []));
    if (pdfFile) formData.append("job_pdf", pdfFile);

    var res  = await fetch(BASE_URL + "/company/jobs/create", {
      method: "POST",
      body: formData   // no Content-Type header — browser sets it with boundary
    });
    var data = await res.json();

    if (data.success) {
      showMsg(statusMsg, "✅ Job posted successfully! Redirecting to dashboard...", "success");
      btn.textContent = "✅ Posted!";
      setTimeout(function(){ window.location.href = "company-dashboard.html"; }, 1500);
    } else {
      showMsg(statusMsg, data.message || "Something went wrong.", "error");
      btn.disabled    = false;
      btn.textContent = "🚀 Post Job";
    }
  } catch(e) {
    showMsg(statusMsg, "Network error. Is the server running on port 5001?", "error");
    btn.disabled    = false;
    btn.textContent = "🚀 Post Job";
  }
}

function showMsg(el, msg, type) {
  el.textContent      = msg;
  el.style.display    = "block";
  el.style.background = type === "success" ? "#e8f5e9" : "#ffebee";
  el.style.color      = type === "success" ? "#2e7d32" : "#c62828";
}
