const axios = require('axios');

class WhatsAppOnPremService {
  constructor() {
    this.baseURL = process.env.WABA_ONPREM_BASE_URL; // ex: https://seu-servidor:443
    this.username = process.env.WABA_ONPREM_USERNAME; // admin user
    this.password = process.env.WABA_ONPREM_PASSWORD; // admin pass
    this.certBase64 = process.env.WABA_ONPREM_CERT_BASE64; // string base64 do cert
    this.cc = process.env.WABA_ONPREM_CC || '55';
    this.phone = process.env.WABA_ONPREM_PHONE || '3431993069'; // sem + e sem DDI
    this.method = process.env.WABA_ONPREM_METHOD || 'sms'; // sms ou voice

    this.token = null;
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 20000,
      validateStatus: () => true
    });
  }

  async login() {
    if (!this.baseURL || !this.username || !this.password) {
      throw new Error('Configure WABA_ONPREM_BASE_URL, WABA_ONPREM_USERNAME e WABA_ONPREM_PASSWORD no .env');
    }
    const res = await this.api.post('/v1/users/login', {
      username: this.username,
      password: this.password
    });
    if (res.status >= 200 && res.status < 300 && res.data?.users?.[0]?.token) {
      this.token = res.data.users[0].token;
      return this.token;
    }
    const msg = res.data?.error || res.statusText || 'Falha ao autenticar no On-Premises';
    throw new Error(msg);
  }

  authHeaders() {
    if (!this.token) throw new Error('Token ausente. Chame login() antes.');
    return { Authorization: `Bearer ${this.token}` };
  }

  async requestRegistrationCode({ cc, phone_number, method, cert } = {}) {
    // Meta descontinuou o registro de números via On-Prem (/v1/account)
    // Manteremos a mensagem clara e não faremos a chamada.
    throw new Error('Registro On-Prem descontinuado: o endpoint /v1/account não pode mais ser usado para registrar números. Utilize a WhatsApp Cloud API e o WhatsApp Manager para adicionar/registrar o número.');
  }

  async verifyRegistrationCode({ code, cert, pin, vname } = {}) {
    // Também descontinuado o /v1/account/verify.
    throw new Error('Verificação On-Prem descontinuada: o endpoint /v1/account/verify não está mais disponível. Conclua o onboarding via WhatsApp Cloud API.');
  }
}

module.exports = new WhatsAppOnPremService();
