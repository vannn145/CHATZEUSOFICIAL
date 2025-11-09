#!/usr/bin/env node
require('dotenv').config({ override: true });
const db = require('../src/services/database');

(async () => {
  try {
    const id = Number(process.argv[2]);
    if (!id) {
      console.error('Uso: node scripts/get-appointment-by-id.js <schedule_id>');
      process.exit(1);
    }
    await db.testConnection();
    const row = await db.getAppointmentById(id);
    console.log(JSON.stringify({ id, found: !!row, row }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }, null, 2));
    process.exit(1);
  }
})();
