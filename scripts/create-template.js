#!/usr/bin/env node
// Cria um template com placeholders para confirmação personalizada
const axios = require('axios');
require('dotenv').config({ override: true });

(async () => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token || !wabaId) {
    console.error('Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID no .env');
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`;
  const payload = {
    name: 'confirmacao_personalizada',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Confirmação de agendamento' },
      {
        type: 'BODY',
        text: 'Olá, {{1}}!\nVocê possui um agendamento no CD Center - Uberaba para {{2}} às {{3}} (procedimento: {{4}}).\nPodemos confirmar sua presença?',
        example: {
          body_text: [[
            'MARIANA MORLIM DE CARVALHO',
            '05/11/2025',
            '10:00',
            'ECODOPPLERCARDIOGRAMA TRANSTORÁCICO'
          ]]
        }
      },
      { type: 'FOOTER', text: 'Confirme sua consulta/procedimento nos botões abaixo' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Confirmado' },
          { type: 'QUICK_REPLY', text: 'Desmarcar' }
        ]
      }
    ]
  };

  try {
    const { data } = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(JSON.stringify(e.response?.data || e.message, null, 2));
    process.exit(1);
  }
})();
