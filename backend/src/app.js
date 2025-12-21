// backend/src/app.js
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const spaceRoutes = require('./routes/spaceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const app = express();

app.use(cors());
app.use(express.json());


// Basit health check
app.get("/", (req, res) => {
  res.send("Eorlingas backend is running 🚀");
});

// DB health check (isteğe bağlı)
app.get("/health/db", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    console.error("DB health check failed:", err);
    res.status(500).json({ ok: false });
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', require('./routes/bookingRoutes'));
module.exports = app;
