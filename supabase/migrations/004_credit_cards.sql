-- Migration: Credit Cards Support
-- Adds support for credit card management and automatic detection from statements

-- Credit Cards table
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  card_name VARCHAR(255) NOT NULL, -- Nome personalizado do cartão (ex: "Cartão Principal", "Cartão Compras")
  bank_name VARCHAR(255) NOT NULL, -- Banco emissor
  card_brand VARCHAR(50), -- Visa, Mastercard, American Express, etc.
  last_four_digits VARCHAR(4), -- Últimos 4 dígitos para identificação
  card_type VARCHAR(50) DEFAULT 'credit' CHECK (card_type IN ('credit', 'debit')),
  credit_limit DECIMAL(15,2), -- Limite de crédito (NULL para cartões de débito)
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  closing_day INTEGER CHECK (closing_day >= 1 AND closing_day <= 31), -- Dia de fechamento da fatura
  due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31), -- Dia de vencimento da fatura
  current_balance DECIMAL(15,2) DEFAULT 0, -- Saldo atual (valor em aberto)
  available_limit DECIMAL(15,2), -- Limite disponível
  annual_fee DECIMAL(10,2) DEFAULT 0, -- Anuidade
  interest_rate DECIMAL(5,2), -- Taxa de juros mensal
  is_active BOOLEAN DEFAULT true,
  notes TEXT, -- Observações adicionais
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Card Statements table
CREATE TABLE IF NOT EXISTS credit_card_statements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL, -- Data da fatura
  due_date DATE NOT NULL, -- Data de vencimento
  previous_balance DECIMAL(15,2) DEFAULT 0, -- Saldo anterior
  payments DECIMAL(15,2) DEFAULT 0, -- Pagamentos realizados
  purchases DECIMAL(15,2) DEFAULT 0, -- Compras no período
  interest_charges DECIMAL(15,2) DEFAULT 0, -- Juros cobrados
  fees DECIMAL(15,2) DEFAULT 0, -- Taxas e tarifas
  total_amount DECIMAL(15,2) NOT NULL, -- Valor total da fatura
  minimum_payment DECIMAL(15,2), -- Pagamento mínimo
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  is_paid BOOLEAN DEFAULT false, -- Se a fatura foi paga
  payment_date DATE, -- Data do pagamento
  pdf_file_name VARCHAR(500), -- Nome do arquivo PDF importado (se aplicável)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Card Transactions table (detailed line items from statements)
CREATE TABLE IF NOT EXISTS credit_card_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES credit_card_statements(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  merchant_name VARCHAR(500) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL, -- Sempre valor positivo
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  transaction_type VARCHAR(50) DEFAULT 'purchase' CHECK (transaction_type IN ('purchase', 'refund', 'fee', 'interest', 'payment')),
  installments INTEGER DEFAULT 1, -- Número de parcelas
  installment_number INTEGER DEFAULT 1, -- Número da parcela atual
  description TEXT, -- Descrição adicional
  location VARCHAR(255), -- Local da transação (se disponível)
  pattern_matched VARCHAR(255), -- Padrão de comerciante que foi identificado
  confidence_score INTEGER, -- Confiança da categorização automática (0-100)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_active ON credit_cards(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_user_id ON credit_card_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_card_id ON credit_card_statements(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_date ON credit_card_statements(statement_date);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_user_id ON credit_card_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_card_id ON credit_card_transactions(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_statement_id ON credit_card_transactions(statement_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_date ON credit_card_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_category ON credit_card_transactions(category_id);

-- RLS (Row Level Security)
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can manage own credit cards" ON credit_cards
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own credit card statements" ON credit_card_statements
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own credit card transactions" ON credit_card_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Triggers para updated_at
CREATE TRIGGER update_credit_cards_updated_at BEFORE UPDATE ON credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_card_statements_updated_at BEFORE UPDATE ON credit_card_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_card_transactions_updated_at BEFORE UPDATE ON credit_card_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular limite disponível automaticamente
CREATE OR REPLACE FUNCTION update_available_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.credit_limit IS NOT NULL THEN
    NEW.available_limit = NEW.credit_limit - COALESCE(NEW.current_balance, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar limite disponível
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_credit_card_available_limit') THEN
        CREATE TRIGGER update_credit_card_available_limit BEFORE INSERT OR UPDATE
            ON credit_cards FOR EACH ROW EXECUTE FUNCTION update_available_limit();
    END IF;
END
$$;

-- Padrões conhecidos de cartões de crédito para detecção automática
CREATE TABLE IF NOT EXISTS credit_card_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name VARCHAR(255) NOT NULL,
  card_brands TEXT[] DEFAULT '{}', -- Marcas de cartão aceitas por este banco
  identification_keywords TEXT[] NOT NULL, -- Palavras-chave para identificar fatura deste banco
  confidence_score INTEGER DEFAULT 90,
  country_code VARCHAR(2) DEFAULT 'PT',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca otimizada
CREATE INDEX IF NOT EXISTS idx_credit_card_patterns_keywords ON credit_card_patterns USING GIN(identification_keywords);

-- Inserir padrões conhecidos de cartões de crédito
INSERT INTO credit_card_patterns (bank_name, card_brands, identification_keywords, confidence_score, country_code) 
SELECT * FROM (VALUES

-- Bancos Portugueses
('Millennium BCP', ARRAY['visa', 'mastercard'], ARRAY['millennium', 'bcp', 'cartao de credito', 'fatura cartao'], 95, 'PT'),
('Caixa Geral de Depósitos', ARRAY['visa', 'mastercard'], ARRAY['cgd', 'caixa geral', 'cartao de credito', 'extracto cartao'], 95, 'PT'),
('Santander Totta', ARRAY['visa', 'mastercard', 'american express'], ARRAY['santander', 'totta', 'cartao de credito'], 95, 'PT'),
('Novo Banco', ARRAY['visa', 'mastercard'], ARRAY['novo banco', 'cartao de credito'], 95, 'PT'),
('BPI', ARRAY['visa', 'mastercard'], ARRAY['bpi', 'banco portugues investimento', 'cartao de credito'], 95, 'PT'),
('Crédito Agrícola', ARRAY['visa', 'mastercard'], ARRAY['credito agricola', 'cartao de credito'], 90, 'PT'),
('Montepio', ARRAY['visa', 'mastercard'], ARRAY['montepio', 'cartao de credito'], 90, 'PT'),

-- Bancos Brasileiros
('Itaú Unibanco', ARRAY['visa', 'mastercard', 'elo'], ARRAY['itau', 'banco itau', 'fatura cartao', 'cartao de credito'], 95, 'BR'),
('Bradesco', ARRAY['visa', 'mastercard', 'elo'], ARRAY['bradesco', 'fatura cartao', 'cartao de credito'], 95, 'BR'),
('Banco do Brasil', ARRAY['visa', 'mastercard', 'elo'], ARRAY['banco do brasil', 'bb', 'fatura cartao'], 95, 'BR'),
('Santander Brasil', ARRAY['visa', 'mastercard'], ARRAY['santander', 'fatura cartao', 'cartao de credito'], 95, 'BR'),
('Caixa Econômica Federal', ARRAY['visa', 'mastercard', 'elo'], ARRAY['caixa economica', 'cef', 'fatura cartao'], 95, 'BR'),
('Nubank', ARRAY['mastercard'], ARRAY['nubank', 'nu pagamentos', 'fatura nubank', 'cartao roxinho'], 95, 'BR'),
('Inter', ARRAY['visa', 'mastercard'], ARRAY['banco inter', 'inter', 'fatura cartao'], 90, 'BR'),
('C6 Bank', ARRAY['mastercard'], ARRAY['c6 bank', 'c6', 'fatura cartao'], 90, 'BR'),
('BTG Pactual', ARRAY['visa', 'mastercard'], ARRAY['btg pactual', 'btg', 'fatura cartao'], 85, 'BR'),

-- Cartões Genéricos
('Cartão Genérico PT', ARRAY['visa', 'mastercard', 'american express'], ARRAY['fatura', 'cartao de credito', 'extracto cartao'], 70, 'PT'),
('Cartão Genérico BR', ARRAY['visa', 'mastercard', 'elo'], ARRAY['fatura', 'cartao de credito', 'extrato cartao'], 70, 'BR')

) AS new_patterns(bank_name, card_brands, identification_keywords, confidence_score, country_code)
WHERE NOT EXISTS (SELECT 1 FROM credit_card_patterns LIMIT 1);

-- Função para identificar se um texto é de fatura de cartão de crédito
CREATE OR REPLACE FUNCTION is_credit_card_statement(text_content TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    pattern_record credit_card_patterns%ROWTYPE;
    keyword TEXT;
    keyword_count INTEGER := 0;
    content_lower TEXT;
BEGIN
    content_lower := lower(text_content);
    
    -- Verificar se contém palavras-chave genéricas de cartão de crédito
    FOR pattern_record IN 
        SELECT * FROM credit_card_patterns WHERE is_active = true
    LOOP
        FOREACH keyword IN ARRAY pattern_record.identification_keywords
        LOOP
            IF position(lower(keyword) in content_lower) > 0 THEN
                keyword_count := keyword_count + 1;
                -- Se encontrar 2 ou mais palavras-chave, é provavelmente uma fatura de cartão
                IF keyword_count >= 2 THEN
                    RETURN true;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Função para identificar o banco emissor do cartão
CREATE OR REPLACE FUNCTION identify_credit_card_bank(text_content TEXT)
RETURNS TABLE(bank_name TEXT, confidence INTEGER) AS $$
DECLARE
    pattern_record credit_card_patterns%ROWTYPE;
    keyword TEXT;
    keyword_count INTEGER;
    content_lower TEXT;
    best_match_bank TEXT := 'Banco não identificado';
    best_confidence INTEGER := 0;
BEGIN
    content_lower := lower(text_content);
    
    FOR pattern_record IN 
        SELECT * FROM credit_card_patterns WHERE is_active = true ORDER BY confidence_score DESC
    LOOP
        keyword_count := 0;
        
        FOREACH keyword IN ARRAY pattern_record.identification_keywords
        LOOP
            IF position(lower(keyword) in content_lower) > 0 THEN
                keyword_count := keyword_count + 1;
            END IF;
        END LOOP;
        
        -- Calcular confiança baseada na quantidade de palavras-chave encontradas
        IF keyword_count > 0 THEN
            DECLARE
                calculated_confidence INTEGER;
            BEGIN
                calculated_confidence := LEAST(
                    pattern_record.confidence_score * keyword_count / array_length(pattern_record.identification_keywords, 1),
                    100
                );
                
                IF calculated_confidence > best_confidence THEN
                    best_match_bank := pattern_record.bank_name;
                    best_confidence := calculated_confidence;
                END IF;
            END;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT best_match_bank, best_confidence;
END;
$$ LANGUAGE plpgsql;

-- Inserir novas categorias específicas para cartões de crédito (se não existirem)
INSERT INTO public.categories (name, icon, color, type, is_default) 
SELECT * FROM (VALUES
    ('Anuidade Cartão', '💳', '#dc2626', 'expense', true),
    ('Juros Cartão', '📈', '#dc2626', 'expense', true),
    ('Pagamento Cartão', '💰', '#059669', 'expense', true),
    ('Estorno Cartão', '↩️', '#059669', 'income', true)
) AS new_categories(name, icon, color, type, is_default)
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories 
    WHERE name IN ('Anuidade Cartão', 'Juros Cartão', 'Pagamento Cartão', 'Estorno Cartão')
);
