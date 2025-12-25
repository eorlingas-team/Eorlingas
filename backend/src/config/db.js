// backend/src/config/db.js
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
<<<<<<< HEAD
  options: "-c timezone=Europe/Istanbul",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, 
  ...((process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('render.com')) && {
    ssl: {
      rejectUnauthorized: false   // Render için şart
    }
  })
=======
  ssl: {
    rejectUnauthorized: false   // Render için şart
  }
>>>>>>> origin/main
});

pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("PostgreSQL connection error:", err);
});

<<<<<<< HEAD
module.exports = pool;
=======
module.exports = pool;
>>>>>>> origin/main
