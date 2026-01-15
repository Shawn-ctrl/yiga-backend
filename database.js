const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create admins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create applications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        country VARCHAR(100),
        city VARCHAR(100),
        institution VARCHAR(255),
        program VARCHAR(255) NOT NULL,
        motivation TEXT,
        experience TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default admins if table is empty
    const adminCheck = await client.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO admins (username, password, name, role) VALUES
        ('superadmin', 'Yiga2023', 'Super Admin', 'superadmin'),
        ('admin', 'yiga2023', 'Admin User', 'admin'),
        ('Shawn', 'Yiga2023', 'Shawn Ndombi', 'superadmin'),
        ('jeremy.oronje', 'Jeremy@2024!', 'Jeremy Oronje', 'superadmin'),
        ('phoebe.monari', 'Phoebe@2024!', 'Phoebe Monari', 'admin'),
        ('catherine.mbilo', 'Catherine@2024!', 'Catherine Mbilo', 'admin'),
        ('hilda.koipano', 'Hilda@2024!', 'Hilda Koipano', 'admin'),
        ('abel.omenge', 'Abel@2024!', 'Abel Omenge', 'admin'),
        ('beldine.mukami', 'Beldine@2024!', 'Beldine Mukami', 'admin')
      `);
      console.log('? Default admins created');
    }

    console.log('? Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
