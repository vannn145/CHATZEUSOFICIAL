#!/usr/bin/env node
// Envia a prévia real para um telefone usando o nome do paciente (usa serviços internos)
require('dotenv').config({ override: true });
const db = require('../src/services/database');
const waba = require('../src/services/whatsapp-business');

async function main() {
  const patientName = process.argv.slice(2, -1).join(' ') || 'MARIANA MORLIM DE CARVALHO';
  const phone = (process.argv.slice(-1)[0] || '+5511998420069');
  try {
    const appt = await db.getAppointmentByPatientName(patientName);
    if (!appt) {
      console.error('Nenhum agendamento encontrado para:', patientName);
      process.exit(1);
    }
    const message = waba.generateMessage(appt);
    const result = await waba.sendMessage(phone, message, 'text');
    console.log(JSON.stringify({ success: true, patientName, phone, appointment: appt, result }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.response?.data || e.message }, null, 2));
    process.exit(1);
  }
}

main();
