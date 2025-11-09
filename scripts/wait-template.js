#!/usr/bin/env node
const axios = require('axios');
require('dotenv').config({ override: true });

async function fetchTemplates() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`;
  const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, params: { limit: 200 } });
  return data.data || [];
}

(async () => {
  const name = process.argv[2] || process.env.DEFAULT_CONFIRM_TEMPLATE_NAME || 'confirmacao_personalizada';
  const timeoutMs = parseInt(process.argv[3] || '600000', 10); // 10 min
  const intervalMs = 20000; // 20s
  const deadline = Date.now() + timeoutMs;
  console.log(`Aguardando aprovação do template '${name}' por até ${Math.round(timeoutMs/60000)} min...`);
  while (Date.now() < deadline) {
    try {
      const list = await fetchTemplates();
      const t = list.find(t => t.name === name && t.language === 'pt_BR');
      if (t) {
        console.log(`Status atual: ${t.status}`);
        if (String(t.status).toUpperCase() === 'APPROVED') {
          console.log('Template aprovado!');
          process.exit(0);
        }
      } else {
        console.log('Template ainda não encontrado na WABA.');
      }
    } catch (e) {
      console.error('Erro consultando templates:', e.response?.data || e.message);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  console.error('Tempo esgotado aguardando aprovação.');
  process.exit(2);
})();
