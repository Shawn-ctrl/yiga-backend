const express = require('express');
const { login, getProfile } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin'); // Adjust path if needed
const router = express.Router();

router.post('/login', login);
router.get('/profile', auth, getProfile);

// CREATE FIRST ADMIN (remove this route after creating admin!)
router.post('/create-first-admin', async (req, res) => {
  try {
    // Check if any admin exists
    const adminExists = await Admin.findOne();
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash('superadmin123', 10);
    const admin = new Admin({
      username: 'superadmin',
      password: hashedPassword,
      role: 'superadmin'
    });

    await admin.save();
    res.json({ message: 'Admin created successfully!', username: 'superadmin' });
  } catch (error) {
    res.status(500).json({ message: 'Error creating admin', error: error.message });
  }
});

module.exports = router;