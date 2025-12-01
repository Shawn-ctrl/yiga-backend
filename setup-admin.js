const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Delete existing superadmin
    await usersCollection.deleteOne({ username: 'superadmin' });
    console.log('Deleted old admin if existed');
    
    // Hash password manually
    const hashedPassword = await bcrypt.hash('yiga2023', 12);
    
    // Insert directly into collection
    const result = await usersCollection.insertOne({
      username: 'superadmin',
      password: hashedPassword,
      name: 'Super Administrator',
      role: 'superadmin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Admin created successfully!');
    console.log('Username: superadmin');
    console.log('Password: yiga2023');
    console.log('Document ID:', result.insertedId);
    
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAdmin();
