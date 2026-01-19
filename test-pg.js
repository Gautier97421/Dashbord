const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'dashboard_db',
  user: 'testuser',
  password: 'testpass',
});

async function testConnection() {
  try {
    console.log('Testing pg connection...');
    console.log('Config:', {
      host: '127.0.0.1',
      port: 5432,
      database: 'dashboard_db',
      user: 'postgres',
      password: '(hidden)'
    });
    
    const result = await pool.query('SELECT NOW() as now, current_user, current_database()');
    console.log('✅ Connection successful!');
    console.log('Current time:', result.rows[0].now);
    console.log('Current user:', result.rows[0].current_user);
    console.log('Current database:', result.rows[0].current_database);
    
    // Test if tables exist
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    console.log('\nExisting tables:');
    tables.rows.forEach(row => console.log('  -', row.tablename));
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
