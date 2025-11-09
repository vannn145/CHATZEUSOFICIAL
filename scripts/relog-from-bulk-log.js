#!/usr/bin/env node
// Regrava no banco (message_logs) os envios registrados em um arquivo de log JSON de bulk
// Uso: node scripts/relog-from-bulk-log.js <caminho_do_arquivo_de_log> [templateName]

require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const db = require('../src/services/database');

function extractJsonObject(raw) {
  // Estratégia baseada em linhas: pegar do primeiro '{' em uma linha até a última '}'
  const lines = raw.split(/\r?\n/);
  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('{')) { startIdx = i; break; }
  }
  for (let j = lines.length - 1; j >= 0; j--) {
    if (lines[j].trim().endsWith('}')) { endIdx = j; break; }
  }
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error('Bloco JSON não encontrado via varredura de linhas');
  }
  let jsonStr = lines.slice(startIdx, endIdx + 1).join('\n');
  // Sanear caracteres não imprimíveis comuns nos logs
  jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F]/g, (c) => (c === '\n' || c === '\r' || c === '\t') ? c : '');
  return JSON.parse(jsonStr);
}

(async () => {
  try {
    const fileArg = process.argv[2] || 'logs/bulk_2025-11-05_template.json';
    const templateNameArg = process.argv[3] || (process.env.DEFAULT_CONFIRM_TEMPLATE_NAME || 'confirmacao_personalizada');
    const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
    if (!fs.existsSync(filePath)) {
      console.error('Arquivo não encontrado:', filePath);
      process.exit(1);
    }

    // Conectar e garantir tabela de logs
    try {
      await db.testConnection();
    } catch (e) {
      console.error('Erro ao conectar no banco:', e.message);
      process.exit(1);
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const data = extractJsonObject(raw);
    const results = Array.isArray(data.results) ? data.results : [];
    let countAll = 0, countLogged = 0, countSkipped = 0;

    for (const r of results) {
      countAll++;
      const appointmentId = Number(r.id);
      const phone = (r.phone || '').replace(/\s+/g, '');
      const messageId = r.messageId || r.response?.messages?.[0]?.id;
      const type = r.type === 'text-fallback' ? 'text' : 'template';
      const templateName = type === 'template' ? templateNameArg : null;
      if (!r.success || !messageId || !appointmentId || !phone) {
        countSkipped++;
        continue;
      }
      try {
        await db.logOutboundMessage({ appointmentId, phone, messageId, type, templateName, status: 'sent' });
        countLogged++;
      } catch (_) {
        countSkipped++;
      }
    }

    console.log(JSON.stringify({
      file: path.basename(filePath),
      date: data.date,
      totalInFile: countAll,
      logged: countLogged,
      skipped: countSkipped
    }, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('Falha ao regravar logs:', e.message);
    process.exit(1);
  }
})();
