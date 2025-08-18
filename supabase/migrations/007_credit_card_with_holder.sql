-- Migração para suporte a cartões dependentes com portadores
-- Data: 2025-08-18
-- Descrição: Adiciona função para criar cartões com informação do portador

-- Função para criar automaticamente cartão de crédito com informação do portador
CREATE OR REPLACE FUNCTION auto_create_credit_card_with_holder(
  p_user_id UUID,
  p_bank_name TEXT,
  p_card_holder TEXT,
  p_last_four_digits TEXT DEFAULT NULL,
  p_card_brand TEXT DEFAULT NULL,
  p_credit_limit DECIMAL DEFAULT NULL,
  p_is_dependent BOOLEAN DEFAULT false
)
RETURNS TABLE(
  card_id UUID,
  card_name TEXT,
  was_created BOOLEAN
) AS $$
DECLARE
  v_card_id UUID;
  v_card_name TEXT;
  v_existing_card_id UUID;
  v_was_created BOOLEAN := false;
BEGIN
  -- Verificar se já existe um cartão com os mesmos identificadores
  SELECT id INTO v_existing_card_id
  FROM credit_cards 
  WHERE user_id = p_user_id 
    AND bank_name ILIKE p_bank_name
    AND (
      (p_last_four_digits IS NOT NULL AND last_four_digits = p_last_four_digits)
      OR (p_last_four_digits IS NULL AND card_name ILIKE '%' || p_card_holder || '%')
    )
  LIMIT 1;
  
  -- Se já existe, retornar o ID existente
  IF v_existing_card_id IS NOT NULL THEN
    SELECT credit_cards.card_name INTO v_card_name FROM credit_cards WHERE id = v_existing_card_id;
    RETURN QUERY SELECT v_existing_card_id, v_card_name, false;
    RETURN;
  END IF;
  
  -- Gerar nome automático para o cartão incluindo o portador
  v_card_name := p_bank_name;
  
  -- Adicionar indicação de dependente
  IF p_is_dependent THEN
    v_card_name := v_card_name || ' (Dependente)';
  END IF;
  
  -- Adicionar últimos 4 dígitos se disponível
  IF p_last_four_digits IS NOT NULL THEN
    v_card_name := v_card_name || ' •••• ' || p_last_four_digits;
  END IF;
  
  -- Adicionar marca do cartão se disponível
  IF p_card_brand IS NOT NULL THEN
    v_card_name := v_card_name || ' (' || p_card_brand || ')';
  END IF;
  
  -- Adicionar nome do portador
  v_card_name := v_card_name || ' - ' || p_card_holder;
  
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
    CASE 
      WHEN p_is_dependent THEN 'Cartão dependente criado automaticamente - Portador: ' || p_card_holder
      ELSE 'Cartão principal criado automaticamente - Portador: ' || p_card_holder
    END
  ) RETURNING id INTO v_card_id;
  
  v_was_created := true;
  
  RETURN QUERY SELECT v_card_id, v_card_name, v_was_created;
END;
$$ LANGUAGE plpgsql;

-- Comentário da migração
COMMENT ON FUNCTION auto_create_credit_card_with_holder IS 'Cria cartões de crédito com informação do portador, suportando cartões dependentes';
