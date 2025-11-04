-- Script SQL para criar as tabelas necessárias
-- Execute este script no seu banco PostgreSQL

-- Tabela principal de agendamentos
CREATE TABLE IF NOT EXISTS sadt (
    id SERIAL PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    tratamento_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de informações de contato e confirmação
CREATE TABLE IF NOT EXISTS schedule_v (
    id INTEGER REFERENCES sadt(id),
    patient_contacts VARCHAR(20) NOT NULL,
    main_procedure_term VARCHAR(255) NOT NULL,
    confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_sadt_tratamento_date ON sadt(tratamento_date);
CREATE INDEX IF NOT EXISTS idx_schedule_v_confirmed ON schedule_v(confirmed);
CREATE INDEX IF NOT EXISTS idx_schedule_v_id ON schedule_v(id);

-- Dados de exemplo para teste (remover em produção)
INSERT INTO sadt (patient_name, tratamento_date) VALUES 
('João Silva', '2024-12-15 10:00:00'),
('Maria Santos', '2024-12-15 14:30:00'),
('Pedro Costa', '2024-12-16 09:15:00')
ON CONFLICT DO NOTHING;

INSERT INTO schedule_v (id, patient_contacts, main_procedure_term, confirmed) VALUES 
(1, '5511999999999', 'Exame de Sangue', false),
(2, '5511888888888', 'Ultrassom', false),
(3, '5511777777777', 'Consulta Cardiologia', false)
ON CONFLICT DO NOTHING;