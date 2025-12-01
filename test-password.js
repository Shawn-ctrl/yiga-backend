const bcrypt = require('bcryptjs');

const storedHash = '$2a$12$U5Ql4fR/C8t/DWjG9gnozeXQaipUtjoZ3qXlAoPC6deac6loPpjZi';
const password = 'yiga2023';

async function testPassword() {
  try {
    console.log('Testing password:', password);
    console.log('Against hash:', storedHash);
    
    const isMatch = await bcrypt.compare(password, storedHash);
    console.log('Password match result:', isMatch);
  } catch (error) {
    console.error('Error:', error);
  }
}

testPassword();
