const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { pool, initDatabase } = require("./database");

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "yiga-secret-key-2025-production";

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
initDatabase().catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
}

// Login route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM admins WHERE username = $1 AND password = $2",
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const admin = result.rows[0];
    const token = jwt.sign(
      { userId: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Submit application (PUBLIC - no auth)
app.post("/api/applications", async (req, res) => {
  try {
    const { full_name, email, phone, country, city, institution, program, motivation, experience } = req.body;

    const result = await pool.query(
      `INSERT INTO applications (full_name, email, phone, country, city, institution, program, motivation, experience, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [full_name, email, phone, country, city, institution, program, motivation, experience]
    );

    res.status(201).json({
      message: "Application submitted successfully",
      application: result.rows[0]
    });
  } catch (error) {
    console.error("Application submission error:", error);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

// Get all applications (ADMIN)
app.get("/api/applications", authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let query = "SELECT * FROM applications WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (status && status !== "all") {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR institution ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    
    res.json({
      applications: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error("Get applications error:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// Get application statistics
app.get("/api/applications/stats", authenticateToken, async (req, res) => {
  try {
    const totalResult = await pool.query("SELECT COUNT(*) FROM applications");
    const pendingResult = await pool.query("SELECT COUNT(*) FROM applications WHERE status = 'pending'");
    const approvedResult = await pool.query("SELECT COUNT(*) FROM applications WHERE status = 'approved'");
    const rejectedResult = await pool.query("SELECT COUNT(*) FROM applications WHERE status = 'rejected'");

    res.json({
      total: parseInt(totalResult.rows[0].count),
      pending: parseInt(pendingResult.rows[0].count),
      approved: parseInt(approvedResult.rows[0].count),
      rejected: parseInt(rejectedResult.rows[0].count)
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Update application status
app.put("/api/applications/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE applications SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json({ message: "Application updated", application: result.rows[0] });
  } catch (error) {
    console.error("Update application error:", error);
    res.status(500).json({ error: "Failed to update application" });
  }
});

// Get all admins (ADMIN)
app.get("/api/admins", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, username, name, role FROM admins ORDER BY id");
    res.json(result.rows);
  } catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

// Create new admin (SUPERADMIN only)
app.post("/api/admins", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Super admin access required" });
    }

    const { username, password, name, role } = req.body;

    const result = await pool.query(
      "INSERT INTO admins (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role",
      [username, password, name, role || "admin"]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create admin error:", error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Failed to create admin" });
  }
});

// Delete admin (SUPERADMIN only)
app.delete("/api/admins/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Super admin access required" });
    }

    const { id } = req.params;

    // Check if trying to delete yourself
    const adminResult = await pool.query("SELECT username FROM admins WHERE id = $1", [id]);
    if (adminResult.rows.length > 0 && adminResult.rows[0].username === req.user.username) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const result = await pool.query("DELETE FROM admins WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json({ message: "Admin deleted successfully" });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({ error: "Failed to delete admin" });
  }
});

// Newsletter subscription
app.post("/api/subscribe", async (req, res) => {
  try {
    const { email, fullName } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    console.log(`?? New subscriber: ${fullName || "Anonymous"} (${email})`);
    
    res.json({
      success: true,
      message: "Thank you for subscribing!"
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ error: "Subscription failed" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    message: "YIGA Backend is running with PostgreSQL!",
    database: "connected",
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`? YIGA Backend API running on port ${PORT}`);
  console.log(`? Using PostgreSQL database`);
  console.log(`? API available at: http://localhost:${PORT}`);
});

