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

const app = express();
const PORT = process.env.PORT || 8080;

// IMPORTANT: Trust Railway proxy BEFORE any other middleware
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiter configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URL = process.env.MONGO_URL || "mongodb://mongo:DeMnepiuyvRbBOviDcTjaOywPCYiYDwK@tramway.proxy.rlwy.net:21045";
const JWT_SECRET = process.env.JWT_SECRET || "yiga_super_secret_jwt_key_2025_minimum_32_characters_long_for_security";

mongoose.connect(MONGO_URL, {
    authSource: "admin",
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

// User Model
const User = require('./models/User');

// Application Model (MongoDB)
const applicationSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    institution: { type: String, required: true },
    position: String,
    interestArea: String,
    experience: String,
    motivation: String,
    resume: String,
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    reviewedBy: String,
    reviewedAt: Date,
    notes: String
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema);

// File upload setup
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, "resume-" + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error("Invalid file type"));
    }
});

// Authentication Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Invalid or inactive user' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Super Admin Middleware
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Super admin access required' });
    }
    next();
};

// Health Check
app.get("/api/health", async (req, res) => {
    try {
        const appCount = await Application.countDocuments();
        res.json({
            message: "YIGA Production Backend is running!",
            mode: "Production (MongoDB + File uploads + Security)",
            timestamp: new Date(),
            version: "2.0.3",
            applications: appCount,
            features: ["MongoDB Auth", "File Uploads", "Security Headers", "Rate Limiting", "Admin Dashboard"]
        });
    } catch (error) {
        res.status(500).json({ message: "Health check failed", error: error.message });
    }
});

// ============================================
// AUTH ROUTES
// ============================================

app.post("/api/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }

        const user = await User.findOne({ username });
        
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await user.comparePassword(password);
        
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
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

app.get("/api/auth/me", auth, async (req, res) => {
    res.json({
        id: req.user._id,
        username: req.user.username,
        name: req.user.name,
        role: req.user.role
    });
});

// ============================================
// APPLICATIONS ROUTES
// ============================================

// Get all applications (with filtering)
app.get("/api/applications", auth, async (req, res) => {
    try {
        const { status, search } = req.query;
        let query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { institution: { $regex: search, $options: 'i' } }
            ];
        }

        const applications = await Application.find(query).sort({ createdAt: -1 });

        res.json({
            applications,
            total: applications.length
        });
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get single application
app.get("/api/applications/:id", auth, async (req, res) => {
    try {
        const application = await Application.findById(req.params.id);
        
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        res.json(application);
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create application (public endpoint for students)
app.post("/api/applications", upload.single('resume'), async (req, res) => {
    try {
        const { fullName, email, phone, institution, position, interestArea, experience, motivation } = req.body;

        const application = new Application({
            fullName,
            email,
            phone,
            institution,
            position,
            interestArea,
            experience,
            motivation,
            resume: req.file ? req.file.filename : null
        });

        await application.save();

        res.status(201).json({
            message: 'Application submitted successfully',
            application
        });
    } catch (error) {
        console.error('Error creating application:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update application status
app.put("/api/applications/:id", auth, async (req, res) => {
    try {
        const { status, notes } = req.body;

        const application = await Application.findByIdAndUpdate(
            req.params.id,
            {
                status,
                notes,
                reviewedAt: new Date(),
                reviewedBy: req.user.name
            },
            { new: true }
        );

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        res.json(application);
    } catch (error) {
        console.error('Error updating application:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete application
app.delete("/api/applications/:id", auth, async (req, res) => {
    try {
        const application = await Application.findByIdAndDelete(req.params.id);
        
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Delete associated file
        if (application.resume) {
            const filepath = path.join(uploadDir, application.resume);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        }

        res.json({ message: 'Application deleted successfully' });
    } catch (error) {
        console.error('Error deleting application:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get application statistics
app.get("/api/applications/stats/summary", auth, async (req, res) => {
    try {
        const total = await Application.countDocuments();
        const pending = await Application.countDocuments({ status: 'pending' });
        const approved = await Application.countDocuments({ status: 'approved' });
        const rejected = await Application.countDocuments({ status: 'rejected' });

        res.json({
            total,
            pending,
            approved,
            rejected
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// ADMIN MANAGEMENT ROUTES
// ============================================

// Get all admins (super admin only)
app.get("/api/admins", auth, requireSuperAdmin, async (req, res) => {
    try {
        const admins = await User.find()
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.json({ admins });
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new admin (super admin only)
app.post("/api/admins", auth, requireSuperAdmin, async (req, res) => {
    try {
        const { username, password, name, role } = req.body;

        if (!username || !password || !name) {
            return res.status(400).json({ 
                message: 'Username, password, and name are required' 
            });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ 
                message: 'Username already exists' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                message: 'Password must be at least 6 characters' 
            });
        }

        const newAdmin = new User({
            username,
            password,
            name,
            role: role || 'admin',
            isActive: true
        });

        await newAdmin.save();

        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                id: newAdmin._id,
                username: newAdmin.username,
                name: newAdmin.name,
                role: newAdmin.role,
                isActive: newAdmin.isActive
            }
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
});

// Toggle admin active status
app.put("/api/admins/:id/toggle", auth, requireSuperAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ 
                message: 'Cannot disable your own account' 
            });
        }

        const admin = await User.findById(req.params.id);
        
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        admin.isActive = !admin.isActive;
        await admin.save();

        res.json({
            message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
            admin: {
                id: admin._id,
                username: admin.username,
                name: admin.name,
                role: admin.role,
                isActive: admin.isActive
            }
        });
    } catch (error) {
        console.error('Error toggling admin:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete admin
app.delete("/api/admins/:id", auth, requireSuperAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ 
                message: 'Cannot delete your own account' 
            });
        }

        const admin = await User.findByIdAndDelete(req.params.id);
        
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        res.json({ 
            message: 'Admin deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// FILE SERVING
// ============================================

app.use("/api/uploads", express.static(uploadDir));

app.get("/api/files/:filename", auth, (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ message: 'File not found' });
    }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 YIGA Production Backend running on port ${PORT}`);
    console.log(`🛡️  Security: Enhanced with Helmet & Rate Limiting`);
    console.log(`💾 Database: MongoDB connected`);
    console.log(`📁 File uploads: Enabled`);
    console.log(`🔐 Secure authentication enabled`);
    console.log(`🌐 API: http://localhost:${PORT}`);
    
    // Seed sample applications on startup (only if none exist)
    Application.countDocuments().then(count => {
        if (count === 0) {
            const sampleApps = [
                {
                    fullName: "John Smith",
                    email: "john.smith@example.com",
                    phone: "+254700000001",
                    institution: "University of Nairobi",
                    position: "Student Leader",
                    interestArea: "foreign-policy",
                    experience: "3 years in student governance",
                    motivation: "I want to contribute to global policy discussions",
                    status: "pending"
                },
                {
                    fullName: "Maria Garcia",
                    email: "maria.garcia@example.com",
                    phone: "+254700000002",
                    institution: "Kenyatta University",
                    position: "Climate Activist",
                    interestArea: "climate",
                    experience: "Climate activist with 2 years experience",
                    motivation: "Passionate about environmental justice",
                    status: "approved",
                    reviewedBy: "Super Administrator"
                },
                {
                    fullName: "David Chen",
                    email: "david.chen@example.com",
                    phone: "+254700000003",
                    institution: "Strathmore University",
                    position: "Research Assistant",
                    interestArea: "technology",
                    experience: "AI research and development",
                    motivation: "Building tech solutions for Africa",
                    status: "pending"
                }
            ];
            
            Application.insertMany(sampleApps)
                .then(() => console.log(`📊 Sample applications loaded: ${sampleApps.length}`))
                .catch(err => console.error('Error loading sample apps:', err));
        }
    });
});
