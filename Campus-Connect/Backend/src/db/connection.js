const mysql = require("mysql2");
const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = require("../config/env");

const db = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
});

module.exports = db;
