const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");

// Config & DB
const { PORT } = require("./config/env");
const db = require("./db/connection");
const { initDB } = require("./db/init");

// Lib
const { uploadDir } = require("./lib/upload");

// Routes
const otpRoutes            = require("./routes/otp");
const authRoutes           = require("./routes/auth");
const adminRoutes          = require("./routes/admin");
const userRoutes           = require("./routes/users");
const messageRoutes        = require("./routes/messages");
const socialRoutes         = require("./routes/social");
const forgotPasswordRoutes = require("./routes/forgotPassword");
const companyRoutes        = require("./routes/company");
const jobRoutes            = require("./routes/jobs");

// WebSocket
const { initWebSocket } = require("./ws/socket");

// ================= APP SETUP =================
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../../Frontend")));
app.use("/uploads", express.static(uploadDir));

// ================= ROUTES =================
app.use("/otp",             otpRoutes);            // POST /otp/send, /otp/send-institute, /otp/verify
app.use("/auth",            authRoutes);           // POST /auth/signup, /auth/verified-signup, /auth/login, /auth/admin/login
app.use("/admin",           adminRoutes);          // GET/POST /admin/*
app.use("/users",           userRoutes);           // GET /users, GET /users/search
app.use("/messages",        messageRoutes);        // GET /messages/inbox/:id, /messages/:u1/:u2
app.use("/social",          socialRoutes);         // POST /social/block|unblock|report  GET /social/institutes
app.use("/forgot-password", forgotPasswordRoutes); // POST /forgot-password/send-otp|verify-otp|reset
app.use("/company",         companyRoutes);        // POST /company/register|login  GET/POST /company/jobs/*
app.use("/jobs",            jobRoutes);            // GET /jobs  POST /jobs/apply

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("EXPRESS ERROR:", err);
  if (err.code === "LIMIT_FILE_SIZE")
    return res.json({ success: false, message: "File too large. Max 5MB" });
  res.status(500).json({ success: false, message: err.message || "Server error" });
});

// ================= DATABASE + SERVER START =================
db.connect((err) => {
  if (err) { console.error("DB connection error:", err); process.exit(1); }
  console.log("Connected to MySQL");
  initDB();
});

const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
