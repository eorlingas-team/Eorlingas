// backend/src/config/db.js
const { Pool } = require("pg");
const path = require("path");

// .env dosyasını garanti bul
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on("connect", () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log("✅ Veritabanına bağlandı");
  }
});


module.exports = pool;