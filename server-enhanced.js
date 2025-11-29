const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// Security middleware
app.use(helmet());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Simple in-memory database for demo (no MongoDB required)
let applications = [];
let admins = [
    { 
        id: 1, 
        username: "superadmin", 
        password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdC4SJc8EkzQOLa", // yiga2023
        name: "Super Administrator", 
        role: "superadmin",
        email: "admin@yiga.org"
    },
    { 
        id: 2, 
        username: "admin", 
        password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdC4SJc8EkzQOLa", // yiga2023
        name: "Administrator", 
        role: "admin",
        email: "admin@yiga.org"
    },
    { 
        id: 3, 
        username: "director", 
        password: "$2a$12$8S7.6V9mYbHwRcXpNqjRv.1V2KkL9mMxPwQzTfYbGcN3hJvWqLrOa", // program123
        name: "Program Director", 
        role: "admin",
        email: "programs@yiga.org"
    }
];

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || 
            file.mimetype === 'application/msword' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and Word documents are allowed'), false);
        }
    }
});

// Auth middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Simple token verification (in production, use JWT properly)
        const adminId = parseInt(token.replace('demo-token-', ''));
        const user = admins.find(a => a.id === adminId);
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Routes
app.post("/api/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = admins.find(a => a.username === username);

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Simple password check (in production, use bcrypt.compare)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = "demo-token-" + user.id;
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post("/api/applications", upload.single('resume'), async (req, res) => {
    try {
        const application = {
            id: applications.length + 1,
            ...req.body,
            resume: req.file ? req.file.filename : null,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        applications.push(application);
        res.status(201).json({ 
            message: 'Application submitted successfully', 
            application 
        });
    } catch (error) {
        console.error('Application submission error:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: 'Server error' });
    }
});

app.get("/api/applications", auth, async (req, res) => {
    try {
        const { status, search } = req.query;
        let filteredApplications = [...applications];
        
        if (status && status !== 'all') {
            filteredApplications = filteredApplications.filter(app => app.status === status);
        }
        
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
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get("/api/applications/stats", auth, async (req, res) => {
    try {
        const total = applications.length;
        const pending = applications.filter(a => a.status === 'pending').length;
        const approved = applications.filter(a => a.status === 'approved').length;
        const rejected = applications.filter(a => a.status === 'rejected').length;
        
        res.json({
            total,
            pending,
            approved,
            rejected,
            recent: applications.filter(a => {
                const daysAgo = (Date.now() - new Date(a.createdAt)) / (1000 * 60 * 60 * 24);
                return daysAgo <= 30;
            }).length
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put("/api/applications/:id", auth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const application = applications.find(a => a.id == req.params.id);
        
        if (application) {
            application.status = status;
            application.notes = notes;
            application.reviewedBy = req.user.name;
            application.reviewedAt = new Date().toISOString();
            res.json(application);
        } else {
            res.status(404).json({ message: 'Application not found' });
        }
    } catch (error) {
        console.error('Update application error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get("/api/files/:filename", auth, (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ message: 'File not found' });
    }
});

app.get("/api/health", (req, res) => {
    res.json({ 
        message: "YIGA Production Backend is running!",
        mode: "Enhanced Production (File uploads + Security)",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        applications: applications.length,
        features: ["File Uploads", "Security Headers", "Rate Limiting", "Admin Dashboard"]
    });
});

// Add sample data for demo
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
        createdAt: "2023-05-10T14:20:00.000Z",
        reviewedBy: "Super Administrator",
        reviewedAt: "2023-05-12T09:15:00.000Z"
    }
];

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("🚀 YIGA Production Backend running on port " + PORT);
    console.log("🛡️  Security: Enhanced with Helmet & Rate Limiting");
    console.log("💾 File uploads: Enabled");
    console.log("📊 Sample applications loaded: " + applications.length);
    console.log("🔑 Super Admin: superadmin / yiga2023");
    console.log("🔑 Admin: admin / yiga2023");
    console.log("🔑 Program Director: director / program123");
    console.log("🌐 API: http://localhost:" + PORT);
});
