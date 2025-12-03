const mongoose = require('mongoose');
require('dotenv').config();

// Import the actual User model from the backend
const User = require('./models/User');

async function createAdmin() {
    try {
        await mongoose.connect('mongodb://mongo:DeMnepiuyvRbBOviDcTjaOywPCYiYDwK@tramway.proxy.rlwy.net:21045/test?authSource=admin');
        
        console.log('✅ Connected to MongoDB');
        
        // Delete existing admin
        await User.deleteMany({ username: 'superadmin' });
        console.log('🗑️  Deleted old admin');
        
        // Create new admin - the User model will hash the password automatically
        const admin = new User({
            username: 'superadmin',
            password: 'yiga2023',
            name: 'Super Administrator',
            role: 'superadmin',
            isActive: true
        });
        
        await admin.save();
        
        console.log('✅ SUCCESS! Admin created');
        console.log('Username: superadmin');
        console.log('Password: yiga2023');
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createAdmin();