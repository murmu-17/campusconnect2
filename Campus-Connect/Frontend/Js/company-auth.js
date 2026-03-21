const BASE_URL = "http://43.205.171.240";

// ================= COMPANY REGISTER =================
async function companySignup() {
  var name        = document.getElementById("companyName").value.trim();
  var email       = document.getElementById("companyEmail").value.trim();
  var phone       = document.getElementById("companyPhone").value.trim();
  var website     = document.getElementById("companyWebsite").value.trim();
  var industry    = document.getElementById("companyIndustry").value;
  var cin         = document.getElementById("companyCIN").value.trim().toUpperCase();
  var pan         = document.getElementById("companyPAN").value.trim().toUpperCase();
  var address     = document.getElementById("companyAddress").value.trim();
  var description = document.getElementById("companyDescription").value.trim();
  var password    = document.getElementById("companyPassword").value;
  var docFile     = document.getElementById("companyDoc").files[0];

  var errorMsg   = document.getElementById("errorMsg");
  var successMsg = document.getElementById("successMsg");
  var btn        = document.getElementById("signupBtn");

  errorMsg.style.display   = "none";
  successMsg.style.display = "none";

  // Validation
  if (!name)     { showError(errorMsg, "Company name is required."); return; }
  if (!email)    { showError(errorMsg, "Company email is required."); return; }
  if (!industry) { showError(errorMsg, "Please select your industry."); return; }
  if (!cin)      { showError(errorMsg, "CIN (Corporate Identification Number) is required."); return; }
  if (cin.length !== 21) { showError(errorMsg, "CIN must be exactly 21 characters (e.g. U72900MH2020PTC123456)."); return; }
  if (!pan)      { showError(errorMsg, "PAN number is required."); return; }
  if (pan.length !== 10) { showError(errorMsg, "PAN must be exactly 10 characters (e.g. ABCDE1234F)."); return; }
  if (!address)  { showError(errorMsg, "Registered office address is required."); return; }
  if (!password || password.length < 8) { showError(errorMsg, "Password must be at least 8 characters."); return; }
  if (!docFile)  { showError(errorMsg, "Please upload a verification document."); return; }

  btn.disabled    = true;
  btn.textContent = "Submitting...";

  try {
    var formData = new FormData();
    formData.append("name",        name);
    formData.append("email",       email);
    formData.append("phone",       phone);
    formData.append("website",     website);
    formData.append("industry",    industry);
    formData.append("cin",         cin);
    formData.append("pan",         pan);
    formData.append("address",     address);
    formData.append("description", description);
    formData.append("password",    password);
    formData.append("document",    docFile);

    var res  = await fetch(BASE_URL + "/company/register", { method: "POST", body: formData });
    var data = await res.json();

    if (data.success) {
      successMsg.textContent   = "✅ Registration submitted! Admin will verify your company within 24–48 hours. You will be able to login once approved.";
      successMsg.style.display = "block";
      btn.textContent          = "✅ Submitted!";
      // Scroll to top to show success
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showError(errorMsg, data.message || "Something went wrong.");
      btn.disabled    = false;
      btn.textContent = "Register Company →";
    }
  } catch(e) {
    showError(errorMsg, "Network error. Is the server running on port 5001?");
    btn.disabled    = false;
    btn.textContent = "Register Company →";
  }
}

// ================= COMPANY LOGIN =================
async function companyLogin() {
  var email    = document.getElementById("companyLoginEmail").value.trim();
  var password = document.getElementById("companyLoginPassword").value;
  var errorMsg = document.getElementById("errorMsg");
  var btn      = document.getElementById("loginBtn");

  errorMsg.style.display = "none";

  if (!email || !password) {
    showError(errorMsg, "Please fill in all fields.");
    return;
  }

  btn.disabled    = true;
  btn.textContent = "Logging in...";

  try {
    var res  = await fetch(BASE_URL + "/company/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    var data = await res.json();

    if (data.success) {
      sessionStorage.setItem("company", JSON.stringify(data.company));
      window.location.href = "company-dashboard.html";
    } else {
      showError(errorMsg, data.message || "Invalid credentials.");
      btn.disabled    = false;
      btn.textContent = "Login →";
    }
  } catch(e) {
    showError(errorMsg, "Network error. Is the server running on port 5001?");
    btn.disabled    = false;
    btn.textContent = "Login →";
  }
}

function showError(el, msg) {
  el.textContent   = msg;
  el.style.display = "block";
}