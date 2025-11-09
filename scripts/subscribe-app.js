#!/usr/bin/env node
// Assina o App atual (do token) na WABA do .env
const axios = require('axios');
require('dotenv').config({ override: true });

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!token || !wabaId) {
    console.error('Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID no .env');
    process.exit(1);
  }
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`;
  try {
    const resp = await axios.post(
      url,
      { subscribed_fields: ['messages'] },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (e) {
    console.error(JSON.stringify(e.response?.data || e.message, null, 2));
    process.exit(1);
  }
}

main();
