const BASE_URL = "http://43.205.171.240";

var user = JSON.parse(sessionStorage.getItem("user") || "null");
if (!user) { window.location.href = "login.html"; }

var params = new URLSearchParams(window.location.search);
var jobId  = params.get("job_id");
if (!jobId) { window.location.href = "opportunities.html"; }

// Load job info
loadJobInfo();

async function loadJobInfo() {
  try {
    var res  = await fetch(BASE_URL + "/jobs/" + jobId);
    var data = await res.json();

    if (!data.success) {
      window.location.href = "opportunities.html";
      return;
    }

    var job = data.job;
    document.title = "Apply — " + job.title + " | Campus Connect";
    document.getElementById("pageTitle").textContent   = job.title;
    document.getElementById("jobCompany").textContent  = "🏢 " + (job.company_name || "Company");

    var tags = "";
    var typeLabel = { internship:"Internship", fulltime:"Full-time", parttime:"Part-time", contract:"Contract" }[job.type] || job.type;
    tags += '<span class="tag">' + typeLabel + '</span>';
    if (job.location) tags += '<span class="tag">📍 ' + job.location + '</span>';
    if (job.stipend)  tags += '<span class="tag">💰 ' + job.stipend  + '</span>';
    if (job.duration) tags += '<span class="tag">⏱ '  + job.duration + '</span>';
    document.getElementById("jobTags").innerHTML = tags;

    // Check if already applied
    var checkRes  = await fetch(BASE_URL + "/jobs/" + jobId + "/applied/" + user.id);
    var checkData = await checkRes.json();

    if (checkData.applied) {
      var btn = document.getElementById("submitBtn");
      btn.disabled    = true;
      btn.textContent = "✅ Already Applied (" + checkData.status + ")";
      var msg = document.getElementById("statusMsg");
      msg.textContent = "You have already applied to this job. Status: " + checkData.status;
      msg.className   = "status-msg success";
    }

  } catch(e) {
    console.error("Error loading job:", e);
  }
}

async function submitApplication() {
  var coverLetter = document.getElementById("coverLetter").value.trim();
  var resumeFile  = document.getElementById("resumeFile").files[0];
  var statusMsg   = document.getElementById("statusMsg");
  var btn         = document.getElementById("submitBtn");

  statusMsg.className     = "status-msg";
  statusMsg.style.display = "none";

  btn.disabled    = true;
  btn.textContent = "Submitting...";

  try {
    var formData = new FormData();
    formData.append("job_id",       jobId);
    formData.append("student_id",   user.id);
    formData.append("cover_letter", coverLetter);
    if (resumeFile) formData.append("resume", resumeFile);

    var res  = await fetch(BASE_URL + "/jobs/apply", { method: "POST", body: formData });
    var data = await res.json();

    if (data.success) {
      statusMsg.textContent = "🎉 Application submitted successfully! The company will review your profile.";
      statusMsg.className   = "status-msg success";
      btn.textContent       = "✅ Applied!";
    } else {
      statusMsg.textContent = data.message || "Something went wrong.";
      statusMsg.className   = "status-msg error";
      btn.disabled    = false;
      btn.textContent = "🚀 Submit Application";
    }
  } catch(e) {
    statusMsg.textContent = "Network error. Is the server running on port 5001?";
    statusMsg.className   = "status-msg error";
    btn.disabled    = false;
    btn.textContent = "🚀 Submit Application";
  }
}
