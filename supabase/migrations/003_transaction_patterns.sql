-- Tabela para armazenar padrões de reconhecimento de transações
CREATE TABLE IF NOT EXISTS transaction_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_name VARCHAR(255) NOT NULL,
  keywords TEXT[] NOT NULL, -- Array de palavras-chave para busca
  suggested_category VARCHAR(100) NOT NULL,
  merchant_type VARCHAR(100), -- Tipo de comerciante (supermercado, farmácia, etc.)
  confidence_score INTEGER DEFAULT 90, -- Pontuação de confiança (0-100)
  country_code VARCHAR(2) DEFAULT 'PT', -- Código do país
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_keywords ON transaction_patterns USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_category ON transaction_patterns(suggested_category);
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_country ON transaction_patterns(country_code);

-- Inserir padrões comuns portugueses/europeus (apenas se a tabela estiver vazia)
INSERT INTO transaction_patterns (pattern_name, keywords, suggested_category, merchant_type, confidence_score, country_code) 
SELECT * FROM (VALUES

-- Supermercados e Alimentação
('Continente', ARRAY['continente', 'continente.pt'], 'alimentacao', 'supermercado', 95, 'PT'),
('Pingo Doce', ARRAY['pingo doce', 'pingodoce'], 'alimentacao', 'supermercado', 95, 'PT'),
('Lidl', ARRAY['lidl'], 'alimentacao', 'supermercado', 95, 'PT'),
('Auchan', ARRAY['auchan'], 'alimentacao', 'supermercado', 95, 'PT'),
('Intermarché', ARRAY['intermarche'], 'alimentacao', 'supermercado', 95, 'PT'),
('El Corte Inglés', ARRAY['el corte ingles', 'corte ingles'], 'alimentacao', 'supermercado', 95, 'PT'),
('McDonald''s', ARRAY['mcdonalds', 'mcdonald'], 'alimentacao', 'fast_food', 90, 'PT'),
('Burger King', ARRAY['burger king', 'bk'], 'alimentacao', 'fast_food', 90, 'PT'),
('KFC', ARRAY['kfc'], 'alimentacao', 'fast_food', 90, 'PT'),
('Pizza Hut', ARRAY['pizza hut'], 'alimentacao', 'restaurante', 90, 'PT'),

-- Transportes
('CP - Comboios', ARRAY['cp ', 'comboios de portugal'], 'transporte', 'transporte_publico', 95, 'PT'),
('Metro Lisboa', ARRAY['metro lisboa', 'metropolitano'], 'transporte', 'transporte_publico', 95, 'PT'),
('Metro Porto', ARRAY['metro porto'], 'transporte', 'transporte_publico', 95, 'PT'),
('Carris', ARRAY['carris'], 'transporte', 'transporte_publico', 95, 'PT'),
('Repsol', ARRAY['repsol'], 'transporte', 'combustivel', 90, 'PT'),
('BP', ARRAY['bp ', 'british petroleum'], 'transporte', 'combustivel', 90, 'PT'),
('Galp', ARRAY['galp'], 'transporte', 'combustivel', 95, 'PT'),
('CEPSA', ARRAY['cepsa'], 'transporte', 'combustivel', 90, 'PT'),
('Uber', ARRAY['uber'], 'transporte', 'taxi', 85, 'PT'),
('Bolt', ARRAY['bolt'], 'transporte', 'taxi', 85, 'PT'),

-- Saúde e Farmácias
('Farmácia', ARRAY['farmacia', 'farm.'], 'saude', 'farmacia', 90, 'PT'),
('Wells', ARRAY['wells'], 'saude', 'farmacia', 95, 'PT'),
('Hospital', ARRAY['hospital', 'centro hospitalar'], 'saude', 'hospital', 95, 'PT'),
('Clínica', ARRAY['clinica'], 'saude', 'clinica', 90, 'PT'),

-- Tecnologia e Telecomunicações
('MEO', ARRAY['meo'], 'tecnologia', 'telecomunicacoes', 95, 'PT'),
('NOS', ARRAY['nos'], 'tecnologia', 'telecomunicacoes', 95, 'PT'),
('Vodafone', ARRAY['vodafone'], 'tecnologia', 'telecomunicacoes', 95, 'PT'),
('Netflix', ARRAY['netflix'], 'lazer', 'streaming', 95, 'PT'),
('Spotify', ARRAY['spotify'], 'lazer', 'streaming', 95, 'PT'),
('Amazon', ARRAY['amazon'], 'tecnologia', 'e_commerce', 90, 'PT'),
('Worten', ARRAY['worten'], 'tecnologia', 'eletronicos', 95, 'PT'),
('Fnac', ARRAY['fnac'], 'tecnologia', 'eletronicos', 95, 'PT'),

-- Serviços e Utilidades
('EDP', ARRAY['edp'], 'casa', 'eletricidade', 95, 'PT'),
('Endesa', ARRAY['endesa'], 'casa', 'eletricidade', 90, 'PT'),
('Águas', ARRAY['aguas'], 'casa', 'agua', 90, 'PT'),
('Gás Natural', ARRAY['gas natural'], 'casa', 'gas', 90, 'PT'),

-- Bancos e Seguros
('Millennium', ARRAY['millennium', 'bcp'], 'servicos', 'banco', 95, 'PT'),
('CGD', ARRAY['cgd', 'caixa geral'], 'servicos', 'banco', 95, 'PT'),
('Santander', ARRAY['santander'], 'servicos', 'banco', 95, 'PT'),
('BPI', ARRAY['bpi'], 'servicos', 'banco', 95, 'PT'),
('Novo Banco', ARRAY['novo banco'], 'servicos', 'banco', 95, 'PT'),

-- Roupas e Moda
('Zara', ARRAY['zara'], 'roupas', 'moda', 90, 'PT'),
('H&M', ARRAY['h&m', 'h & m'], 'roupas', 'moda', 90, 'PT'),
('C&A', ARRAY['c&a'], 'roupas', 'moda', 90, 'PT'),
('Primark', ARRAY['primark'], 'roupas', 'moda', 90, 'PT'),

-- Casa e Bricolagem
('Leroy Merlin', ARRAY['leroy merlin', 'bcm-bricolage', 'bcm bricolage'], 'casa', 'bricolagem', 95, 'PT'),
('IKEA', ARRAY['ikea'], 'casa', 'mobiliario', 95, 'PT'),
('Aki', ARRAY['aki'], 'casa', 'bricolagem', 90, 'PT'),

-- Educação
('Universidade', ARRAY['universidade', 'univ.'], 'educacao', 'ensino_superior', 95, 'PT'),
('Escola', ARRAY['escola'], 'educacao', 'ensino', 90, 'PT'),

-- Compras Parceladas/Prestações
('Prestações Gerais', ARRAY['prest.', 'prestacao', 'prestação', 'parcela'], 'compras_parceladas', 'financiamento', 90, 'PT'),
('Klarna', ARRAY['klarna', 'klarna ab'], 'compras_parceladas', 'fintech', 95, 'PT'),

-- Padrões genéricos por palavras-chave
('Pagamento Multibanco', ARRAY['multibanco', 'mb'], 'transferencia', 'atm', 80, 'PT'),
('Transferência', ARRAY['transferencia', 'transf'], 'transferencia', 'transferencia', 85, 'PT'),
('Salário', ARRAY['salario', 'ordenado', 'vencimento'], 'salario', 'trabalho', 95, 'PT'),
('Renda', ARRAY['renda', 'aluguer'], 'casa', 'habitacao', 90, 'PT'),

-- ========== PADRÕES BRASILEIROS ==========

-- Supermercados e Alimentação Brasil
('Pão de Açúcar', ARRAY['pao de acucar', 'paodeacucar'], 'alimentacao', 'supermercado', 95, 'BR'),
('Extra', ARRAY['extra'], 'alimentacao', 'supermercado', 95, 'BR'),
('Carrefour', ARRAY['carrefour'], 'alimentacao', 'supermercado', 95, 'BR'),
('Assaí', ARRAY['assai', 'atacadao assai'], 'alimentacao', 'atacado', 95, 'BR'),
('Atacadão', ARRAY['atacadao'], 'alimentacao', 'atacado', 95, 'BR'),
('Sam''s Club', ARRAY['sams club', 'sams'], 'alimentacao', 'atacado', 90, 'BR'),
('Big', ARRAY['big'], 'alimentacao', 'supermercado', 90, 'BR'),
('Walmart', ARRAY['walmart'], 'alimentacao', 'supermercado', 90, 'BR'),
('McDonald''s BR', ARRAY['mcdonalds', 'mcdonald'], 'alimentacao', 'fast_food', 90, 'BR'),
('Burger King BR', ARRAY['burger king', 'bk'], 'alimentacao', 'fast_food', 90, 'BR'),
('KFC BR', ARRAY['kfc'], 'alimentacao', 'fast_food', 90, 'BR'),
('Subway', ARRAY['subway'], 'alimentacao', 'fast_food', 90, 'BR'),
('iFood', ARRAY['ifood'], 'alimentacao', 'delivery', 95, 'BR'),
('Uber Eats', ARRAY['uber eats', 'ubereats'], 'alimentacao', 'delivery', 95, 'BR'),

-- Transportes Brasil
('Uber BR', ARRAY['uber'], 'transporte', 'taxi', 95, 'BR'),
('99', ARRAY['99', 'noventa e nove'], 'transporte', 'taxi', 95, 'BR'),
('Petrobras', ARRAY['petrobras', 'br'], 'transporte', 'combustivel', 95, 'BR'),
('Shell BR', ARRAY['shell'], 'transporte', 'combustivel', 90, 'BR'),
('Ipiranga', ARRAY['ipiranga'], 'transporte', 'combustivel', 95, 'BR'),
('Ale', ARRAY['ale combustiveis'], 'transporte', 'combustivel', 85, 'BR'),
('Metro SP', ARRAY['metro sao paulo', 'cptm'], 'transporte', 'transporte_publico', 90, 'BR'),
('Metro RJ', ARRAY['metro rio', 'metrorio'], 'transporte', 'transporte_publico', 90, 'BR'),
('VLT', ARRAY['vlt'], 'transporte', 'transporte_publico', 85, 'BR'),

-- Saúde e Farmácias Brasil
('Farmácia BR', ARRAY['farmacia', 'drogaria'], 'saude', 'farmacia', 90, 'BR'),
('Droga Raia', ARRAY['droga raia', 'raia'], 'saude', 'farmacia', 95, 'BR'),
('Drogasil', ARRAY['drogasil'], 'saude', 'farmacia', 95, 'BR'),
('Pacheco', ARRAY['pacheco'], 'saude', 'farmacia', 95, 'BR'),
('Pague Menos', ARRAY['pague menos'], 'saude', 'farmacia', 95, 'BR'),
('Extrafarma', ARRAY['extrafarma'], 'saude', 'farmacia', 90, 'BR'),
('Hospital BR', ARRAY['hospital'], 'saude', 'hospital', 95, 'BR'),
('Clínica BR', ARRAY['clinica'], 'saude', 'clinica', 90, 'BR'),

-- Tecnologia e Telecomunicações Brasil
('Vivo', ARRAY['vivo'], 'tecnologia', 'telecomunicacoes', 95, 'BR'),
('Claro', ARRAY['claro'], 'tecnologia', 'telecomunicacoes', 95, 'BR'),
('TIM', ARRAY['tim'], 'tecnologia', 'telecomunicacoes', 95, 'BR'),
('Oi', ARRAY['oi'], 'tecnologia', 'telecomunicacoes', 95, 'BR'),
('Netflix BR', ARRAY['netflix'], 'lazer', 'streaming', 95, 'BR'),
('Spotify BR', ARRAY['spotify'], 'lazer', 'streaming', 95, 'BR'),
('Globoplay', ARRAY['globoplay'], 'lazer', 'streaming', 95, 'BR'),
('Amazon Prime BR', ARRAY['amazon prime', 'prime video'], 'lazer', 'streaming', 90, 'BR'),
('Mercado Livre', ARRAY['mercado livre', 'mercadolivre'], 'tecnologia', 'e_commerce', 95, 'BR'),
('Magazine Luiza', ARRAY['magazine luiza', 'magalu'], 'tecnologia', 'eletronicos', 95, 'BR'),
('Casas Bahia', ARRAY['casas bahia'], 'tecnologia', 'eletronicos', 95, 'BR'),
('Fast Shop', ARRAY['fast shop'], 'tecnologia', 'eletronicos', 90, 'BR'),

-- Serviços e Utilidades Brasil
('CPFL', ARRAY['cpfl'], 'casa', 'eletricidade', 95, 'BR'),
('Light', ARRAY['light'], 'casa', 'eletricidade', 95, 'BR'),
('Enel', ARRAY['enel'], 'casa', 'eletricidade', 95, 'BR'),
('CEMIG', ARRAY['cemig'], 'casa', 'eletricidade', 95, 'BR'),
('SABESP', ARRAY['sabesp'], 'casa', 'agua', 95, 'BR'),
('CEDAE', ARRAY['cedae'], 'casa', 'agua', 95, 'BR'),
('Comgás', ARRAY['comgas'], 'casa', 'gas', 95, 'BR'),

-- Bancos Brasil
('Itaú', ARRAY['itau', 'banco itau'], 'servicos', 'banco', 95, 'BR'),
('Bradesco', ARRAY['bradesco'], 'servicos', 'banco', 95, 'BR'),
('Banco do Brasil', ARRAY['banco do brasil', 'bb'], 'servicos', 'banco', 95, 'BR'),
('Santander BR', ARRAY['santander'], 'servicos', 'banco', 95, 'BR'),
('Caixa', ARRAY['caixa economica', 'cef'], 'servicos', 'banco', 95, 'BR'),
('Nubank', ARRAY['nubank', 'nu pagamentos'], 'servicos', 'banco', 95, 'BR'),
('Inter', ARRAY['banco inter', 'inter'], 'servicos', 'banco', 95, 'BR'),
('C6 Bank', ARRAY['c6 bank', 'c6'], 'servicos', 'banco', 90, 'BR'),
('PagSeguro', ARRAY['pagseguro'], 'servicos', 'fintech', 90, 'BR'),
('PicPay', ARRAY['picpay'], 'servicos', 'fintech', 95, 'BR'),

-- Roupas e Moda Brasil
('Renner', ARRAY['renner'], 'roupas', 'moda', 95, 'BR'),
('C&A BR', ARRAY['c&a'], 'roupas', 'moda', 90, 'BR'),
('Riachuelo', ARRAY['riachuelo'], 'roupas', 'moda', 95, 'BR'),
('Zara BR', ARRAY['zara'], 'roupas', 'moda', 90, 'BR'),
('H&M BR', ARRAY['h&m'], 'roupas', 'moda', 90, 'BR'),
('Marisa', ARRAY['marisa'], 'roupas', 'moda', 95, 'BR'),

-- Casa e Construção Brasil
('Leroy Merlin BR', ARRAY['leroy merlin'], 'casa', 'bricolagem', 95, 'BR'),
('Home Center', ARRAY['home center'], 'casa', 'bricolagem', 90, 'BR'),
('Telhanorte', ARRAY['telhanorte'], 'casa', 'construcao', 95, 'BR'),
('C&C', ARRAY['c&c'], 'casa', 'construcao', 90, 'BR'),
('IKEA BR', ARRAY['ikea'], 'casa', 'mobiliario', 90, 'BR'),

-- Educação Brasil
('Universidade BR', ARRAY['universidade'], 'educacao', 'ensino_superior', 95, 'BR'),
('Escola BR', ARRAY['escola', 'colegio'], 'educacao', 'ensino', 90, 'BR'),
('Kumon', ARRAY['kumon'], 'educacao', 'curso', 90, 'BR'),

-- Padrões genéricos Brasil
('PIX', ARRAY['pix'], 'transferencia', 'pix', 95, 'BR'),
('TED', ARRAY['ted'], 'transferencia', 'ted', 90, 'BR'),
('DOC', ARRAY['doc'], 'transferencia', 'doc', 85, 'BR'),
('Transferência BR', ARRAY['transferencia', 'transf'], 'transferencia', 'transferencia', 85, 'BR'),
('Salário BR', ARRAY['salario', 'salário'], 'salario', 'trabalho', 95, 'BR'),
('Aluguel', ARRAY['aluguel'], 'casa', 'habitacao', 95, 'BR'),
('Prestações BR', ARRAY['prest.', 'prestacao', 'prestação', 'parcela'], 'compras_parceladas', 'financiamento', 90, 'BR')
) AS new_patterns(pattern_name, keywords, suggested_category, merchant_type, confidence_score, country_code)
WHERE NOT EXISTS (SELECT 1 FROM transaction_patterns LIMIT 1);

-- Atualizar timestamp quando há mudanças
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_transaction_patterns_updated_at') THEN
        CREATE TRIGGER update_transaction_patterns_updated_at BEFORE UPDATE
            ON transaction_patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;
