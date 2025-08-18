-- Função para criar automaticamente cartão de crédito a partir de fatura
CREATE OR REPLACE FUNCTION auto_create_credit_card_from_statement(
  p_user_id UUID,
  p_bank_name TEXT,
  p_last_four_digits TEXT DEFAULT NULL,
  p_card_brand TEXT DEFAULT NULL,
  p_credit_limit DECIMAL DEFAULT NULL,
  p_statement_text TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_card_id UUID;
  v_card_name TEXT;
  v_existing_card_id UUID;
BEGIN
  -- Verificar se já existe um cartão com os mesmos identificadores
  SELECT id INTO v_existing_card_id
  FROM credit_cards 
  WHERE user_id = p_user_id 
    AND bank_name ILIKE p_bank_name
    AND (
      (p_last_four_digits IS NOT NULL AND last_four_digits = p_last_four_digits)
      OR (p_last_four_digits IS NULL)
    )
  LIMIT 1;
  
  -- Se já existe, retornar o ID existente
  IF v_existing_card_id IS NOT NULL THEN
    RETURN v_existing_card_id;
  END IF;
  
  -- Gerar nome automático para o cartão
  v_card_name := p_bank_name;
  IF p_last_four_digits IS NOT NULL THEN
    v_card_name := v_card_name || ' •••• ' || p_last_four_digits;
  END IF;
  IF p_card_brand IS NOT NULL THEN
    v_card_name := v_card_name || ' (' || p_card_brand || ')';
  END IF;
  
  -- Criar novo cartão
  INSERT INTO credit_cards (
    user_id,
    card_name,
    bank_name,
    card_brand,
    last_four_digits,
    card_type,
    credit_limit,
    currency,
    current_balance,
    is_active,
    notes
  ) VALUES (
    p_user_id,
    v_card_name,
    p_bank_name,
    p_card_brand,
    p_last_four_digits,
    'credit',
    p_credit_limit,
    'EUR', -- Default, pode ser ajustado
    0,
    true,
    'Cartão criado automaticamente a partir de fatura importada'
  ) RETURNING id INTO v_card_id;
  
  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql;

-- Função para criar automaticamente conta bancária a partir de extrato
CREATE OR REPLACE FUNCTION auto_create_bank_account_from_statement(
  p_user_id UUID,
  p_bank_name TEXT,
  p_account_number TEXT DEFAULT NULL,
  p_account_type TEXT DEFAULT 'checking',
  p_currency TEXT DEFAULT 'EUR',
  p_initial_balance DECIMAL DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_account_name TEXT;
  v_existing_account_id UUID;
  v_partial_account TEXT;
BEGIN
  -- Extrair apenas os últimos 4 dígitos se o número da conta for muito longo
  IF p_account_number IS NOT NULL AND length(p_account_number) > 8 THEN
    v_partial_account := '•••• ' || right(p_account_number, 4);
  ELSE
    v_partial_account := p_account_number;
  END IF;
  
  -- Verificar se já existe uma conta com identificadores similares
  SELECT id INTO v_existing_account_id
  FROM accounts 
  WHERE user_id = p_user_id 
    AND bank_name ILIKE p_bank_name
    AND (
      (p_account_number IS NOT NULL AND name LIKE '%' || right(p_account_number, 4) || '%')
      OR (p_account_number IS NULL)
    )
  LIMIT 1;
  
  -- Se já existe, retornar o ID existente
  IF v_existing_account_id IS NOT NULL THEN
    RETURN v_existing_account_id;
  END IF;
  
  -- Gerar nome automático para a conta
  v_account_name := p_bank_name;
  IF v_partial_account IS NOT NULL THEN
    v_account_name := v_account_name || ' ' || v_partial_account;
  END IF;
  
  -- Criar nova conta
  INSERT INTO accounts (
    user_id,
    name,
    bank_name,
    account_type,
    currency,
    balance,
    is_active
  ) VALUES (
    p_user_id,
    v_account_name,
    p_bank_name,
    p_account_type,
    p_currency,
    p_initial_balance,
    true
  ) RETURNING id INTO v_account_id;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Função para processar automaticamente documento e criar cartão/conta se necessário
CREATE OR REPLACE FUNCTION auto_process_and_create_account(
  p_user_id UUID,
  p_document_type TEXT, -- 'credit_card_statement' ou 'bank_statement'
  p_bank_name TEXT,
  p_last_four_digits TEXT DEFAULT NULL,
  p_card_brand TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL,
  p_credit_limit DECIMAL DEFAULT NULL,
  p_currency TEXT DEFAULT 'EUR'
)
RETURNS TABLE(
  account_id UUID,
  account_type TEXT,
  was_created BOOLEAN,
  account_name TEXT
) AS $$
DECLARE
  v_id UUID;
  v_was_created BOOLEAN := false;
  v_name TEXT;
BEGIN
  IF p_document_type = 'credit_card_statement' THEN
    -- Processar fatura de cartão de crédito
    SELECT credit_cards.id, credit_cards.card_name
    INTO v_id, v_name
    FROM credit_cards 
    WHERE user_id = p_user_id 
      AND bank_name ILIKE p_bank_name
      AND (
        (p_last_four_digits IS NOT NULL AND last_four_digits = p_last_four_digits)
        OR (p_last_four_digits IS NULL)
      )
    LIMIT 1;
    
    IF v_id IS NULL THEN
      v_id := auto_create_credit_card_from_statement(
        p_user_id, p_bank_name, p_last_four_digits, p_card_brand, p_credit_limit
      );
      v_was_created := true;
      SELECT card_name INTO v_name FROM credit_cards WHERE id = v_id;
    END IF;
    
    RETURN QUERY SELECT v_id, 'credit_card'::TEXT, v_was_created, v_name;
    
  ELSE
    -- Processar extrato bancário
    SELECT accounts.id, accounts.name
    INTO v_id, v_name
    FROM accounts 
    WHERE user_id = p_user_id 
      AND bank_name ILIKE p_bank_name
      AND (
        (p_account_number IS NOT NULL AND name LIKE '%' || right(p_account_number, 4) || '%')
        OR (p_account_number IS NULL)
      )
    LIMIT 1;
    
    IF v_id IS NULL THEN
      v_id := auto_create_bank_account_from_statement(
        p_user_id, p_bank_name, p_account_number, 'checking', p_currency
      );
      v_was_created := true;
      SELECT name INTO v_name FROM accounts WHERE id = v_id;
    END IF;
    
    RETURN QUERY SELECT v_id, 'bank_account'::TEXT, v_was_created, v_name;
    
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para sugerir label editável baseado no contexto
CREATE OR REPLACE FUNCTION suggest_account_label(
  p_bank_name TEXT,
  p_last_four_digits TEXT DEFAULT NULL,
  p_card_brand TEXT DEFAULT NULL,
  p_account_type TEXT DEFAULT 'checking'
)
RETURNS TEXT AS $$
DECLARE
  v_label TEXT;
  v_type_name TEXT;
BEGIN
  -- Traduzir tipo de conta para português
  CASE p_account_type
    WHEN 'checking' THEN v_type_name := 'Conta Corrente';
    WHEN 'savings' THEN v_type_name := 'Poupança';
    WHEN 'credit' THEN v_type_name := 'Cartão de Crédito';
    WHEN 'investment' THEN v_type_name := 'Investimento';
    ELSE v_type_name := 'Conta';
  END CASE;
  
  -- Construir label sugerido
  v_label := p_bank_name || ' - ' || v_type_name;
  
  IF p_card_brand IS NOT NULL THEN
    v_label := v_label || ' ' || p_card_brand;
  END IF;
  
  IF p_last_four_digits IS NOT NULL THEN
    v_label := v_label || ' •••• ' || p_last_four_digits;
  END IF;
  
  RETURN v_label;
END;
$$ LANGUAGE plpgsql;

-- Atualizar tabela de contas para incluir flag de criação automática
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT true;

-- Índices para performance nas buscas de identificação
CREATE INDEX IF NOT EXISTS idx_accounts_bank_name_partial ON accounts(user_id, bank_name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_credit_cards_bank_digits ON credit_cards(user_id, bank_name, last_four_digits) WHERE is_active = true;
