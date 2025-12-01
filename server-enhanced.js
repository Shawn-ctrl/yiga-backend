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

// Trust proxy for Railway
app.set('trust proxy', 1);

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

// Connect to MongoDB - FIXED WITH authSource
mongoose.connect('mongodb://mongo:DeMnepiuyvRbBOviDcTjaOywPCYiYDwK@tramway.proxy.rlwy.net:21045/test?authSource=admin')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Import User model
const User = require('./models/User');

// Simple in-memory database for applications (you can migrate this to MongoDB later)
let applications = [];

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

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id);
        
        if (!user || !user.isActive) {
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
        const user = await User.findOne({ username, isActive: true });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            username: user.username,
            role: user.role
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
        res.json(applications);
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put("/api/applications/:id", auth, async (req, res) => {
    try {
        const { status } = req.body;
        const application = applications.find(a => a.id == req.params.id);
        
        if (application) {
            application.status = status;
            res.json(application);
        } else {
            res.status(404).json({ message: 'Application not found' });
        }
    } catch (error) {
        console.error('Update application error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete("/api/applications/:id", auth, async (req, res) => {
    try {
        const index = applications.findIndex(a => a.id == req.params.id);
        if (index > -1) {
            applications.splice(index, 1);
            res.json({ message: 'Application deleted' });
        } else {
            res.status(404).json({ message: 'Application not found' });
        }
    } catch (error) {
        console.error('Delete application error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get("/api/health", (req, res) => {
    res.json({ 
        message: "YIGA Production Backend is running!",
        mode: "Production (MongoDB + File uploads + Security)",
        timestamp: new Date().toISOString(),
        version: "2.0.1",
        applications: applications.length,
        features: ["MongoDB Auth", "File Uploads", "Security Headers", "Rate Limiting", "Admin Dashboard"]
    });
});

// Add sample data for demo
applications = [
    {
        id: 1,
        full_name: "John Smith",
        email: "john.smith@example.com",
        phone: "+254700000001",
        country: "Kenya",
        program: "Foreign Policy",
        motivation: "I want to contribute to global policy discussions",
        status: "pending",
        createdAt: "2023-05-15T10:30:00.000Z"
    },
    {
        id: 2,
        full_name: "Maria Garcia",
        email: "maria.garcia@example.com",
        phone: "+254700000002",
        country: "Kenya",
        program: "Climate Change",
        motivation: "Passionate about environmental justice",
        status: "approved",
        createdAt: "2023-05-10T14:20:00.000Z"
    }
];

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("🚀 YIGA Production Backend running on port " + PORT);
    console.log("🛡️  Security: Enhanced with Helmet & Rate Limiting");
    console.log("💾 Database: MongoDB connected");
    console.log("📁 File uploads: Enabled");
    console.log("📊 Sample applications loaded: " + applications.length);
    console.log("🔐 Secure authentication enabled");
    console.log("🌐 API: http://localhost:" + PORT);
});
