const BASE_URL = "http://localhost:5001";

var otpVerified = false;
var otpTarget   = "";
var resendTimer = null;

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(function(btn, i) {
    btn.classList.toggle("active", (i===0&&tab==="email")||(i===1&&tab==="phone"));
  });
  document.getElementById("panel-email").classList.toggle("active", tab==="email");
  document.getElementById("panel-phone").classList.toggle("active", tab==="phone");
  resetOtpState();
}

function resetOtpState() {
  otpVerified = false;
  otpTarget   = "";
  ["otp-section-email","otp-section-phone"].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  ["otp-status-email","otp-status-phone"].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

// ── Send OTP ──
async function sendOtp(type) {
  var contactField = type === "email"
    ? document.getElementById("g_email").value.trim()
    : document.getElementById("p_phone").value.trim();

  if (!contactField) {
    alert("Please enter your " + (type==="email" ? "email address" : "phone number") + " first.");
    return;
  }

  var btn = document.getElementById("send-otp-btn-" + type);
  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    var body = type === "email" ? { email: contactField } : { phone: contactField };
    var res  = await fetch(BASE_URL + "/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var data = await res.json();

    if (data.success) {
      otpTarget = contactField;
      document.getElementById("otp-section-" + type).style.display = "block";
      document.getElementById("otp-status-" + type).textContent = "✓ OTP sent to " + contactField;
      document.getElementById("otp-status-" + type).style.color = "#2e7d32";
      btn.textContent = "Resend OTP";
      startResendTimer(btn);

      if (data.dev_otp) {
        alert("DEV MODE: Your OTP is " + data.dev_otp + "\n(Configure email/SMS to send automatically)");
      }
    } else {
      alert(data.message || "Failed to send OTP");
      btn.disabled = false;
      btn.textContent = "Send OTP";
    }
  } catch(e) {
    alert("Network error. Is the server running on port 5001?");
    btn.disabled = false;
    btn.textContent = "Send OTP";
  }
}

// ── Verify OTP ──
async function verifyOtp(type) {
  var otp = document.getElementById("otp-input-" + type).value.trim();
  if (!otp || otp.length !== 6) { alert("Please enter the 6-digit OTP."); return; }

  var btn = document.getElementById("verify-otp-btn-" + type);
  btn.disabled = true;
  btn.textContent = "Verifying...";

  try {
    var res = await fetch(BASE_URL + "/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: otpTarget, otp: otp })
    });
    var data = await res.json();

    if (data.success) {
      otpVerified = true;
      document.getElementById("otp-status-" + type).textContent = "✓ " + (type==="email" ? "Email" : "Phone") + " verified!";
      document.getElementById("otp-status-" + type).style.color = "#2e7d32";
      document.getElementById("otp-section-" + type).innerHTML =
        '<p style="color:#2e7d32;font-weight:600;font-size:14px;margin:8px 0;">✅ ' + (type==="email" ? "Email" : "Phone") + ' verified successfully!</p>';
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

// ── Resend countdown ──
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

// ── Submit Signup ──
async function submitSignup(payload, btnId) {
  if (!otpVerified) {
    alert("Please verify your " + (payload.email ? "email" : "phone number") + " with OTP first.");
    return;
  }

  var btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.textContent = "Creating account...";

  try {
    var res = await fetch(BASE_URL + "/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    var data = await res.json();

    if (data.success) {
      alert("Account created successfully! You can now log in. ✅");
      window.location.href = "login.html";
    } else {
      alert(data.message || "Something went wrong");
      btn.disabled = false;
      btn.textContent = "Create Account";
    }
  } catch(err) {
    alert("Network error. Make sure the server is running on port 5001.");
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

document.getElementById("emailForm").addEventListener("submit", function(e) {
  e.preventDefault();
  submitSignup({
    full_name: document.getElementById("g_name").value,
    email:     document.getElementById("g_email").value,
    password:  document.getElementById("g_password").value
  }, "emailBtn");
});

document.getElementById("phoneForm").addEventListener("submit", function(e) {
  e.preventDefault();
  submitSignup({
    full_name: document.getElementById("p_name").value,
    phone:     document.getElementById("p_phone").value,
    password:  document.getElementById("p_password").value
  }, "phoneBtn");
});