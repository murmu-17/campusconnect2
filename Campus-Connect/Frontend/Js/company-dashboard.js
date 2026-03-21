const BASE_URL = "http://43.205.171.240";

var company = JSON.parse(sessionStorage.getItem("company") || "null");
if (!company) { window.location.href = "company-login.html"; }

// Set company info
var initial = (company.name || "C").charAt(0).toUpperCase();
document.getElementById("companyTitle").textContent    = company.name;
document.getElementById("navAvatar").textContent       = initial;
document.getElementById("companyAvatarBig").textContent= initial;
document.getElementById("profileName").textContent     = company.name     || "—";
document.getElementById("profileIndustry").textContent = company.industry || "—";
document.getElementById("profileEmail").textContent    = company.email    || "—";

var websiteEl = document.getElementById("profileWebsite");
if (company.website) {
  websiteEl.innerHTML = '<a href="'+company.website+'" target="_blank" style="color:var(--gold);text-decoration:none;">'+company.website+'</a>';
} else {
  websiteEl.textContent = "—";
}

// Load everything
loadJobs();

// ── LOAD JOBS ──
async function loadJobs() {
  var list = document.getElementById("jobsList");
  list.innerHTML = '<div class="loading">⏳ Loading jobs...</div>';

  try {
    var res  = await fetch(BASE_URL + "/company/" + company.id + "/jobs");
    var data = await res.json();

    // Update stats
    document.getElementById("statJobs").textContent = data.jobs ? data.jobs.length : 0;

    if (!data.success || data.jobs.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">📋</div>
          <h3>No jobs posted yet</h3>
          <p>Click "+ Post New Job" to create your first listing</p>
        </div>`;
      document.getElementById("statApps").textContent    = 0;
      document.getElementById("statAccepted").textContent= 0;
      document.getElementById("statPending").textContent = 0;
      loadActivity([]);
      return;
    }

    // Load applicant counts for each job
    var jobsWithCounts = await loadApplicantCounts(data.jobs);
    renderJobsTable(jobsWithCounts);
    loadStats(jobsWithCounts);
    loadActivity(jobsWithCounts);

  } catch(e) {
    list.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><h3>Network error</h3><p>Is the server running?</p></div>';
  }
}

// ── LOAD APPLICANT COUNTS ──
async function loadApplicantCounts(jobs) {
  var results = await Promise.all(jobs.map(async function(job) {
    try {
      var res  = await fetch(BASE_URL + "/company/jobs/" + job.id + "/applicants");
      var data = await res.json();
      job.applicants     = data.success ? data.applicants : [];
      job.applicantCount = job.applicants.length;
    } catch(e) {
      job.applicants     = [];
      job.applicantCount = 0;
    }
    return job;
  }));
  return results;
}

// ── RENDER JOBS TABLE ──
function renderJobsTable(jobs) {
  var html = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Job Title</th>
          <th>Type</th>
          <th>Location</th>
          <th>Stipend</th>
          <th>Applicants</th>
          <th>Status</th>
          <th>Posted</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>`;

  jobs.forEach(function(job, i) {
    var date = new Date(job.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
    var badgeClass = job.status === "active" ? "badge-active" : "badge-closed";
    var typeLabel = { internship:"Internship", fulltime:"Full-time", parttime:"Part-time", contract:"Contract" }[job.type] || job.type;

    html += `<tr>
      <td>${i+1}</td>
      <td style="font-weight:700;">${job.title}</td>
      <td><span style="font-size:12px;">${typeLabel}</span></td>
      <td style="font-size:12px;">${job.location || "—"}</td>
      <td style="font-size:12px;">${job.stipend || "—"}</td>
      <td style="text-align:center;">
        <span class="app-count">${job.applicantCount}</span>
      </td>
      <td><span class="badge ${badgeClass}">${job.status}</span></td>
      <td style="font-size:12px;">${date}</td>
      <td>
        <button class="btn-sm btn-view" onclick="window.location.href='company-job-applicants.html?job_id=${job.id}&title=${encodeURIComponent(job.title)}'">👥 Applicants</button>
        <button class="btn-sm btn-delete" onclick="deleteJob(${job.id})">🗑 Delete</button>
      </td>
    </tr>`;
  });

  html += "</tbody></table>";
  document.getElementById("jobsList").innerHTML = html;
}

// ── LOAD STATS ──
function loadStats(jobs) {
  var totalApps    = 0;
  var totalAccepted= 0;
  var totalPending = 0;

  jobs.forEach(function(job) {
    totalApps += job.applicantCount;
    (job.applicants || []).forEach(function(a) {
      if (a.status === "accepted") totalAccepted++;
      if (a.status === "pending")  totalPending++;
    });
  });

  document.getElementById("statApps").textContent     = totalApps;
  document.getElementById("statAccepted").textContent = totalAccepted;
  document.getElementById("statPending").textContent  = totalPending;
}

// ── RECENT ACTIVITY ──
function loadActivity(jobs) {
  var activityEl = document.getElementById("activityList");
  var activities = [];

  jobs.forEach(function(job) {
    // Job posted
    activities.push({
      text:  "Posted job: <strong>" + job.title + "</strong>",
      time:  job.created_at,
      color: "#b37a0f"
    });
    // Applications
    (job.applicants || []).forEach(function(a) {
      if (a.status === "accepted") {
        activities.push({ text: "<strong>" + (a.full_name||"A student") + "</strong> accepted for <strong>" + job.title + "</strong>", time: a.created_at, color: "#2e7d32" });
      } else if (a.status === "rejected") {
        activities.push({ text: "<strong>" + (a.full_name||"A student") + "</strong> rejected for <strong>" + job.title + "</strong>", time: a.created_at, color: "#c62828" });
      } else {
        activities.push({ text: "<strong>" + (a.full_name||"A student") + "</strong> applied to <strong>" + job.title + "</strong>", time: a.created_at, color: "#1565c0" });
      }
    });
  });

  if (activities.length === 0) {
    activityEl.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="icon" style="font-size:28px;">📭</div><p>No activity yet</p></div>';
    return;
  }

  // Sort by time descending
  activities.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });

  var html = "";
  activities.slice(0, 8).forEach(function(act) {
    var time = timeAgo(act.time);
    html += `<div class="activity-item">
      <div class="activity-dot" style="background:${act.color};"></div>
      <div class="activity-text">${act.text}</div>
      <div class="activity-time">${time}</div>
    </div>`;
  });
  activityEl.innerHTML = html;
}

// ── DELETE JOB ──
async function deleteJob(jobId) {
  if (!confirm("Delete this job? All applications will also be removed.")) return;
  try {
    var res  = await fetch(BASE_URL + "/company/jobs/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, company_id: company.id })
    });
    var data = await res.json();
    if (data.success) { alert("Job deleted."); loadJobs(); }
    else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

// ── TIME AGO ──
function timeAgo(ts) {
  var diff = (new Date() - new Date(ts)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return Math.floor(diff/60) + "m ago";
  if (diff < 86400)return Math.floor(diff/3600) + "h ago";
  return Math.floor(diff/86400) + "d ago";
}