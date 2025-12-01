const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
    try {
        await mongoose.connect('mongodb://mongo:DeMnepiuyvRbBOviDcTjaOywPCYiYDwK@tramway.proxy.rlwy.net:21045/test?authSource=admin');
        
        console.log('Connected to MongoDB');
        
        const existing = await User.findOne({ username: 'superadmin' });
        if (existing) {
            console.log('Admin already exists - deleting and recreating...');
            await User.deleteOne({ username: 'superadmin' });
        }
        
        const hashedPassword = await bcrypt.hash('yiga2023', 10);
        
        const admin = await User.create({
            username: 'superadmin',
            password: hashedPassword,
            name: 'Super Administrator',
            role: 'superadmin'
        });
        
        console.log('SUCCESS! Admin user created:');
        console.log('Username: superadmin');
        console.log('Password: yiga2023');
        console.log('User ID:', admin._id);
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

createAdmin();