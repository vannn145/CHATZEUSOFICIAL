#!/usr/bin/env node
// Verifica rapidamente o token e o phone_number_id do .env sem subir o servidor
const axios = require('axios');
require('dotenv').config({ override: true });

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!token) {
    console.error('Token ausente no .env (WHATSAPP_ACCESS_TOKEN)');
    process.exit(1);
  }
  const base = `https://graph.facebook.com/${apiVersion}`;
  const out = { env: { phoneId, wabaId, apiVersion } };
  try {
    const dbg = await axios.get(`${base}/debug_token`, {
      params: { input_token: token, access_token: token },
    });
    out.debug_token = dbg.data?.data || dbg.data;
  } catch (e) {
    out.debug_token_error = e.response?.data || e.message;
  }
  if (phoneId) {
    try {
      const p = await axios.get(`${base}/${phoneId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      out.phone = p.data;
    } catch (e) {
      out.phone_error = e.response?.data || e.message;
    }
  }
  if (wabaId) {
    try {
      const subs = await axios.get(`${base}/${wabaId}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      out.subscribed_apps = subs.data;
    } catch (e) {
      out.subscribed_apps_error = e.response?.data || e.message;
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
