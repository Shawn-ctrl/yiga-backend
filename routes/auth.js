const express = require('express');
const { login, getProfile } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.post('/login', login);
router.get('/profile', auth, getProfile);

// TEMPORARY - Remove after creating admin!
router.post('/setup-first-admin', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Check if admin exists
    const existingAdmin = await usersCollection.findOne({ username: 'superadmin' });
    if (existingAdmin) {
      return res.json({ message: 'Admin already exists', username: 'superadmin' });
    }
    
    // Hash password and insert
    const hashedPassword = await bcrypt.hash('yiga2023', 12);
    const result = await usersCollection.insertOne({
      username: 'superadmin',
      password: hashedPassword,
      name: 'Super Administrator',
      role: 'superadmin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.json({ 
      message: 'Admin created successfully!',
      username: 'superadmin',
      password: 'yiga2023',
      id: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Setup admin error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
