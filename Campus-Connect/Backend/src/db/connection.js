const mysql = require("mysql2");
const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = require("../config/env");

const db = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  multipleStatements: false,
});

db.connect(function(err) {
  if (err) { console.error("MySQL connection error:", err); return; }
  db.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'", function(err) {
    if (err) console.error("sql_mode error:", err);
  });
});

module.exports = db;