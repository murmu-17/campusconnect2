const bcrypt = require("bcrypt");
const db = require("./connection");

// ================= TABLE CREATION =================
function initDB() {
  db.query(
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150),
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(20) UNIQUE,
      password VARCHAR(255) NOT NULL,
      account_type ENUM('general','verified') DEFAULT 'general',
      institute VARCHAR(100),
      batch INT,
      degree VARCHAR(50),
      branch VARCHAR(100),
      document_path VARCHAR(255),
      verification_status ENUM('approved','pending','rejected') DEFAULT 'approved',
      disparity_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Users table:", err.message);
      else {
        console.log("Users table ready");
        db.query(
          "SHOW COLUMNS FROM users LIKE 'user_subtype'",
          (checkErr, columns) => {
            if (checkErr) {
              console.error("Users subtype column check:", checkErr.message);
              return;
            }
            if (columns.length > 0) {
              console.log("Users subtype column ready");
              return;
            }
            db.query(
              "ALTER TABLE users ADD COLUMN user_subtype ENUM('student','alumni') DEFAULT NULL AFTER account_type",
              (alterErr) => {
                if (alterErr) console.error("Users subtype column:", alterErr.message);
                else console.log("Users subtype column ready");
              }
            );
          }
        );
      }
    }
  );

  db.query(
    `CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('superadmin','verifier') DEFAULT 'verifier',
      is_active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) { console.error("Admins table:", err.message); return; }
      console.log("Admins table ready");
      createDefaultSuperAdmin();
    }
  );

  db.query(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT,
      admin_name VARCHAR(100),
      admin_role VARCHAR(20),
      action VARCHAR(255),
      target_user_id INT,
      target_user_name VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Logs table:", err.message);
      else console.log("Logs table ready");
    }
  );

  db.query(
    `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      content TEXT NOT NULL,
      is_read TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (err) => {
      if (err) console.error("Messages table:", err.message);
      else console.log("Messages table ready");
    }
  );

  db.query(
    `CREATE TABLE IF NOT EXISTS blocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      blocker_id INT NOT NULL,
      blocked_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_block (blocker_id, blocked_id),
      FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (err) => {
      if (err) console.error("Blocks table:", err.message);
      else console.log("Blocks table ready");
    }
  );

  db.query(
    `CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id INT NOT NULL,
      reported_id INT NOT NULL,
      reason VARCHAR(255) NOT NULL,
      details TEXT,
      status ENUM('pending','reviewed','resolved') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (err) => {
      if (err) console.error("Reports table:", err.message);
      else console.log("Reports table ready");
    }
  );

  db.query(
    `CREATE TABLE IF NOT EXISTS institutes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) UNIQUE NOT NULL,
      category ENUM('IIT','NIT','IIIT','Other') DEFAULT 'IIT',
      is_enabled TINYINT DEFAULT 0,
      display_order INT DEFAULT 99,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Institutes table:", err.message);
      else { console.log("Institutes table ready"); seedInstitutes(); }
    }
  );

  // ================= COMPANIES =================
  db.query(
    `CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      website VARCHAR(255),
      password VARCHAR(255) NOT NULL,
      description TEXT,
      industry VARCHAR(100),
      document_path VARCHAR(255),
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      rejection_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Companies table:", err.message);
      else console.log("Companies table ready");
    }
  );

  // ================= JOBS =================
  db.query(
    `CREATE TABLE IF NOT EXISTS jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      type ENUM('internship','fulltime','parttime','contract') DEFAULT 'internship',
      location VARCHAR(150),
      stipend VARCHAR(100),
      duration VARCHAR(100),
      description TEXT NOT NULL,
      status ENUM('active','closed') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    )`,
    (err) => {
      if (err) console.error("Jobs table:", err.message);
      else console.log("Jobs table ready");
    }
  );

  // ================= APPLICATIONS =================
  db.query(
    `CREATE TABLE IF NOT EXISTS applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_id INT NOT NULL,
      student_id INT NOT NULL,
      cover_letter TEXT,
      resume_path VARCHAR(255),
      status ENUM('pending','accepted','rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_application (job_id, student_id)
    )`,
    (err) => {
      if (err) console.error("Applications table:", err.message);
      else console.log("Applications table ready");
    }
  );
}

// ================= DEFAULT SUPERADMIN =================
async function createDefaultSuperAdmin() {
  db.query("SELECT id FROM admins WHERE role='superadmin' LIMIT 1", async (err, result) => {
    if (err || result.length > 0) return;
    const hash = await bcrypt.hash("Rajesh12!!", 10);
    db.query(
      "INSERT INTO admins (name,email,password,role) VALUES (?,?,?,?)",
      ["Raj M", "RajM@campusconnect.in", hash, "superadmin"],
      (err) => { if (!err) console.log("Default superadmin created"); }
    );
  });
}

// ================= SEED INSTITUTES =================
function seedInstitutes() {
  const iits = [
    { name: "IIT Mandi",          order: 1,  enabled: 1 },
    { name: "IIT Bombay",         order: 2,  enabled: 0 },
    { name: "IIT Delhi",          order: 3,  enabled: 0 },
    { name: "IIT Madras",         order: 4,  enabled: 0 },
    { name: "IIT Kanpur",         order: 5,  enabled: 0 },
    { name: "IIT Kharagpur",      order: 6,  enabled: 0 },
    { name: "IIT Roorkee",        order: 7,  enabled: 0 },
    { name: "IIT Guwahati",       order: 8,  enabled: 0 },
    { name: "IIT Hyderabad",      order: 9,  enabled: 0 },
    { name: "IIT Patna",          order: 10, enabled: 0 },
    { name: "IIT Jodhpur",        order: 11, enabled: 0 },
    { name: "IIT Indore",         order: 12, enabled: 0 },
    { name: "IIT Gandhinagar",    order: 13, enabled: 0 },
    { name: "IIT Ropar",          order: 14, enabled: 0 },
    { name: "IIT Bhubaneswar",    order: 15, enabled: 0 },
    { name: "IIT Tirupati",       order: 16, enabled: 0 },
    { name: "IIT Dhanbad (ISM)",  order: 17, enabled: 0 },
    { name: "IIT Varanasi (BHU)", order: 18, enabled: 0 },
    { name: "IIT Palakkad",       order: 19, enabled: 0 },
    { name: "IIT Dharwad",        order: 20, enabled: 0 },
    { name: "IIT Bhilai",         order: 21, enabled: 0 },
    { name: "IIT Goa",            order: 22, enabled: 0 },
    { name: "IIT Jammu",          order: 23, enabled: 0 },
  ];

  const nits = [
    { name: "NIT Trichy",    order: 24 },
    { name: "NIT Warangal",  order: 25 },
    { name: "NIT Surathkal", order: 26 },
    { name: "NIT Calicut",   order: 27 },
    { name: "NIT Rourkela",  order: 28 },
    { name: "NIT Allahabad", order: 29 },
    { name: "NIT Bhopal",    order: 30 },
    { name: "NIT Silchar",   order: 31 },
    { name: "NIT Durgapur",  order: 32 },
    { name: "NIT Jaipur",    order: 33 },
  ];

  const iiits = [
    { name: "IIIT Hyderabad",    order: 40 },
    { name: "IIIT Allahabad",    order: 41 },
    { name: "IIIT Bangalore",    order: 42 },
    { name: "IIIT Delhi",        order: 43 },
    { name: "IIIT Gwalior",      order: 44 },
    { name: "IIIT Jabalpur",     order: 45 },
    { name: "IIIT Kancheepuram", order: 46 },
    { name: "IIIT Lucknow",      order: 47 },
    { name: "IIIT Pune",         order: 48 },
    { name: "IIIT Vadodara",     order: 49 },
  ];

  const others = [
    { name: "IISER Pune",               order: 60 },
    { name: "IISER Kolkata",            order: 61 },
    { name: "IISER Mohali",             order: 62 },
    { name: "IISER Bhopal",             order: 63 },
    { name: "IISER Thiruvananthapuram", order: 64 },
    { name: "IISER Tirupati",           order: 65 },
    { name: "IISER Berhampur",          order: 66 },
    { name: "NISER Bhubaneswar",        order: 67 },
    { name: "IISc Bangalore",           order: 68 },
  ];

  iits.forEach(({ name, order, enabled }) => {
    db.query(
      "INSERT IGNORE INTO institutes (name,category,is_enabled,display_order) VALUES (?,'IIT',?,?)",
      [name, enabled, order],
      (err) => { if (err) console.error("Seed IIT:", err.message); }
    );
  });

  nits.forEach(({ name, order }) => {
    db.query(
      "INSERT IGNORE INTO institutes (name,category,is_enabled,display_order) VALUES (?,'NIT',0,?)",
      [name, order],
      (err) => { if (err) console.error("Seed NIT:", err.message); }
    );
  });

  iiits.forEach(({ name, order }) => {
    db.query(
      "INSERT IGNORE INTO institutes (name,category,is_enabled,display_order) VALUES (?,'IIIT',0,?)",
      [name, order],
      (err) => { if (err) console.error("Seed IIIT:", err.message); }
    );
  });

  others.forEach(({ name, order }) => {
    db.query(
      "INSERT IGNORE INTO institutes (name,category,is_enabled,display_order) VALUES (?,'Other',0,?)",
      [name, order],
      (err) => { if (err) console.error("Seed Other:", err.message); }
    );
  });

  db.query(
    "UPDATE institutes SET category='Other' WHERE name LIKE 'IISER%' OR name='NISER Bhubaneswar'",
    (err) => { if (err) console.error("Category fix:", err.message); }
  );
}

module.exports = { initDB };
