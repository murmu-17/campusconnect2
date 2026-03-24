const BASE_URL = "https://conncam.in";

var otpVerified = false;
var resendTimer = null;

// ── File input display ──
document.getElementById("docFile").addEventListener("change", function() {
  const file = this.files[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Max 5MB allowed.");
      this.value = "";
      document.getElementById("fileName").textContent = "";
      return;
    }
    document.getElementById("fileName").textContent = "Selected: " + file.name;
  }
});

// ── Progress bar ──
const trackedFields = ["full_name","email","password","institute","batch","degree","branch"];
function updateProgress() {
  let filled = trackedFields.filter(function(f){ var el=document.getElementById(f); return el&&el.value&&el.value.trim()!==""; }).length;
  var hasFile = document.getElementById("docFile").files.length > 0;
  if (hasFile) filled++;
  var percent = (filled / (trackedFields.length + 1)) * 100;
  document.getElementById("progressFill").style.width = percent + "%";
}
trackedFields.forEach(function(f){ var el=document.getElementById(f); if(el){el.addEventListener("input",updateProgress);el.addEventListener("change",updateProgress);} });
document.getElementById("docFile").addEventListener("change", updateProgress);

// ── Send OTP ──
async function sendOtp() {
  var email = document.getElementById("email").value.trim();
  if (!email) { alert("Please enter your institute email first."); return; }

  var btn = document.getElementById("send-otp-btn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    var res  = await fetch(BASE_URL + "/otp/send-institute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });
    var data = await res.json();

    if (data.success) {
      document.getElementById("otp-section").style.display = "block";
      document.getElementById("otp-status").textContent = "✓ OTP sent to " + email;
      document.getElementById("otp-status").style.color = "#2e7d32";
      btn.textContent = "Resend OTP";
      startResendTimer(btn);

      if (data.dev_otp) {
        alert("DEV MODE: Your OTP is " + data.dev_otp + "\n(Configure email in .env to send automatically)");
      }
    } else {
      alert(data.message || "Failed to send OTP");
      btn.disabled = false;
      btn.textContent = "Send OTP to Email";
    }
  } catch(e) {
    alert("Network error. Is the server running on port 5001?");
    btn.disabled = false;
    btn.textContent = "Send OTP to Email";
  }
}

// ── Verify OTP ──
async function verifyOtp() {
  var email = document.getElementById("email").value.trim();
  var otp   = document.getElementById("otp-input").value.trim();
  if (!otp || otp.length !== 6) { alert("Please enter the 6-digit OTP."); return; }

  var btn = document.getElementById("verify-otp-btn");
  btn.disabled = true;
  btn.textContent = "Verifying...";

  try {
    var res  = await fetch(BASE_URL + "/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: email, otp: otp })
    });
    var data = await res.json();

    if (data.success) {
      otpVerified = true;
      document.getElementById("otp-section").innerHTML =
        '<p style="color:#2e7d32;font-weight:600;font-size:14px;padding:10px 0;">✅ Institute email verified!</p>';
      document.getElementById("otp-status").textContent = "";
    } else {
      alert(data.message || "Incorrect OTP");
      btn.disabled = false;
      btn.textContent = "Verify OTP";
    }
  } catch(e) {
    alert("Network error.");
    btn.disabled = false;
    btn.textContent = "Verify OTP";
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
      btn.disabled = false;
      btn.textContent = "Resend OTP";
    }
  }, 1000);
}

// ── Form Submit ──
document.getElementById("verifiedForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  if (!otpVerified) {
    alert("Please verify your institute email with OTP before submitting.");
    return;
  }

  var btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  try {
    var formData = new FormData(this);
    var res  = await fetch(BASE_URL + "/auth/verified-signup", { method: "POST", body: formData });
    var data = await res.json();

    if (data.success) {
      document.getElementById("formSection").style.display = "none";
      document.getElementById("backLink").style.display    = "none";
      document.getElementById("successMsg").style.display  = "block";
    } else {
      alert(data.message || "Something went wrong");
      btn.disabled = false;
      btn.textContent = "Submit for Verification";
    }
  } catch(err) {
    alert("Network error. Make sure the server is running on port 5001.");
    btn.disabled = false;
    btn.textContent = "Submit for Verification";
  }
});