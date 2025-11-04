# Sistema de Disparo WhatsApp - Instruções do Projeto

Este projeto é um sistema automatizado para envio de mensagens via WhatsApp Web para agendamentos médicos, integrado com banco PostgreSQL.

## Características do Projeto

- **Linguagem**: Node.js com JavaScript
- **Banco de dados**: PostgreSQL
- **Automação**: WhatsApp Web via Puppeteer
- **Interface**: Web simples com HTML/CSS/JavaScript
- **Funcionalidades**:
  - Conexão com banco PostgreSQL (tabelas: sadt, schedule_v)
  - Busca de agendamentos não confirmados
  - Envio automatizado de mensagens WhatsApp
  - Interface para monitoramento e controle
  - Sistema de confirmação de agendamentos

## Estrutura do Banco

### Tabela `sadt`
- id
- patient_name
- tratamento_date
- created_at

### Tabela `schedule_v`
- patient_contacts
- main_procedure_term
- confirmed

## Configurações de Conexão

- **Usuário**: cdcenter
- **Senha**: DevZeus@2025
- **IP**: 100.99.99.36 (tailscale)
- **SSH**: 100.99.99.36:60888

## Dependências Principais

- puppeteer (automação WhatsApp Web)
- pg (PostgreSQL client)
- express (servidor web)
- dotenv (variáveis de ambiente)
- qrcode (geração QR code WhatsApp)

## Objetivos

1. Conectar ao banco PostgreSQL
2. Buscar agendamentos com `confirmed = false`
3. Enviar mensagens personalizadas via WhatsApp Web
4. Atualizar status de confirmação
5. Interface para monitoramento e controle manual