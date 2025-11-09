#!/usr/bin/env node
const axios = require('axios');
require('dotenv').config({ override: true });

(async () => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!token || !wabaId) {
    console.error('Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID no .env');
    process.exit(1);
  }
  try {
    const { data } = await axios.get(`https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'id,display_phone_number,verified_name,code_verification_status,platform_type,throughput' }
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(JSON.stringify(e.response?.data || e.message, null, 2));
    process.exit(1);
  }
})();
