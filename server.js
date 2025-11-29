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
  { id: 1, username: "superadmin", password: "yiga2023", name: "Super Admin", role: "superadmin" },
  { id: 2, username: "admin", password: "yiga2023", name: "Admin User", role: "admin" },
  { id: 3, username: "director", password: "program123", name: "Program Director", role: "admin" }
];

// Auth routes
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const admin = admins.find(a => a.username === username && a.password === password);
  
  if (admin) {
    const token = "demo-token-" + admin.id;
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
  if (!token || !token.includes("demo-token-1")) { // Only super admin (id: 1)
    return res.status(403).json({ message: "Super admin access required" });
  }
  res.json(admins.filter(admin => admin.id !== 1)); // Don't return super admin itself
});

app.post("/api/admins", (req, res) => {
  const token = req.headers.authorization;
  if (!token || !token.includes("demo-token-1")) {
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
  console.log("🚀 YIGA Backend running on port " + PORT);
  console.log("📊 Demo mode - using in-memory database");
  console.log("🔑 Super Admin: superadmin / yiga2023");
  console.log("🔑 Admin: admin / yiga2023"); 
  console.log("🔑 Program Director: director / program123");
  console.log("📝 Sample applications loaded: " + applications.length);
  console.log("🌐 API available at: http://localhost:" + PORT);
});
