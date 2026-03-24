const BASE_URL = "https://conncam.in";

// ================= LOGIN =================
async function login() {
  const identifier = document.getElementById("identifier").value.trim();
  const password   = document.getElementById("password").value;

  if (!identifier || !password) { alert("Please fill all fields ❌"); return; }

  const btn = document.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Logging in...";

  try {
    const res  = await fetch(BASE_URL + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "dashboard.html";
    } else {
      alert(data.message || "Login failed ❌");
      btn.disabled = false;
      btn.textContent = "Log In";
    }
  } catch (err) {
    alert("Network error. Is the server running on port 5001?");
    btn.disabled = false;
    btn.textContent = "Log In";
  }
}

// Enter key support
document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll("input").forEach(function(input) {
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter") login();
    });
  });
});