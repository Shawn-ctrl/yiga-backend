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
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true // Trust Railway proxy
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL || process.env.DATABASE_URL)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Import User model (ONLY ONCE!)
const User = require('./models/User');

// Simple in-memory database for applications
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
            user: {
                id: user._id,
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

// Admin Management Routes
app.get("/api/admins", auth, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const admins = await User.find({}, '-password');
        res.json({ admins });
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post("/api/admins", auth, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { username, password, name, role } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const admin = new User({
            username,
            password, // Will be hashed by pre-save hook
            name,
            role: role || 'admin',
            isActive: true
        });

        await admin.save();

        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                id: admin._id,
                username: admin.username,
                name: admin.name,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete("/api/admins/:id", auth, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        console.error('Delete admin error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put("/api/admins/:id/toggle", auth, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot deactivate your own account' });
        }

        const admin = await User.findById(req.params.id);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        admin.isActive = !admin.isActive;
        await admin.save();

        res.json({
            message: 'Admin status updated',
            admin: {
                id: admin._id,
                username: admin.username,
                name: admin.name,
                role: admin.role,
                isActive: admin.isActive
            }
        });
    } catch (error) {
        console.error('Toggle admin error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Application Routes
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

app.delete("/api/applications/:id", auth, async (req, res) => {
    try {
        const index = applications.findIndex(a => a.id == req.params.id);
        
        if (index !== -1) {
            const application = applications[index];
            
            // Delete resume file if exists
            if (application.resume) {
                const filePath = path.join(__dirname, 'uploads', application.resume);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            
            applications.splice(index, 1);
            res.json({ message: 'Application deleted successfully' });
        } else {
            res.status(404).json({ message: 'Application not found' });
        }
    } catch (error) {
        console.error('Delete application error:', error);
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
        mode: "Production (MongoDB + File uploads + Security)",
        timestamp: new Date().toISOString(),
        version: "2.0.2",
        applications: applications.length,
        features: ["MongoDB Auth", "File Uploads", "Security Headers", "Rate Limiting", "Admin Dashboard"]
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
    console.log("💾 Database: MongoDB connected");
    console.log("📁 File uploads: Enabled");
    console.log("📊 Sample applications loaded: " + applications.length);
    console.log("🔐 Secure authentication enabled");
    console.log("🌐 API: http://localhost:" + PORT);
});
