import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { db, teamMembersTable } from '@workspace/db';

async function run() {
  try {
    const [member] = await db.insert(teamMembersTable).values({ name: 'Debug Script', role: 'tester' }).returning();
    console.log('Inserted:', member);
  } catch (err) {
    console.error('Insert error:', err);
    process.exitCode = 1;
  }
}

run();
