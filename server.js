// Railway Force Deploy: 2025-12-04 12:00:45
// DEPLOYMENT TIMESTAMP: 2025-12-04 11:49:33 - FORCE REBUILD
// DEPLOYMENT TIMESTAMP: 2025-12-04 11:45:18 - FORCE REBUILD
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory database for demo
let applications = [];
let admins = [
  { id: 1, username: "superadmin", password: "Yiga2023", name: "Super Admin", role: "superadmin" },
  { id: 2, username: "admin", password: "yiga2023", name: "Admin User", role: "admin" },
  { id: 3, username: "director", password: "program123", name: "Program Director", role: "admin" },
  { id: 4, username: "jeremy.oronje", password: "Jeremy@2024!", name: "Jeremy Oronje", role: "superadmin" },
  { id: 5, username: "phoebe.monari", password: "Phoebe@2024!", name: "Phoebe Monari", role: "admin" },
  { id: 6, username: "catherine.mbilo", password: "Catherine@2024!", name: "Catherine Mbilo", role: "admin" },
  { id: 7, username: "hilda.koipano", password: "Hilda@2024!", name: "Hilda Koipano", role: "admin" },
  { id: 8, username: "abel.omenge", password: "Abel@2024!", name: "Abel Omenge", role: "admin" },
  { id: 9, username: "beldine.mukami", password: "Beldine@2024!", name: "Beldine Mukami", role: "admin" },
  { id: 10, username: "Shawn", password: "Yiga2023", name: "Shawn Ndombi", role: "superadmin" }
];

// Auth routes

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
}

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const admin = admins.find(a => a.username === username && a.password === password);
  
  if (admin) {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: admin.id, username: admin.username, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        id: admin.id, 
        username: admin.username, 
        name: admin.name, 
        role: admin.role 
      } 
    });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

// Application routes
app.post("/api/applications", (req, res) => {
  const application = {
    id: applications.length + 1,
    ...req.body,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  applications.push(application);
  res.status(201).json({ message: "Application submitted successfully", application });
});

app.get("/api/applications", (req, res) => {
  // Simple auth check
  const token = req.headers.authorization;
  if (!token || !token.includes("demo-token")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const { status, search } = req.query;
  let filteredApplications = [...applications];
  
  // Filter by status
  if (status && status !== "all") {
    filteredApplications = filteredApplications.filter(app => app.status === status);
  }
  
  // Search by name, email, or institution
  if (search) {
    filteredApplications = filteredApplications.filter(app => 
      app.fullName.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase()) ||
      app.institution.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  res.json({ 
    applications: filteredApplications, 
    total: filteredApplications.length 
  });
});

app.get("/api/applications/stats", (req, res) => {
  const pending = applications.filter(a => a.status === "pending").length;
  const approved = applications.filter(a => a.status === "approved").length;
  const rejected = applications.filter(a => a.status === "rejected").length;
  
  // Applications by interest area
  const byInterest = {};
  applications.forEach(app => {
    byInterest[app.interestArea] = (byInterest[app.interestArea] || 0) + 1;
  });
  
  res.json({
    total: applications.length,
    pending,
    approved,
    rejected,
    byInterest,
    recent: applications.filter(a => {
      const daysAgo = (Date.now() - new Date(a.createdAt)) / (1000 * 60 * 60 * 24);
      return daysAgo <= 30;
    }).length
  });
});

app.put("/api/applications/:id", (req, res) => {
  const { status, notes } = req.body;
  const application = applications.find(a => a.id == req.params.id);
  
  if (application) {
    application.status = status;
    if (notes) application.notes = notes;
    res.json(application);
  } else {
    res.status(404).json({ message: "Application not found" });
  }
});

// Admin management (super admin only)
app.get("/api/admins", (req, res) => {
  const token = req.headers.authorization;
  if (!req.user || req.user.role !== "superadmin") { // Only super admin (id: 1)
    return res.status(403).json({ message: "Super admin access required" });
  }
  res.json(admins.filter(admin => admin.id !== 1)); // Don't return super admin itself
});

app.post("/api/admins", (req, res) => {
  const token = req.headers.authorization;
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ message: "Super admin access required" });
  }
  
  const { username, password, name, role } = req.body;
  const newAdmin = {
    id: admins.length + 1,
    username,
    password,
    name,
    role: role || "admin"
  };
  admins.push(newAdmin);
  res.status(201).json(newAdmin);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    message: "YIGA Backend is running!",
    mode: "Demo (In-memory database)",
    timestamp: new Date().toISOString()
  });
});

// Add some sample applications for demo
applications = [
  {
    id: 1,
    fullName: "John Smith",
    email: "john.smith@example.com",
    phone: "+254700000001",
    institution: "University of Nairobi",
    position: "Student Leader",
    interestArea: "foreign-policy",
    experience: "3 years in student governance",
    motivation: "I want to contribute to global policy discussions",
    status: "pending",
    createdAt: "2023-05-15T10:30:00.000Z"
  },
  {
    id: 2,
    fullName: "Maria Garcia",
    email: "maria.garcia@example.com",
    phone: "+254700000002",
    institution: "Kenyatta University",
    position: "Climate Activist",
    interestArea: "climate",
    experience: "Climate activist with 2 years experience",
    motivation: "Passionate about environmental justice",
    status: "approved",
    createdAt: "2023-05-10T14:20:00.000Z"
  },
  {
    id: 3,
    fullName: "Ahmed Khan",
    email: "ahmed.khan@example.com",
    phone: "+254700000003",
    institution: "Strathmore University",
    position: "Governance Intern",
    interestArea: "governance",
    experience: "Intern at a governance NGO",
    motivation: "I believe in transparent and accountable governance",
    status: "pending",
    createdAt: "2023-05-05T09:15:00.000Z"
  }
];

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("?? YIGA Backend running on port " + PORT);
  console.log("?? Demo mode - using in-memory database");
  console.log("?? Super Admin: superadmin / yiga2023");
  console.log("?? Admin: admin / yiga2023"); 
  console.log("?? Program Director: director / program123");
  console.log("?? Sample applications loaded: " + applications.length);
  console.log("?? API available at: http://localhost:" + PORT);
});



// Dashboard statistics
app.get("/api/stats", authenticateToken, (req, res) => {
  try {
    const stats = {
      totalApplications: applications.length,
      pendingApplications: applications.filter(app => app.status === "pending").length,
      approvedApplications: applications.filter(app => app.status === "approved").length,
      rejectedApplications: applications.filter(app => app.status === "rejected").length,
      totalAdmins: admins.length,
      recentApplications: applications.slice(-5).reverse()
    };
    
    res.json(stats);
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});


// Users endpoint (alias for admins list)
app.get("/api/users", authenticateToken, (req, res) => {
  try {
    // Only superadmins can see all users
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied. Superadmin only." });
    }
    
    // Return admins without passwords
    const users = admins.map(admin => ({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role
    }));
    
    res.json(users);
  } catch (error) {
    console.error("Users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Newsletter subscription
app.post("/api/subscribe", async (req, res) => {
  try {
    const { email, fullName } = req.body;

    // Basic validation
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    // In demo mode, just return success
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