const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Connection error:', err));

const User = require('./models/User');

async function checkUsers() {
  try {
    const users = await User.find({});
    console.log('All users in database:');
    console.log(JSON.stringify(users, null, 2));
    
    const superadmin = await User.findOne({ username: 'superadmin' });
    console.log('\nSuperadmin user:');
    console.log(superadmin);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
