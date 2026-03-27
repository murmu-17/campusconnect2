const BASE_URL = "https://conncam.in";

var otpVerified = false;
var resendTimer = null;

// ── Progress bar ──
const trackedFields = ["full_name", "email", "password", "institute", "batch", "degree", "branch"];

function updateProgress() {
  var filled = trackedFields.filter(function(f) {
    var el = document.getElementById(f);
    return el && el.value && el.value.trim() !== "";
  }).length;

  var subtype = document.getElementById("user_subtype").value;
  var total = trackedFields.length;

  if (subtype === "alumni") {
    var hasFile = document.getElementById("docFile").files.length > 0;
    if (hasFile) filled++;
    total = trackedFields.length + 1;
  }

  var percent = (filled / total) * 100;
  document.getElementById("progressFill").style.width = percent + "%";
}

trackedFields.forEach(function(f) {
  var el = document.getElementById(f);
  if (el) {
    el.addEventListener("input", updateProgress);
    el.addEventListener("change", updateProgress);
  }
});

document.getElementById("docFile").addEventListener("change", function() {
  updateProgress();
});

// ── Auto-detect institute from email ──
var instituteMap = {
  "iitmandi":    "IIT Mandi",
  "iitb":        "IIT Bombay",
  "iitd":        "IIT Delhi",
  "iitm":        "IIT Madras",
  "iitk":        "IIT Kanpur",
  "iitkgp":      "IIT Kharagpur",
  "iitr":        "IIT Roorkee",
  "iitg":        "IIT Guwahati",
  "iith":        "IIT Hyderabad",
  "iitj":        "IIT Jodhpur",
  "iitp":        "IIT Patna",
  "iitrpr":      "IIT Ropar",
  "iitbbs":      "IIT Bhubaneswar",
  "iitgn":       "IIT Gandhinagar",
  "iiti":        "IIT Indore",
  "iittirupati": "IIT Tirupati",
  "iitism":      "IIT Dhanbad (ISM)",
  "iitbhilai":   "IIT Bhilai",
  "iitjammu":    "IIT Jammu",
  "iitdharwad":  "IIT Dharwad",
  "iitpkd":      "IIT Palakkad",
  "iitgoa":      "IIT Goa",
  "iitbhu":      "IIT Varanasi (BHU)",
  "nitc":        "NIT Calicut",
  "nitt":        "NIT Trichy",
  "nitw":        "NIT Warangal",
  "nitk":        "NIT Surathkal",
  "nitrkl":      "NIT Rourkela",
  "mnnit":       "NIT Allahabad",
  "iiith":       "IIIT Hyderabad",
  "iiita":       "IIIT Allahabad",
  "iiitb":       "IIIT Bangalore",
  "iisc":        "IISc Bangalore"
};

document.getElementById("email").addEventListener("blur", function() {
  var subtype = document.getElementById("user_subtype").value;
  if (subtype !== "student") return;

  var email = this.value.toLowerCase();
  var instituteSelect = document.getElementById("institute");

  var parts = email.split("@");
  if (parts.length < 2) return;
  var domain = parts[1];

  var detected = false;
  // Sort keys longest first to avoid partial matches (e.g. "iitm" matching before "iitmandi")
  var sortedKeys = Object.keys(instituteMap).sort(function(a, b) { return b.length - a.length; });
  for (var i = 0; i < sortedKeys.length; i++) {
    var key = sortedKeys[i];
    if (domain.includes(key)) {
      // Set and lock dropdown
      instituteSelect.value             = instituteMap[key];
      instituteSelect.disabled          = true;
      instituteSelect.style.background  = "#f0f9f0";
      instituteSelect.style.borderColor = "#a5d6a7";
      instituteSelect.title             = "Institute locked based on your email";

      // Save to hidden input so disabled select still submits
      document.getElementById("institute_locked").value = instituteMap[key];

      // Show green hint
      var hint = document.getElementById("emailHint");
      if (hint) {
        hint.textContent      = "✅ Institute auto-detected: " + instituteMap[key];
        hint.style.color      = "#2e7d32";
        hint.style.fontWeight = "600";
      }

      detected = true;
      updateProgress();
      break;
    }
  }

  // If not detected, unlock dropdown
  if (!detected) {
    instituteSelect.disabled          = false;
    instituteSelect.style.background  = "";
    instituteSelect.style.borderColor = "";
    document.getElementById("institute_locked").value = "";
    var hint = document.getElementById("emailHint");
    if (hint) {
      hint.textContent      = "Must be an official institute email (iit, nit, iiit, iisc domain)";
      hint.style.color      = "";
      hint.style.fontWeight = "";
    }
  }
});

// ── Send OTP ──
async function sendOtp() {
  var email   = document.getElementById("email").value.trim();
  var subtype = document.getElementById("user_subtype").value;

  if (!email) {
    alert("Please enter your email first.");
    return;
  }

  var btn = document.getElementById("send-otp-btn");
  btn.disabled    = true;
  btn.textContent = "Sending...";

  try {
    var endpoint = subtype === "student"
      ? BASE_URL + "/otp/send-institute"
      : BASE_URL + "/otp/send";

    var res  = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: email })
    });
    var data = await res.json();

    if (data.success) {
      document.getElementById("otp-section").style.display = "block";
      document.getElementById("otp-status").textContent    = "✓ OTP sent to " + email;
      document.getElementById("otp-status").style.color    = "#2e7d32";
      btn.textContent = "Resend OTP";
      startResendTimer(btn);

      if (data.dev_otp) {
        alert("DEV MODE: Your OTP is " + data.dev_otp + "\n(Configure email in .env to send automatically)");
      }
    } else {
      alert(data.message || "Failed to send OTP. Check your email address.");
      btn.disabled    = false;
      btn.textContent = "📧 Send OTP to Email";
    }
  } catch(e) {
    alert("Network error. Is the server running?");
    btn.disabled    = false;
    btn.textContent = "📧 Send OTP to Email";
  }
}

// ── Verify OTP ──
async function verifyOtp() {
  var email = document.getElementById("email").value.trim();
  var otp   = document.getElementById("otp-input").value.trim();

  if (!otp || otp.length !== 6) {
    alert("Please enter the 6-digit OTP.");
    return;
  }

  var btn = document.getElementById("verify-otp-btn");
  btn.disabled    = true;
  btn.textContent = "Verifying...";

  try {
    var res  = await fetch(BASE_URL + "/otp/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ target: email, otp: otp })
    });
    var data = await res.json();

    if (data.success) {
      otpVerified = true;
      document.getElementById("otp-section").innerHTML =
        '<p style="color:#2e7d32;font-weight:600;font-size:14px;padding:10px 0;">✅ Email verified!</p>';
      document.getElementById("otp-status").textContent = "";
    } else {
      alert(data.message || "Incorrect OTP. Please try again.");
      btn.disabled    = false;
      btn.textContent = "Verify";
    }
  } catch(e) {
    alert("Network error.");
    btn.disabled    = false;
    btn.textContent = "Verify";
  }
}

function startResendTimer(btn) {
  var seconds = 60;
  btn.disabled = true;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(function() {
    seconds--;
    btn.textContent = "Resend in " + seconds + "s";
    if (seconds <= 0) {
      clearInterval(resendTimer);
      btn.disabled    = false;
      btn.textContent = "Resend OTP";
    }
  }, 1000);
}

// ── Form Submit ──
document.getElementById("verifiedForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  var subtype = document.getElementById("user_subtype").value;

  if (!otpVerified) {
    alert("Please verify your email with OTP before submitting.");
    return;
  }

  if (subtype === "alumni") {
    var docFile = document.getElementById("docFile");
    if (!docFile.files || docFile.files.length === 0) {
      alert("Alumni must upload a verification document (degree certificate, convocation letter, etc.)");
      return;
    }
  }

  // Re-enable institute select before submit so value is included in FormData
  var instituteLocked = document.getElementById("institute_locked").value;
  if (instituteLocked) {
    var sel = document.getElementById("institute");
    sel.disabled = false;
    sel.value    = instituteLocked;
  }

  var btn = document.getElementById("submitBtn");
  btn.disabled    = true;
  btn.textContent = "Submitting...";

  try {
    var formData = new FormData(this);

    var res  = await fetch(BASE_URL + "/auth/verified-signup", {
      method: "POST",
      body:   formData
    });
    var data = await res.json();

    if (data.success) {
      document.getElementById("formSection").style.display = "none";
      document.getElementById("backLink").style.display    = "none";
      document.getElementById("successMsg").style.display  = "block";

      if (subtype === "student") {
        document.getElementById("successIcon").textContent  = "✅";
        document.getElementById("successTitle").textContent = "You're Verified!";
        document.getElementById("successText").innerHTML    =
          "Your institute email was verified successfully.<br><br>" +
          "<strong style='color:#2e7d32;'>Your account is now active!</strong> You can login and start connecting.";
      } else {
        document.getElementById("successIcon").textContent  = "⏳";
        document.getElementById("successTitle").textContent = "Application Submitted!";
        document.getElementById("successText").innerHTML    =
          "Your email is verified. Our admin will review your document and approve your alumni account.<br><br>" +
          "<strong style='color:#b37a0f;'>This usually takes 24–48 hours.</strong>";
      }
    } else {
      alert(data.message || "Something went wrong. Please try again.");
      btn.disabled    = false;
      btn.textContent = "Submit for Verification";
    }
  } catch(err) {
    alert("Network error. Make sure the server is running.");
    btn.disabled    = false;
    btn.textContent = "Submit for Verification";
  }
});