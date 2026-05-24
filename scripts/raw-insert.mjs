import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const text = `INSERT INTO team_members (name, role, username, whatsapp, status, is_active, can_login, password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name`;
    const values = ['Raw Insert', 'tester', 'raw_insert', '+628000000000', 'active', true, false, null];
    const res = await client.query(text, values);
    console.log('Inserted:', res.rows[0]);
  } catch (err) {
    console.error('Raw insert error:', err.stack || err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
