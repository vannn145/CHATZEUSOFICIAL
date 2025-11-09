#!/usr/bin/env node
// Cria registros em message_logs com status 'sent' para todos os agendamentos não confirmados de uma data,
// sem reenviar mensagens. Útil para fazer o painel exibir "enviada" quando o envio já ocorreu fora do logging.

require('dotenv').config({ override: true });
const db = require('../src/services/database');

function pickFirstPhone(raw) {
  if (!raw) return null;
  const parts = String(raw).split(/[;|,\n\r\t]/g);
  for (const p of parts) {
    const digits = (p.match(/\d+/g) || []).join('');
    if (!digits) continue;
    let n = digits;
    if (n.startsWith('55')) {
      // ok
    } else if (n.length >= 10 && n.length <= 11) {
      n = '55' + n;
    }
    if (n.length >= 12 && n.length <= 13) return `+${n}`;
  }
  return null;
}

(async () => {
  try {
    const date = process.argv[2];
    if (!date) {
      console.error('Uso: node scripts/backfill-sent-status-by-date.js YYYY-MM-DD');
      process.exit(1);
    }

    await db.testConnection();
    const appts = await db.getUnconfirmedAppointments(date);
    const list = Array.isArray(appts) ? appts : [];
    let created = 0, skipped = 0;

    for (const a of list) {
      const phone = pickFirstPhone(a.patient_contacts) || a.patient_contacts;
      if (!phone) { skipped++; continue; }
      try {
        await db.logOutboundMessage({ appointmentId: a.id, phone, messageId: null, type: 'template', templateName: process.env.DEFAULT_CONFIRM_TEMPLATE_NAME || 'confirmacao_personalizada', status: 'sent' });
        created++;
      } catch (_) {
        skipped++;
      }
    }

    console.log(JSON.stringify({ date, total: list.length, created, skipped }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Erro no backfill:', e.message);
    process.exit(1);
  }
})();
