require('dotenv').config({ path: '../../.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT * FROM team_members').then(res => {
  console.log(res.rows);
  pool.end();
}).catch(e => {
  console.error(e);
  pool.end();
});
