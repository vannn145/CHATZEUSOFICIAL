-- Limpa a estrutura anterior (se existir)
DROP VIEW IF EXISTS schedule_complete CASCADE;

DROP TABLE IF EXISTS sadt CASCADE;
DROP TABLE IF EXISTS schedule_v CASCADE;
DROP TABLE IF EXISTS contact CASCADE;
DROP TABLE IF EXISTS patient CASCADE;
DROP TABLE IF EXISTS health_professional CASCADE;
DROP TABLE IF EXISTS health_insurance_company_plan CASCADE;
DROP TABLE IF EXISTS health_insurance_company CASCADE;
DROP TABLE IF EXISTS health_facility CASCADE;
DROP TABLE IF EXISTS person CASCADE;

-- Tabela base de pessoas (pacientes e profissionais)
CREATE TABLE person (
    person_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    cpf VARCHAR(14),
    birthdate DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de unidades de saúde
CREATE TABLE health_facility (
    health_facility_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de operadoras
CREATE TABLE health_insurance_company (
    health_insurance_company_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de planos da operadora
CREATE TABLE health_insurance_company_plan (
    health_insurance_company_plan_id SERIAL PRIMARY KEY,
    health_insurance_company_id INTEGER REFERENCES health_insurance_company(health_insurance_company_id) ON DELETE CASCADE,
    plan_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de pacientes
CREATE TABLE patient (
    patient_id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES person(person_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de contatos
CREATE TABLE contact (
    contact_id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES person(person_id) ON DELETE CASCADE,
    value VARCHAR(32) NOT NULL,
    is_whatsapp BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de profissionais de saúde
CREATE TABLE health_professional (
    health_professional_id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES person(person_id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela principal de agendamentos (equivalente da view schedule_v)
CREATE TABLE schedule_v (
    schedule_id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patient(patient_id) ON DELETE SET NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_contacts VARCHAR(20),
    main_procedure_term VARCHAR(255),
    confirmed BOOLEAN DEFAULT FALSE,
    observation TEXT,
    schedule_group_name VARCHAR(255),
    schedule_group_color VARCHAR(32),
    hf_id INTEGER REFERENCES health_facility(health_facility_id) ON DELETE SET NULL,
    rhp_id INTEGER REFERENCES health_professional(health_professional_id) ON DELETE SET NULL,
    hic_id INTEGER REFERENCES health_insurance_company(health_insurance_company_id) ON DELETE SET NULL,
    hicp_id INTEGER REFERENCES health_insurance_company_plan(health_insurance_company_plan_id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    "when" TIMESTAMP NOT NULL,
    when_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela complementar com informações de data/horário
CREATE TABLE sadt (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedule_v(schedule_id) ON DELETE CASCADE,
    tratamento_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_schedule_v_confirmed ON schedule_v(confirmed);
CREATE INDEX IF NOT EXISTS idx_schedule_v_when ON schedule_v("when");
CREATE INDEX IF NOT EXISTS idx_schedule_v_patient ON schedule_v(patient_id);
CREATE INDEX IF NOT EXISTS idx_sadt_tratamento_date ON sadt(tratamento_date);
CREATE INDEX IF NOT EXISTS idx_sadt_schedule_id ON sadt(schedule_id);

-- Dados de exemplo para teste (remover em produção)
INSERT INTO person (full_name, email, cpf, birthdate) VALUES
('João Silva', 'joao.silva@example.com', '12345678901', '1980-01-15'),
('Maria Santos', 'maria.santos@example.com', '23456789012', '1985-02-20'),
('Pedro Costa', 'pedro.costa@example.com', '34567890123', '1975-03-05'),
('Dr. Sylvio Soares', 'sylvio.soares@example.com', '45678901234', '1970-04-10');

INSERT INTO patient (person_id)
SELECT person_id FROM person WHERE full_name IN ('João Silva', 'Maria Santos', 'Pedro Costa');

INSERT INTO contact (person_id, value, is_whatsapp)
VALUES
((SELECT person_id FROM person WHERE full_name = 'João Silva'), '5511999999999', TRUE),
((SELECT person_id FROM person WHERE full_name = 'Maria Santos'), '5511888888888', TRUE),
((SELECT person_id FROM person WHERE full_name = 'Pedro Costa'), '5511777777777', TRUE);

INSERT INTO health_facility (name) VALUES ('Clínica Central');

INSERT INTO health_insurance_company (name) VALUES ('Unimed');

INSERT INTO health_insurance_company_plan (health_insurance_company_id, plan_name)
VALUES ((SELECT health_insurance_company_id FROM health_insurance_company WHERE name = 'Unimed'), 'Unimed Plano Ouro');

INSERT INTO health_professional (person_id)
VALUES ((SELECT person_id FROM person WHERE full_name = 'Dr. Sylvio Soares'));

INSERT INTO schedule_v (
    patient_id,
    patient_name,
    patient_contacts,
    main_procedure_term,
    confirmed,
    observation,
    schedule_group_name,
    schedule_group_color,
    hf_id,
    rhp_id,
    hic_id,
    hicp_id,
    "when",
    when_end
) VALUES
((SELECT patient_id FROM patient pt JOIN person p ON p.person_id = pt.person_id WHERE p.full_name = 'João Silva'),
 'João Silva',
 '5511999999999',
 'Exame de Sangue',
 FALSE,
 'Trazer exames anteriores',
 'Laboratório',
 '#FF5733',
 (SELECT health_facility_id FROM health_facility WHERE name = 'Clínica Central'),
 (SELECT health_professional_id FROM health_professional hp JOIN person pp ON pp.person_id = hp.person_id WHERE pp.full_name = 'Dr. Sylvio Soares'),
 (SELECT health_insurance_company_id FROM health_insurance_company WHERE name = 'Unimed'),
 (SELECT health_insurance_company_plan_id FROM health_insurance_company_plan WHERE plan_name = 'Unimed Plano Ouro'),
 '2024-12-15 10:00:00',
 '2024-12-15 10:30:00'),

((SELECT patient_id FROM patient pt JOIN person p ON p.person_id = pt.person_id WHERE p.full_name = 'Maria Santos'),
 'Maria Santos',
 '5511888888888',
 'Ultrassom',
 TRUE,
 NULL,
 'Imagem',
 '#33C3FF',
 (SELECT health_facility_id FROM health_facility WHERE name = 'Clínica Central'),
 (SELECT health_professional_id FROM health_professional hp JOIN person pp ON pp.person_id = hp.person_id WHERE pp.full_name = 'Dr. Sylvio Soares'),
 (SELECT health_insurance_company_id FROM health_insurance_company WHERE name = 'Unimed'),
 (SELECT health_insurance_company_plan_id FROM health_insurance_company_plan WHERE plan_name = 'Unimed Plano Ouro'),
 '2024-12-15 14:30:00',
 '2024-12-15 15:00:00'),

((SELECT patient_id FROM patient pt JOIN person p ON p.person_id = pt.person_id WHERE p.full_name = 'Pedro Costa'),
 'Pedro Costa',
 '5511777777777',
 'Consulta Cardiologia',
 FALSE,
 'Avaliar histórico cardíaco',
 'Consultas',
 '#28A745',
 (SELECT health_facility_id FROM health_facility WHERE name = 'Clínica Central'),
 (SELECT health_professional_id FROM health_professional hp JOIN person pp ON pp.person_id = hp.person_id WHERE pp.full_name = 'Dr. Sylvio Soares'),
 (SELECT health_insurance_company_id FROM health_insurance_company WHERE name = 'Unimed'),
 (SELECT health_insurance_company_plan_id FROM health_insurance_company_plan WHERE plan_name = 'Unimed Plano Ouro'),
 '2024-12-16 09:15:00',
 '2024-12-16 09:45:00');

INSERT INTO sadt (schedule_id, tratamento_date)
VALUES
((SELECT schedule_id FROM schedule_v WHERE patient_name = 'João Silva' LIMIT 1), '2024-12-15 10:00:00'),
((SELECT schedule_id FROM schedule_v WHERE patient_name = 'Maria Santos' LIMIT 1), '2024-12-15 14:30:00'),
((SELECT schedule_id FROM schedule_v WHERE patient_name = 'Pedro Costa' LIMIT 1), '2024-12-16 09:15:00');

-- View que consolida todos os dados relevantes do agendamento
CREATE OR REPLACE VIEW schedule_complete AS
SELECT
    sv.schedule_id AS id,
    sv."when" AS schedule_date,
    sv.when_end AS schedule_date_end,
    sv.confirmed,
    sv.observation,
    sv.schedule_group_name,
    sv.schedule_group_color,
    sv.hf_id AS health_facility_id,
    hf.name AS health_facility_name,
    sv.rhp_id AS health_professional_id,
    hp_person.full_name AS health_professional_name,
    sv.hic_id AS insurance_id,
    hic.name AS insurance_name,
    sv.hicp_id AS insurance_plan_id,
    hicp.plan_name AS insurance_plan_name,
    pt.patient_id,
    p.full_name AS patient_name,
    c.value AS patient_phone,
    p.email AS patient_email,
    p.cpf AS patient_cpf,
    p.birthdate AS patient_birthdate,
    sv.created_at,
    sv.updated_at
FROM schedule_v sv
LEFT JOIN patient pt ON pt.patient_id = sv.patient_id
LEFT JOIN person p ON p.person_id = pt.person_id
LEFT JOIN contact c ON c.person_id = p.person_id AND c.is_whatsapp = TRUE
LEFT JOIN health_professional hp ON hp.health_professional_id = sv.rhp_id
LEFT JOIN person hp_person ON hp_person.person_id = hp.person_id
LEFT JOIN health_facility hf ON hf.health_facility_id = sv.hf_id
LEFT JOIN health_insurance_company hic ON hic.health_insurance_company_id = sv.hic_id
LEFT JOIN health_insurance_company_plan hicp ON hicp.health_insurance_company_plan_id = sv.hicp_id
WHERE sv.active = TRUE;

-- Permissão opcional para um usuário específico
-- GRANT SELECT ON schedule_complete TO your_api_user;