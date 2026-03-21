const BASE_URL = "http://localhost:5001";

var user = JSON.parse(sessionStorage.getItem("user") || "null");
if (!user) { window.location.href = "login.html"; }

if (user.account_type !== "verified" || user.verification_status !== "approved") {
  document.getElementById("content").innerHTML = `
    <div class="empty-state" style="grid-column:1/-1;">
      <div class="icon">🔒</div>
      <h3>Verified Students Only</h3>
      <p>Only verified and approved students can view opportunities.</p>
    </div>`;
} else {
  loadJobs();
}

async function loadJobs() {
  var grid = document.getElementById("content");
  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;">⏳ Loading opportunities...</div>';

  try {
    var res  = await fetch(BASE_URL + "/jobs");
    var data = await res.json();

    if (!data.success || data.jobs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="icon">💼</div>
          <h3>No opportunities yet</h3>
          <p>Check back soon — companies are joining Campus Connect!</p>
        </div>`;
      return;
    }

    var html = "";
    data.jobs.forEach(function(job) {
      var typeLabel = { internship:"Internship", fulltime:"Full-time", parttime:"Part-time", contract:"Contract" }[job.type] || job.type;
      var desc = job.description ? job.description.substring(0, 120) + (job.description.length > 120 ? "..." : "") : "";

      // Parse eligibility
      var branches = job.allowed_branches ? JSON.parse(job.allowed_branches) : [];
      var degrees  = job.allowed_degrees  ? JSON.parse(job.allowed_degrees)  : [];
      var batches  = job.eligible_batches ? JSON.parse(job.eligible_batches) : [];

      // Check eligibility
      var eligible = true;
      var reasons  = [];

      if (job.min_cgpa > 0 && user.cgpa && parseFloat(user.cgpa) < job.min_cgpa) {
        eligible = false; reasons.push("Min CGPA: " + job.min_cgpa);
      }
      if (job.max_backlogs !== null && user.backlogs > job.max_backlogs) {
        eligible = false; reasons.push("Max backlogs: " + job.max_backlogs);
      }
      if (branches.length > 0 && user.branch && !branches.includes(user.branch)) {
        eligible = false; reasons.push("Branch not eligible");
      }
      if (degrees.length > 0 && user.degree && !degrees.includes(user.degree)) {
        eligible = false; reasons.push("Degree not eligible");
      }
      if (batches.length > 0 && user.batch && !batches.includes(String(user.batch))) {
        eligible = false; reasons.push("Batch not eligible");
      }

      // Eligibility tags
      var eligibilityHtml = "";
      if (job.min_cgpa > 0)    eligibilityHtml += '<span class="tag eligibility">📊 CGPA ≥ ' + job.min_cgpa + '</span>';
      if (job.max_backlogs === 0) eligibilityHtml += '<span class="tag eligibility">✅ No backlogs</span>';
      else if (job.max_backlogs > 0) eligibilityHtml += '<span class="tag eligibility">📋 Max ' + job.max_backlogs + ' backlogs</span>';
      if (branches.length > 0) eligibilityHtml += '<span class="tag eligibility">🎓 ' + branches.slice(0,2).join(", ") + (branches.length > 2 ? "..." : "") + '</span>';
      if (degrees.length > 0)  eligibilityHtml += '<span class="tag eligibility">📜 ' + degrees.join(", ") + '</span>';
      if (batches.length > 0)  eligibilityHtml += '<span class="tag eligibility">📅 Batch ' + batches.join(", ") + '</span>';

      html += `
        <div class="job-card ${!eligible ? 'not-eligible' : ''}">
          ${!eligible ? `<div class="not-eligible-banner">⚠️ You may not meet: ${reasons.join(", ")}</div>` : ""}
          <div class="job-company">🏢 ${job.company_name || "Company"}</div>
          <div class="job-title">${job.title}</div>
          <div class="job-tags">
            <span class="tag type">${typeLabel}</span>
            ${job.location ? '<span class="tag location">📍 ' + job.location + '</span>' : ""}
            ${job.stipend  ? '<span class="tag stipend">💰 ' + job.stipend  + '</span>' : ""}
            ${job.duration ? '<span class="tag">⏱ '  + job.duration + '</span>'  : ""}
          </div>
          ${eligibilityHtml ? '<div class="job-tags" style="margin-top:6px;">' + eligibilityHtml + '</div>' : ""}
          <div class="job-desc">${desc}</div>
          <div class="job-actions">
            <button class="btn-apply" onclick="window.location.href='student-apply.html?job_id=${job.id}'">
              ${eligible ? "Apply Now →" : "Apply Anyway →"}
            </button>
          </div>
        </div>`;
    });

    grid.innerHTML = html;

  } catch(e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">⚠️</div><h3>Network error</h3><p>Is the server running on port 5001?</p></div>`;
  }
}
