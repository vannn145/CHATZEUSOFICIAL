#!/usr/bin/env node
const axios = require('axios');
require('dotenv').config({ override: true });

(async () => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const phoneId = process.argv[2] || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.error('Uso: node scripts/phone-info.js <PHONE_NUMBER_ID>');
    console.error('E defina WHATSAPP_ACCESS_TOKEN no .env');
    process.exit(1);
  }
  try {
    const { data } = await axios.get(`https://graph.facebook.com/${apiVersion}/${phoneId}` , {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'id,display_phone_number,verified_name,platform_type,quality_rating,code_verification_status,whatsapp_business_account' }
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(JSON.stringify(e.response?.data || e.message, null, 2));
    process.exit(1);
  }
})();
