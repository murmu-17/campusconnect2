const BASE_URL = "https://conncam.in";

var currentAdmin = null;
var currentDisparityUserId = null;

// ══════════════════════════════════════════════════
//  USER TYPE BADGE SYSTEM
//  Derives badge from institute name + batch + account_type
//  No new DB column needed — works with existing schema
// ══════════════════════════════════════════════════
function getUserType(user) {
  var institute = (user.institute || "").toUpperCase();
  var batch     = parseInt(user.batch) || 0;
  var now       = new Date().getFullYear();

  // Alumni: verified user whose batch has already passed
  if (user.account_type === "verified" && batch > 0 && batch < now) {
    return "alumni";
  }
  // IITian: institute name starts with or contains IIT (but not IIIT)
  if (institute.startsWith("IIT") && !institute.startsWith("IIIT")) {
    return "iit";
  }
  // NITian: institute contains NIT or IIIT
  if (institute.startsWith("NIT") || institute.startsWith("IIIT")) {
    return "nit";
  }
  // School Student: general account (not verified, no institute)
  if (user.account_type === "general" && !user.institute) {
    return "school";
  }
  return "general";
}

// Returns the HTML pill badge for a user
function userBadgeHtml(user, size) {
  // size: "sm" = compact (tables), "md" = normal (cards)
  var type = getUserType(user);
  var map = {
    iit:     { label: "IITian",         cls: "ub-iit"    },
    nit:     { label: "NITian",         cls: "ub-nit"    },
    alumni:  { label: "Alumni",         cls: "ub-alumni" },
    school:  { label: "School Student", cls: "ub-school" },
    general: { label: "General",        cls: "ub-general" }
  };
  var info    = map[type] || map.general;
  var padding = size === "sm" ? "2px 8px" : "3px 10px";
  var fsize   = size === "sm" ? "10px"    : "11px";
  return '<span class="user-badge ' + info.cls + '" style="display:inline-flex;align-items:center;gap:4px;padding:' + padding + ';border-radius:999px;font-size:' + fsize + ';font-weight:600;letter-spacing:0.02em;white-space:nowrap;">' +
         '<span class="ub-dot" style="width:5px;height:5px;border-radius:50%;flex-shrink:0;"></span>' +
         info.label + '</span>';
}

// Inject badge CSS once into <head>
(function injectBadgeCSS() {
  if (document.getElementById("ub-styles")) return;
  var style = document.createElement("style");
  style.id = "ub-styles";
  style.textContent = [
    ".user-badge .ub-dot { display:inline-block; }",

    /* IITian – Purple */
    ".ub-iit    { background:#EEEDFE; color:#3C3489; }",
    ".ub-iit    .ub-dot { background:#534AB7; }",

    /* NITian / IIIT – Teal */
    ".ub-nit    { background:#E1F5EE; color:#085041; }",
    ".ub-nit    .ub-dot { background:#0F6E56; }",

    /* Alumni – Amber */
    ".ub-alumni { background:#FAEEDA; color:#633806; }",
    ".ub-alumni .ub-dot { background:#854F0B; }",

    /* School Student – Blue */
    ".ub-school { background:#E6F1FB; color:#0C447C; }",
    ".ub-school .ub-dot { background:#185FA5; }",

    /* General – Gray */
    ".ub-general { background:#F1EFE8; color:#5F5E5A; }",
    ".ub-general .ub-dot { background:#888780; }"
  ].join("\n");
  document.head.appendChild(style);
})();

// ══════════════════════════════════════════════════
//  EXISTING ADMIN CODE (with badges woven in)
// ══════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", function() {
  var stored = sessionStorage.getItem("adminData");
  if (!stored) { window.location.href = "admin-login.html"; return; }
  currentAdmin = JSON.parse(stored);
  document.getElementById("adminName").textContent = currentAdmin.name + " (" + currentAdmin.role + ")";
  if (currentAdmin.role === "superadmin") {
    document.getElementById("tabVerifiers").style.display  = "inline-block";
    document.getElementById("tabInstitutes").style.display = "inline-block";
    document.getElementById("tabCompanies").style.display  = "inline-block";
    document.getElementById("tabReports").style.display    = "inline-block";
    document.getElementById("tabChats").style.display      = "inline-block";
    document.getElementById("tabLogs").style.display       = "inline-block";
  }
  document.getElementById("detailModal").style.display    = "none";
  document.getElementById("disparityModal").style.display = "none";
  document.getElementById("verifierModal").style.display  = "none";
  document.getElementById("passwordModal").style.display  = "none";
  loadPending();
});

function adminLogout() {
  sessionStorage.removeItem("adminData");
  window.location.href = "admin-login.html";
}

function showTab(tab) {
  ["pending","all","verifiers","institutes","companies","reports","chats","logs"].forEach(function(t) {
    var tabEl = document.getElementById("tab-" + t);
    if (tabEl) tabEl.style.display = (t === tab) ? "block" : "none";
  });
  document.querySelectorAll(".nav-btn").forEach(function(b){ b.classList.remove("active"); });
  var activeBtn = document.getElementById("btn-" + tab) || document.getElementById("tab" + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (activeBtn) activeBtn.classList.add("active");
  if (tab === "pending")    loadPending();
  if (tab === "all")        loadUsers();
  if (tab === "verifiers")  loadVerifiers();
  if (tab === "institutes") loadInstitutes();
  if (tab === "companies")  loadCompanies();
  if (tab === "reports")    loadReports();
  if (tab === "chats")      loadReportedChats();
  if (tab === "logs")       loadLogs();
}

// ── PENDING VERIFICATIONS (badge added to card) ──
async function loadPending() {
  document.getElementById("pendingList").innerHTML = '<p class="loading">Loading...</p>';
  try {
    var res  = await fetch(BASE_URL + "/admin/pending");
    var data = await res.json();
    if (!data.success) { document.getElementById("pendingList").innerHTML = '<p class="empty">Error: ' + (data.message || "Could not load") + '</p>'; return; }
    if (data.pending.length === 0) { document.getElementById("pendingList").innerHTML = '<p class="empty">No pending verifications.</p>'; return; }
    var html = "";
    data.pending.forEach(function(user) {
      var docUrl = user.document_path ? BASE_URL + "/" + user.document_path : null;
      var date = new Date(user.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
      html += '<div class="user-card" id="card-' + user.id + '">';
      html += '<div class="user-info">';
      // ── NAME + USER TYPE BADGE ──
      html += '<h4 style="display:flex;align-items:center;gap:8px;">' + escHtml(user.full_name || "N/A") + ' ' + userBadgeHtml(user, "md") + '</h4>';
      html += '<p class="email">' + escHtml(user.email || "N/A") + '</p>';
      html += '<p><strong>Institute:</strong> ' + escHtml(user.institute || "N/A") + '</p>';
      html += '<p><strong>Batch:</strong> ' + (user.batch || "N/A") + ' &nbsp;|&nbsp; <strong>Degree:</strong> ' + escHtml(user.degree || "N/A") + '</p>';
      html += '<p><strong>Branch:</strong> ' + escHtml(user.branch || "N/A") + '</p>';
      html += '<p><strong>Submitted:</strong> ' + date + '</p>';
      if (user.disparity_message) html += '<p style="color:#e65100;margin-top:6px;font-size:12px;"><strong>Previous Disparity:</strong> ' + escHtml(user.disparity_message) + '</p>';
      html += '<span class="badge badge-pending">Pending</span></div>';
      html += '<div class="card-actions">';
      html += '<button class="btn-approve"    onclick="verifyUser(' + user.id + ',\'approved\')">&#10003; Approve</button>';
      html += '<button class="btn-reject"     onclick="verifyUser(' + user.id + ',\'rejected\')">&#10007; Reject</button>';
      html += '<button class="btn-disparity"  onclick="openDisparity(' + user.id + ',\'' + (user.full_name||"User").replace(/'/g,"") + '\')">&#9888; Disparity</button>';
      if (docUrl) html += '<a class="btn-view-doc" href="' + docUrl + '" target="_blank">&#128196; View Document</a>';
      else html += '<button class="btn-view-doc" disabled style="opacity:0.4;cursor:not-allowed;">No Document</button>';
      html += '</div></div>';
    });
    document.getElementById("pendingList").innerHTML = html;
  } catch(e) { document.getElementById("pendingList").innerHTML = '<p class="empty">&#9888; Network error</p>'; }
}

async function verifyUser(userId, action) {
  if (!confirm(action === "approved" ? "Approve this user?" : "Reject this user?")) return;
  try {
    var res = await fetch(BASE_URL + "/admin/verify", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({user_id:userId, action:action, admin_id:currentAdmin.id, admin_name:currentAdmin.name, admin_role:currentAdmin.role}) });
    var data = await res.json();
    if (data.success) {
      var card = document.getElementById("card-" + userId);
      if (card) {
        card.querySelector(".badge").className = "badge " + (action === "approved" ? "badge-approved" : "badge-rejected");
        card.querySelector(".badge").textContent = action === "approved" ? "Approved ✓" : "Rejected ✗";
        card.querySelector(".card-actions").innerHTML = '<span style="color:#8b7d6b;font-size:13px;font-weight:600;">' + (action === "approved" ? "✓ Approved" : "✗ Rejected") + '</span>';
      }
    } else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

function openDisparity(userId, userName) {
  currentDisparityUserId = userId;
  document.getElementById("disparityUserName").textContent = "User: " + userName;
  document.getElementById("disparityMsg").value = "";
  document.getElementById("disparityModal").style.display = "flex";
}
function closeModal() { document.getElementById("disparityModal").style.display = "none"; currentDisparityUserId = null; }
async function sendDisparity() {
  var msg = document.getElementById("disparityMsg").value.trim();
  if (!msg) { alert("Please enter a message."); return; }
  try {
    var res = await fetch(BASE_URL + "/admin/disparity", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({user_id:currentDisparityUserId, message:msg, admin_id:currentAdmin.id, admin_name:currentAdmin.name, admin_role:currentAdmin.role}) });
    var data = await res.json();
    if (data.success) { alert("Disparity raised."); closeModal(); loadPending(); }
    else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

// ── ALL USERS TABLE (badge in Type column, replaces plain text) ──
async function loadUsers() {
  document.getElementById("usersList").innerHTML = '<p class="loading">Loading...</p>';
  var type=document.getElementById("f_type").value, institute=document.getElementById("f_institute").value, batch=document.getElementById("f_batch").value, branch=document.getElementById("f_branch").value, degree=document.getElementById("f_degree").value;
  var query = "?";
  if (type)      query += "account_type=" + type + "&";
  if (institute) query += "institute=" + encodeURIComponent(institute) + "&";
  if (batch)     query += "batch=" + batch + "&";
  if (branch)    query += "branch=" + encodeURIComponent(branch) + "&";
  if (degree)    query += "degree=" + encodeURIComponent(degree) + "&";
  try {
    var res = await fetch(BASE_URL + "/users" + query);
    var data = await res.json();
    if (!data.success || data.users.length === 0) { document.getElementById("usersList").innerHTML = '<p class="empty">No users found.</p>'; return; }
    var html = '<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Institute</th><th>Batch</th><th>Degree</th><th>Branch</th><th>User Type</th><th>Status</th><th>Action</th></tr></thead><tbody>';
    data.users.forEach(function(user, i) {
      var sc = user.verification_status === "approved" ? "badge-approved" : user.verification_status === "pending" ? "badge-pending" : "badge-rejected";
      var userData = encodeURIComponent(JSON.stringify(user));
      var suspendLabel = user.is_suspended ? "▶️ Unsuspend" : "⏸️ Suspend";
      var suspendClass = user.is_suspended ? "btn-small btn-approve" : "btn-small btn-toggle";
      html += '<tr>';
      html += '<td>' + (i+1) + '</td>';
      html += '<td><span style="color:#b37a0f;font-weight:600;cursor:pointer;text-decoration:underline;" onclick="viewUser(\'' + userData + '\')">' + escHtml(user.full_name||"N/A") + '</span></td>';
      html += '<td style="font-size:12px;color:#b37a0f;">' + escHtml(user.email||user.phone||"—") + '</td>';
      html += '<td>' + escHtml(user.institute||"—") + '</td>';
      html += '<td>' + (user.batch||"—") + '</td>';
      html += '<td>' + escHtml(user.degree||"—") + '</td>';
      html += '<td>' + escHtml(user.branch||"—") + '</td>';
      // ── USER TYPE BADGE (replaces plain account_type text) ──
      html += '<td>' + userBadgeHtml(user, "sm") + '</td>';
      html += '<td><span class="badge ' + sc + '">' + (user.is_suspended ? "🔴 Suspended" : user.verification_status) + '</span></td>';
      html += '<td style="display:flex;gap:6px;flex-wrap:wrap;">';
      html += '<button class="btn-small btn-view" onclick="viewUser(\'' + userData + '\')">👁️ View</button>';
      html += '<button class="' + suspendClass + '" onclick="suspendUser(' + user.id + ',\'' + (user.full_name||"").replace(/'/g,"") + '\')">' + suspendLabel + '</button>';
      html += '</td></tr>';
    });
    html += '</tbody></table><p style="padding:12px 16px;font-size:12px;color:#8b7d6b;">Showing ' + data.total + ' users</p>';
    document.getElementById("usersList").innerHTML = html;
  } catch(e) { document.getElementById("usersList").innerHTML = '<p class="empty">Error loading users.</p>'; }
}

async function suspendUser(userId, userName) {
  if (!confirm("Toggle suspend for account of " + userName + "?")) return;
  try {
    var res = await fetch(BASE_URL + "/admin/users/suspend", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({user_id: userId, admin_id: currentAdmin.id, admin_name: currentAdmin.name, admin_role: currentAdmin.role})
    });
    var data = await res.json();
    if (data.success) {
      alert("User " + (data.suspended ? "suspended ⏸️" : "unsuspended ▶️") + " successfully!");
      loadUsers();
    } else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

async function loadInstitutes() {
  document.getElementById("institutesList").innerHTML = '<p class="loading">Loading...</p>';
  try {
    var res = await fetch(BASE_URL + "/social/institutes");
    var data = await res.json();
    if (!data.success) { document.getElementById("institutesList").innerHTML = '<p class="empty">Error.</p>'; return; }
    var groups = {};
    data.institutes.forEach(function(inst) { if (!groups[inst.category]) groups[inst.category] = []; groups[inst.category].push(inst); });
    var html = '';
    Object.keys(groups).forEach(function(cat) {
      html += '<div style="margin-bottom:28px;"><h4 style="font-size:14px;font-weight:700;color:#4a3f35;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e0d5c7;">' + cat + '</h4>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">';
      groups[cat].forEach(function(inst) {
        var isOn=inst.is_enabled, cardBg=isOn?"#f0fdf4":"#fafafa", border=isOn?"#86efac":"#e0d5c7", dotColor=isOn?"#16a34a":"#d1d5db";
        var statusText=isOn?"Live ✓":"Coming Soon", statusColor=isOn?"#16a34a":"#9ca3af";
        var btnBg=isOn?"#fee2e2":"#dcfce7", btnColor=isOn?"#dc2626":"#16a34a", btnText=isOn?"Disable":"Enable";
        html += '<div style="background:'+cardBg+';border:1.5px solid '+border+';border-radius:12px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;">';
        html += '<div style="display:flex;align-items:center;gap:10px;"><div style="width:10px;height:10px;border-radius:50%;background:'+dotColor+';flex-shrink:0;"></div>';
        html += '<div><div style="font-size:13px;font-weight:600;color:#3e2c0f;">'+inst.name+'</div><div style="font-size:11px;color:'+statusColor+';font-weight:600;margin-top:2px;">'+statusText+'</div></div></div>';
        html += '<button onclick="toggleInstitute('+inst.id+')" style="padding:6px 14px;border-radius:20px;border:none;background:'+btnBg+';color:'+btnColor+';font-family:\'Poppins\',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">'+btnText+'</button></div>';
      });
      html += '</div></div>';
    });
    document.getElementById("institutesList").innerHTML = html;
  } catch(e) { document.getElementById("institutesList").innerHTML = '<p class="empty">Error.</p>'; }
}

async function toggleInstitute(instituteId) {
  try {
    var res = await fetch(BASE_URL + "/admin/institutes/toggle", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({institute_id:instituteId, admin_id:currentAdmin.id, admin_name:currentAdmin.name}) });
    var data = await res.json();
    if (data.success) loadInstitutes(); else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

async function loadCompanies() {
  document.getElementById("companiesList").innerHTML = '<p class="loading">Loading...</p>';
  try {
    var res = await fetch(BASE_URL + "/admin/companies");
    var data = await res.json();
    if (!data.success || data.companies.length === 0) { document.getElementById("companiesList").innerHTML = '<p class="empty">No company registrations yet.</p>'; return; }
    var html = '<table><thead><tr><th>#</th><th>Company</th><th>Email</th><th>Industry</th><th>Website</th><th>Document</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>';
    data.companies.forEach(function(c, i) {
      var date = new Date(c.created_at).toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"});
      var sc = c.status === "approved" ? "badge-approved" : c.status === "rejected" ? "badge-rejected" : "badge-pending";
      var docUrl = c.document_path ? BASE_URL + "/" + c.document_path : null;
      html += '<tr><td>' + (i+1) + '</td><td style="font-weight:600;">' + escHtml(c.name) + '</td>';
      html += '<td style="font-size:12px;color:#b37a0f;">' + escHtml(c.email) + '</td>';
      html += '<td>' + escHtml(c.industry||"—") + '</td>';
      html += '<td style="font-size:12px;">' + (c.website ? '<a href="'+c.website+'" target="_blank" style="color:#b37a0f;">'+escHtml(c.website)+'</a>' : "—") + '</td>';
      html += '<td>' + (docUrl ? '<a href="'+docUrl+'" target="_blank" class="btn-small btn-toggle">📄 View</a>' : "—") + '</td>';
      html += '<td><span class="badge ' + sc + '">' + c.status + '</span></td>';
      html += '<td style="font-size:12px;">' + date + '</td><td>';
      if (c.status === "pending") {
        html += '<button class="btn-small btn-approve" style="background:#4caf50;color:white;border:none;margin-right:4px;" onclick="verifyCompany('+c.id+',\'approved\')">✓ Approve</button>';
        html += '<button class="btn-small btn-del" style="margin-right:4px;" onclick="verifyCompany('+c.id+',\'rejected\')">✗ Reject</button>';
      }
      html += '<button class="btn-small btn-del" onclick="deleteCompany('+c.id+',\''+escHtml(c.name).replace(/'/g,"")+'\')">\uD83D\uDDD1 Delete</button></td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById("companiesList").innerHTML = html;
  } catch(e) { document.getElementById("companiesList").innerHTML = '<p class="empty">Error loading companies.</p>'; }
}

async function verifyCompany(companyId, action) {
  var rejectionMessage = "";
  if (action === "rejected") { rejectionMessage = prompt("Enter rejection reason (optional):"); if (rejectionMessage === null) return; }
  if (!confirm(action === "approved" ? "Approve this company?" : "Reject this company?")) return;
  try {
    var res = await fetch(BASE_URL + "/admin/companies/verify", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({company_id:companyId, action:action, rejection_message:rejectionMessage, admin_id:currentAdmin.id, admin_name:currentAdmin.name, admin_role:currentAdmin.role}) });
    var data = await res.json();
    if (data.success) { alert("Company " + action + " successfully!"); loadCompanies(); } else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

async function deleteCompany(companyId, companyName) {
  if (!confirm("DELETE company " + companyName + "? All jobs and applications removed too.")) return;
  try {
    var res = await fetch(BASE_URL + "/admin/companies/delete", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({company_id:companyId, admin_id:currentAdmin.id, admin_name:currentAdmin.name, admin_role:currentAdmin.role}) });
    var data = await res.json();
    if (data.success) { alert("Company deleted."); loadCompanies(); } else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

async function loadVerifiers() {
  document.getElementById("verifiersList").innerHTML = '<p class="loading">Loading...</p>';
  try {
    var res = await fetch(BASE_URL + "/admin/verifiers");
    var data = await res.json();
    if (!data.success) { document.getElementById("verifiersList").innerHTML = '<p class="empty">Error.</p>'; return; }
    var html = '<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    data.verifiers.forEach(function(v, i) {
      var isSuper = v.role === "superadmin";
      html += '<tr><td>'+(i+1)+'</td><td>'+escHtml(v.name)+'</td><td>'+escHtml(v.email)+'</td>';
      html += '<td><span class="badge '+(isSuper?"badge-approved":"badge-pending")+'">'+v.role+'</span></td>';
      html += '<td><span class="badge '+(v.is_active?"badge-approved":"badge-rejected")+'">'+(v.is_active?"Active":"Inactive")+'</span></td><td>';
      if (!isSuper) {
        html += '<button class="btn-small btn-toggle" onclick="toggleVerifier('+v.id+')">'+(v.is_active?"Deactivate":"Activate")+'</button> ';
        html += '<button class="btn-small btn-pwd" onclick="openPasswordModal('+v.id+',\''+v.name.replace(/'/g,"")+'\')" >Change Password</button> ';
        html += '<button class="btn-small btn-del" onclick="deleteVerifier('+v.id+',\''+v.name.replace(/'/g,"")+'\')" >Delete</button>';
      } else html += '<span style="color:#8b7d6b;font-size:12px;">Super Admin</span>';
      html += '</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById("verifiersList").innerHTML = html;
  } catch(e) { document.getElementById("verifiersList").innerHTML = '<p class="empty">Error.</p>'; }
}

function openVerifierModal() { document.getElementById("newVerifierName").value=""; document.getElementById("newVerifierEmail").value=""; document.getElementById("newVerifierPassword").value=""; document.getElementById("verifierModal").style.display="flex"; }
function closeVerifierModal() { document.getElementById("verifierModal").style.display="none"; }
async function createVerifier() {
  var name=document.getElementById("newVerifierName").value.trim(), email=document.getElementById("newVerifierEmail").value.trim(), password=document.getElementById("newVerifierPassword").value;
  if (!name||!email||!password) { alert("All fields required."); return; }
  try {
    var res = await fetch(BASE_URL+"/admin/verifiers/create", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,password})});
    var data = await res.json();
    if (data.success) { alert("Verifier created!"); closeVerifierModal(); loadVerifiers(); } else alert("Error: "+data.message);
  } catch(e) { alert("Network error."); }
}
async function toggleVerifier(id) {
  try { var res=await fetch(BASE_URL+"/admin/verifiers/toggle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({verifier_id:id})}); var data=await res.json(); if(data.success)loadVerifiers(); else alert("Error: "+data.message); } catch(e){alert("Network error.");}
}
var currentPasswordVerifierId=null;
function openPasswordModal(id,name){currentPasswordVerifierId=id;document.getElementById("passwordVerifierName").textContent="Change password for: "+name;document.getElementById("newPassword").value="";document.getElementById("passwordModal").style.display="flex";}
function closePasswordModal(){document.getElementById("passwordModal").style.display="none";}
async function changePassword(){
  var pwd=document.getElementById("newPassword").value;
  if(!pwd||pwd.length<8){alert("Min 8 chars.");return;}
  try{var res=await fetch(BASE_URL+"/admin/verifiers/change-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({verifier_id:currentPasswordVerifierId,new_password:pwd})});var data=await res.json();if(data.success){alert("Password updated.");closePasswordModal();}else alert("Error: "+data.message);}catch(e){alert("Network error.");}
}
async function deleteVerifier(id,name){
  if(!confirm("Delete verifier "+name+"?"))return;
  try{var res=await fetch(BASE_URL+"/admin/verifiers/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({verifier_id:id})});var data=await res.json();if(data.success){alert("Deleted.");loadVerifiers();}else alert("Error: "+data.message);}catch(e){alert("Network error.");}
}

// ── REPORTS (badge added to reporter/reported columns) ──
async function loadReports() {
  document.getElementById("reportsList").innerHTML = '<p class="loading">Loading...</p>';
  try {
    var res = await fetch(BASE_URL + "/admin/reports");
    var data = await res.json();
    if (!data.success || data.reports.length === 0) { document.getElementById("reportsList").innerHTML = '<p class="empty">No reports yet.</p>'; return; }
    var html = '<table><thead><tr><th>#</th><th>Reporter</th><th>Reported</th><th>Reason</th><th>Details</th><th>Status</th><th>Time</th><th>Actions</th></tr></thead><tbody>';
    data.reports.forEach(function(r, i) {
      var date = new Date(r.created_at).toLocaleString("en-IN");
      var sc = r.status === "resolved" ? "badge-approved" : r.status === "reviewed" ? "badge-pending" : "badge-rejected";
      // Build minimal user-like objects from report data for badge derivation
      var reporterObj = { account_type: r.reporter_type||"general", institute: r.reporter_institute||"", batch: r.reporter_batch||0 };
      var reportedObj = { account_type: r.reported_type||"general",  institute: r.reported_institute||"",  batch: r.reported_batch||0  };
      html += '<tr><td>'+(i+1)+'</td>';
      html += '<td>' + escHtml(r.reporter_name||"—") + ' ' + userBadgeHtml(reporterObj,"sm") + '</td>';
      html += '<td style="font-weight:600;color:#c62828;">' + escHtml(r.reported_name||"—") + ' ' + userBadgeHtml(reportedObj,"sm") + '</td>';
      html += '<td>'+(r.reason||"—")+'</td>';
      html += '<td style="max-width:160px;font-size:12px;">'+(r.details||"—")+'</td>';
      html += '<td><span class="badge '+sc+'">'+r.status+'</span></td>';
      html += '<td style="font-size:12px;">'+date+'</td>';
      html += '<td style="display:flex;gap:4px;flex-wrap:wrap;">';
      html += '<button class="btn-small btn-toggle" onclick="updateReport('+r.id+',\'reviewed\')">Reviewed</button>';
      html += '<button class="btn-small btn-approve" style="background:#4caf50;color:white;border:none;" onclick="updateReport('+r.id+',\'resolved\')">Resolve</button>';
      html += '<button class="btn-small" style="background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;" onclick="viewReportChat('+r.reporter_id+','+r.reported_id+',\''+(r.reporter_name||"").replace(/'/g,"")+'\',\''+(r.reported_name||"").replace(/'/g,"")+'\')" >💬 View Chat</button>';
      html += '<button class="btn-small" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;" onclick="warnUser('+r.reported_id+',\''+(r.reported_name||"").replace(/'/g,"")+'\')" >⚠️ Warn</button>';
      html += '<button class="btn-small btn-del" onclick="suspendUser('+r.reported_id+',\''+(r.reported_name||"").replace(/'/g,"")+'\')" >⏸️ Suspend</button>';
      html += '</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById("reportsList").innerHTML = html;
  } catch(e) { document.getElementById("reportsList").innerHTML = '<p class="empty">Error.</p>'; }
}

async function updateReport(reportId,status){
  try{
    var res=await fetch(BASE_URL+"/admin/reports/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({report_id:reportId,status:status})});
    var data=await res.json();
    if(data.success)loadReports();else alert("Error: "+data.message);
  }catch(e){alert("Network error.");}
}

async function warnUser(userId, userName) {
  var msg = prompt("Enter warning message for " + userName + ":\n\n(This will be shown as a popup when they next login)");
  if (!msg || !msg.trim()) return;
  try {
    var res = await fetch(BASE_URL + "/admin/users/warn", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({user_id: userId, warning_message: msg.trim(), admin_id: currentAdmin.id, admin_name: currentAdmin.name, admin_role: currentAdmin.role})
    });
    var data = await res.json();
    if (data.success) alert("⚠️ Warning sent to " + userName + " successfully!\n\nThey will see it as a popup on their next login.");
    else alert("Error: " + data.message);
  } catch(e) { alert("Network error."); }
}

async function viewReportChat(user1Id, user2Id, user1Name, user2Name) {
  document.getElementById("detailContent").innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:32px;margin-bottom:12px;">💬</div><p style="color:#8b7d6b;">Loading chat history...</p></div>';
  document.getElementById("detailModal").style.display = "flex";
  try {
    var res  = await fetch(BASE_URL + "/messages/" + user1Id + "/" + user2Id);
    var data = await res.json();
    if (!data.success || data.messages.length === 0) {
      document.getElementById("detailContent").innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:32px;margin-bottom:12px;">🔍</div><h3 style="color:#4a3f35;margin-bottom:8px;">No messages found</h3><p style="color:#8b7d6b;">These users have no chat history.</p></div>';
      return;
    }
    var html = '<div style="margin-bottom:16px;padding:12px 16px;background:#fff8e1;border-radius:10px;border-left:4px solid #b37a0f;">';
    html += '<div style="font-size:12px;font-weight:700;color:#b37a0f;margin-bottom:4px;">💬 CHAT HISTORY</div>';
    html += '<div style="font-size:13px;color:#4a3f35;"><strong>' + escHtml(user1Name) + '</strong> &harr; <strong>' + escHtml(user2Name) + '</strong></div>';
    html += '<div style="font-size:11px;color:#8b7d6b;margin-top:2px;">' + data.messages.length + ' messages total</div>';
    html += '</div>';
    html += '<div style="max-height:400px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 0;">';
    data.messages.forEach(function(m) {
      var isUser1 = m.sender_id === user1Id;
      var senderName = m.sender_name || (isUser1 ? user1Name : user2Name);
      var date = new Date(m.created_at).toLocaleString("en-IN", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
      var bgColor = isUser1 ? "#e3f2fd" : "#f3e5f5";
      var nameColor = isUser1 ? "#1565c0" : "#6a1b9a";
      html += '<div style="background:' + bgColor + ';border-radius:12px;padding:10px 14px;max-width:85%;">';
      html += '<div style="font-size:11px;font-weight:700;color:' + nameColor + ';margin-bottom:4px;">' + escHtml(senderName) + '</div>';
      html += '<div style="font-size:13px;color:#4a3f35;line-height:1.5;">' + escHtml(m.content) + '</div>';
      html += '<div style="font-size:10px;color:#8b7d6b;margin-top:4px;text-align:right;">' + date + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">';
    html += '<button onclick="warnUser(' + user2Id + ',\'' + escHtml(user2Name) + '\');closeDetailModal();" style="padding:10px 20px;border-radius:10px;border:none;background:#fff3e0;color:#e65100;font-family:\'Poppins\',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">⚠️ Warn ' + escHtml(user2Name) + '</button>';
    html += '<button onclick="suspendUser(' + user2Id + ',\'' + escHtml(user2Name) + '\');closeDetailModal();" style="padding:10px 20px;border-radius:10px;border:none;background:#fff8e1;color:#b37a0f;font-family:\'Poppins\',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">⏸️ Suspend ' + escHtml(user2Name) + '</button>';
    html += '<button onclick="closeDetailModal()" style="padding:10px 20px;border-radius:10px;border:none;background:#3e2c0f;color:white;font-family:\'Poppins\',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Close</button>';
    html += '</div>';
    document.getElementById("detailContent").innerHTML = html;
  } catch(e) {
    document.getElementById("detailContent").innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:32px;">❌</div><p style="color:#c62828;">Could not load chat history.</p></div>';
  }
}

async function loadLogs() {
  document.getElementById("logsList").innerHTML = '<p class="loading">Loading...</p>';
  try {
    var res = await fetch(BASE_URL + "/admin/logs");
    var data = await res.json();
    if (!data.success || data.logs.length === 0) { document.getElementById("logsList").innerHTML = '<p class="empty">No activity yet.</p>'; return; }
    var html = '<table><thead><tr><th>#</th><th>Admin</th><th>Role</th><th>Action</th><th>Target</th><th>Time</th></tr></thead><tbody>';
    data.logs.forEach(function(log, i) { var date=new Date(log.created_at).toLocaleString("en-IN"); html+='<tr><td>'+(i+1)+'</td><td>'+(log.admin_name||"—")+'</td><td>'+(log.admin_role||"—")+'</td><td>'+(log.action||"—")+'</td><td>'+(log.target_user_name||"—")+'</td><td>'+date+'</td></tr>'; });
    html += '</tbody></table>';
    document.getElementById("logsList").innerHTML = html;
  } catch(e) { document.getElementById("logsList").innerHTML = '<p class="empty">Error.</p>'; }
}

function closeDetailModal(){document.getElementById("detailModal").style.display="none";}
function closeUserModal(){document.getElementById("detailModal").style.display="none";}

function escHtml(t){if(!t)return"";return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

// ── USER DETAIL MODAL (badge shown next to name) ──
function viewUser(encodedData) {
  var user=JSON.parse(decodeURIComponent(encodedData));
  var sc=user.verification_status==="approved"?"#2e7d32":user.verification_status==="pending"?"#b37a0f":"#c62828";
  var scBg=user.verification_status==="approved"?"#e8f5e9":user.verification_status==="pending"?"#fff8e1":"#ffebee";
  var joined=user.created_at?new Date(user.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}):"—";
  var initials=(user.full_name||"?").split(" ").map(function(w){return w[0];}).join("").toUpperCase().slice(0,2);
  var suspendLabel = user.is_suspended ? "▶️ Unsuspend" : "⏸️ Suspend";
  var suspendBg = user.is_suspended ? "#e8f5e9" : "#fff8e1";
  var suspendColor = user.is_suspended ? "#2e7d32" : "#b37a0f";
  var html=`
  <div style="text-align:center;margin-bottom:24px;">
    <div style="width:72px;height:72px;border-radius:50%;background:#3e2c0f;color:#f0c060;font-size:26px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">${initials}</div>
    <h3 style="font-size:20px;color:#3e2c0f;margin-bottom:6px;">${escHtml(user.full_name||"N/A")}</h3>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
      <span style="padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${scBg};color:${sc};">${user.is_suspended ? "🔴 Suspended" : user.verification_status}</span>
      ${userBadgeHtml(user, "md")}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div style="background:#fdfaf7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">EMAIL</div><div style="font-size:13px;color:#3e2c0f;font-weight:600;word-break:break-all;">${escHtml(user.email||"—")}</div></div>
    <div style="background:#fdfaf7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">PHONE</div><div style="font-size:13px;color:#3e2c0f;font-weight:600;">${escHtml(user.phone||"—")}</div></div>
    <div style="background:#fdfaf7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">USER TYPE</div><div style="font-size:13px;color:#3e2c0f;font-weight:600;">${userBadgeHtml(user,"md")}</div></div>
    <div style="background:#fdfaf7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">JOINED</div><div style="font-size:13px;color:#3e2c0f;font-weight:600;">${joined}</div></div>
    <div style="background:#fdfaf7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">INSTITUTE</div><div style="font-size:13px;color:#3e2c0f;font-weight:600;">${escHtml(user.institute||"—")}</div></div>
    <div style="background:#fdfaf7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">BATCH</div><div style="font-size:13px;color:#3e2c0f;font-weight:600;">${user.batch||"—"}</div></div>
    <div style="background:#fdfaf7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">DEGREE</div><div style="font-size:13px;color:#3e2c0f;font-weight:600;">${escHtml(user.degree||"—")}</div></div>
    <div style="background:#fdfaf7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">BRANCH</div><div style="font-size:13px;color:#3e2c0f;font-weight:600;">${escHtml(user.branch||"—")}</div></div>
  </div>
  ${user.disparity_message?`<div style="margin-top:12px;background:#fff8e1;border-radius:12px;padding:14px;border-left:4px solid #b37a0f;"><div style="font-size:11px;color:#8b7d6b;font-weight:600;margin-bottom:4px;">⚠️ DISPARITY</div><div style="font-size:13px;color:#3e2c0f;">${escHtml(user.disparity_message)}</div></div>`:""}
  <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
    <button onclick="warnUser(${user.id},'${(user.full_name||"").replace(/'/g,"")}');closeDetailModal();" style="padding:10px 20px;border-radius:10px;border:none;background:#fff3e0;color:#e65100;font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">⚠️ Warn</button>
    <button onclick="suspendUser(${user.id},'${(user.full_name||"").replace(/'/g,"")}');closeDetailModal();" style="padding:10px 20px;border-radius:10px;border:none;background:${suspendBg};color:${suspendColor};font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">${suspendLabel}</button>
    <button onclick="closeDetailModal()" style="padding:10px 20px;border-radius:10px;border:none;background:#3e2c0f;color:white;font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
  </div>`;
  document.getElementById("detailContent").innerHTML=html;
  document.getElementById("detailModal").style.display="flex";
}