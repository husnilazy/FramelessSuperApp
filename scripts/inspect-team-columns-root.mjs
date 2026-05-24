import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='team_members' ORDER BY ordinal_position");
    console.log('COLUMNS:', res.rows.map(r => r.column_name));
  } catch (err) {
    console.error('ERR', err && err.stack ? err.stack : err);
  } finally {
    await pool.end();
  }
}

run();
