const mongoose = require('mongoose');
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await createInitialAdmin();
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};
const createInitialAdmin = async () => {
  const User = require('../models/User');
  const superAdminExists = await User.findOne({ role: 'superadmin' });
  if (!superAdminExists) {
    const initialAdmin = new User({ username: 'superadmin', password: 'yiga2023', name: 'Super Administrator', role: 'superadmin' });
    await initialAdmin.save();
    console.log('Initial super admin created: superadmin / yiga2023');
  }
};
module.exports = connectDB;
