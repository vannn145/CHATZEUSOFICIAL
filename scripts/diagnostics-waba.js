#!/usr/bin/env node
const axios = require('axios');
require('dotenv').config({ override: true });

(async () => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token) {
    console.error('Defina WHATSAPP_ACCESS_TOKEN no .env');
    process.exit(1);
  }
  try {
    const fields = [
      'id',
      'name',
      'businesses{id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,platform_type},message_templates{name,language,status}}}'
    ].join(',');
    const { data } = await axios.get(`https://graph.facebook.com/${apiVersion}/me`, {
      params: { fields },
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(JSON.stringify(e.response?.data || e.message, null, 2));
    process.exit(1);
  }
})();
