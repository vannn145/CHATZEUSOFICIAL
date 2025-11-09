require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false,
  });

  try {
    const client = await pool.connect();
    const queries = [
      { name: 'sadt', sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sadt' ORDER BY ordinal_position` },
      { name: 'schedule_v', sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_v' ORDER BY ordinal_position` },
      { name: 'schedule_mv', sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_mv' ORDER BY ordinal_position` },
      { name: 'schedule', sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule' ORDER BY ordinal_position` },
  { name: 'person', sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'person' ORDER BY ordinal_position` },
  { name: 'schedule_group', sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_group' ORDER BY ordinal_position` },
      { name: 'contact', sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contact' ORDER BY ordinal_position` },
    ];

    for (const q of queries) {
      try {
        const res = await client.query(q.sql);
        console.log(`\n=== Columns in ${q.name} ===`);
        if (res.rows.length === 0) {
          console.log('(no rows)');
        } else {
          res.rows.forEach(r => console.log(`${r.column_name} :: ${r.data_type}`));
        }
      } catch (err) {
        console.log(`\n=== Columns in ${q.name} ===`);
        console.log(`Error: ${err.message}`);
      }
    }

    // Try a quick sample: list top 5 rows to inspect candidate keys
    const samples = [];
    for (const s of samples) {
      try {
        const res = await client.query(s.sql);
        console.log(`\n=== Sample rows from ${s.name} ===`);
        console.log(JSON.stringify(res.rows, null, 2));
      } catch (err) {
        console.log(`\n=== Sample rows from ${s.name} ===`);
        console.log(`Error: ${err.message}`);
      }
    }

    client.release();
  } catch (e) {
    console.error('DB error:', e.message);
  } finally {
    await pool.end();
  }
})();
