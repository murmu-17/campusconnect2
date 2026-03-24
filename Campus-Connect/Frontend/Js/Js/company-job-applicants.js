const BASE_URL = "https://conncam.in";

var company = JSON.parse(sessionStorage.getItem("company") || "null");
if (!company) { window.location.href = "company-login.html"; }

var params   = new URLSearchParams(window.location.search);
var jobId    = params.get("job_id");
var jobTitle = decodeURIComponent(params.get("title") || "Job");

if (!jobId) { window.location.href = "company-dashboard.html"; }

document.getElementById("jobTitle").textContent     = jobTitle;
document.getElementById("jobTitleMeta").textContent = "Showing all applicants for: " + jobTitle;

loadApplicants();

async function loadApplicants() {
  var list = document.getElementById("applicantsList");
  list.innerHTML = '<div class="loading">⏳ Loading applicants...</div>';

  try {
    var res  = await fetch(BASE_URL + "/company/jobs/" + jobId + "/applicants");
    var data = await res.json();

    if (!data.success || data.applicants.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">👥</div>
          <h3>No applicants yet</h3>
          <p>Share the job listing to attract candidates</p>
        </div>`;
      document.getElementById("applicantCount").textContent = "0 applicants";
      return;
    }

    document.getElementById("applicantCount").textContent =
      data.applicants.length + " applicant" + (data.applicants.length > 1 ? "s" : "");

    var html = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Student</th>
            <th>Institute</th>
            <th>Batch / Degree</th>
            <th>Branch</th>
            <th>CGPA</th>
            <th>Backlogs</th>
            <th>Cover Letter</th>
            <th>Resume</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>`;

    data.applicants.forEach(function(a, i) {
      var date = new Date(a.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short" });
      var badgeClass = a.status === "accepted" ? "badge-accepted" : a.status === "rejected" ? "badge-rejected" : "badge-pending";
      var cgpa = a.cgpa ? a.cgpa : "—";
      var backlogs = (a.backlogs !== null && a.backlogs !== undefined) ? a.backlogs : "—";

      html += `<tr>
        <td>${i+1}</td>
        <td>
          <div class="applicant-name">${a.full_name || "—"}</div>
          <div class="applicant-meta">${a.email || "—"}</div>
          <div class="applicant-meta">Applied: ${date}</div>
        </td>
        <td>${a.institute || "—"}</td>
        <td>${a.batch || "—"} · ${a.degree || "—"}</td>
        <td style="font-size:12px;">${a.branch || "—"}</td>
        <td style="font-weight:600;color:${a.cgpa >= 7 ? '#2e7d32' : '#c62828'}">${cgpa}</td>
        <td style="text-align:center;">${backlogs}</td>
        <td style="max-width:160px;font-size:12px;">${a.cover_letter ? a.cover_letter.substring(0,80) + (a.cover_letter.length > 80 ? "..." : "") : "<span style='color:#8b7d6b;'>—</span>"}</td>
        <td>${a.resume_path
          ? `<a href="${BASE_URL}/${a.resume_path}" target="_blank" class="btn-sm btn-view">📄 View</a>`
          : "<span style='color:#8b7d6b;font-size:12px;'>Not uploaded</span>"}</td>
        <td><span class="badge ${badgeClass}">${a.status}</span></td>
        <td>
          <button class="btn-sm btn-accept" onclick="updateStatus(${a.id}, 'accepted')">✓ Accept</button>
          <button class="btn-sm btn-reject" onclick="updateStatus(${a.id}, 'rejected')">✗ Reject</button>
        </td>
      </tr>`;
    });

    html += "</tbody></table>";
    list.innerHTML = html;

  } catch(e) {
    list.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><h3>Network error</h3><p>Is the server running?</p></div>';
  }
}

async function updateStatus(applicationId, status) {
  var label = status === "accepted" ? "Accept" : "Reject";
  if (!confirm(label + " this application? The student will be notified by email.")) return;
  try {
    var res  = await fetch(BASE_URL + "/company/applications/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: applicationId, status: status })
    });
    var data = await res.json();
    if (data.success) {
      alert("✅ Application " + status + "! Student has been notified by email.");
      loadApplicants();
    } else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

function exportCSV() {
  window.open(BASE_URL + "/company/jobs/" + jobId + "/applicants/export", "_blank");
}
