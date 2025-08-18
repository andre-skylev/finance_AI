-- Adicionar tabela para armazenar bancos identificados automaticamente
CREATE TABLE IF NOT EXISTS bank_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_name TEXT NOT NULL,
  country TEXT,
  currency TEXT,
  document_patterns JSONB, -- Padrões identificados no documento
  date_formats TEXT[],     -- Formatos de data encontrados
  amount_patterns TEXT[],  -- Padrões de valores
  category_mappings JSONB, -- Mapeamentos de categorias específicos
  confidence_level TEXT DEFAULT 'medium',
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1,
  created_by UUID REFERENCES users(id),
  is_verified BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_bank_patterns_institution ON bank_patterns(institution_name);
CREATE INDEX IF NOT EXISTS idx_bank_patterns_country ON bank_patterns(country);
CREATE INDEX IF NOT EXISTS idx_bank_patterns_currency ON bank_patterns(currency);

-- RLS para bank_patterns
ALTER TABLE bank_patterns ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver todos os padrões de bancos (para aprendizado coletivo)
CREATE POLICY "Users can view all bank patterns" ON bank_patterns
  FOR SELECT USING (true);

-- Usuários podem inserir novos padrões
CREATE POLICY "Users can insert bank patterns" ON bank_patterns
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Usuários podem atualizar padrões que criaram
CREATE POLICY "Users can update own bank patterns" ON bank_patterns
  FOR UPDATE USING (auth.uid() = created_by);

-- Adicionar tabela para log de extrações (para melhorar IA)
CREATE TABLE IF NOT EXISTS extraction_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  institution_name TEXT,
  document_type TEXT,
  extraction_confidence TEXT,
  transactions_found INTEGER,
  success_rate DECIMAL(3,2), -- 0.00 to 1.00
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_notes TEXT,
  raw_text_length INTEGER,
  processing_time_ms INTEGER,
  openai_tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  bank_pattern_id UUID REFERENCES bank_patterns(id)
);

-- RLS para extraction_logs
ALTER TABLE extraction_logs ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ver seus próprios logs
CREATE POLICY "Users can view own extraction logs" ON extraction_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios logs
CREATE POLICY "Users can insert extraction logs" ON extraction_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Função para atualizar ou criar padrão de banco
CREATE OR REPLACE FUNCTION upsert_bank_pattern(
  p_institution_name TEXT,
  p_country TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_document_patterns JSONB DEFAULT NULL,
  p_confidence TEXT DEFAULT 'medium',
  p_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  pattern_id UUID;
BEGIN
  -- Tentar atualizar padrão existente
  UPDATE bank_patterns 
  SET 
    last_seen = NOW(),
    usage_count = usage_count + 1,
    country = COALESCE(p_country, country),
    currency = COALESCE(p_currency, currency),
    document_patterns = COALESCE(p_document_patterns, document_patterns),
    confidence_level = CASE 
      WHEN usage_count > 5 THEN 'high'
      WHEN usage_count > 2 THEN 'medium'
      ELSE 'low'
    END
  WHERE LOWER(institution_name) = LOWER(p_institution_name)
  RETURNING id INTO pattern_id;

  -- Se não encontrou, criar novo
  IF pattern_id IS NULL THEN
    INSERT INTO bank_patterns (
      institution_name,
      country,
      currency,
      document_patterns,
      confidence_level,
      created_by
    ) VALUES (
      p_institution_name,
      p_country,
      p_currency,
      p_document_patterns,
      p_confidence,
      COALESCE(p_user_id, auth.uid())
    ) RETURNING id INTO pattern_id;
  END IF;

  RETURN pattern_id;
END;
$$ LANGUAGE plpgsql;

-- Função para obter padrões de bancos conhecidos
CREATE OR REPLACE FUNCTION get_known_bank_patterns()
RETURNS TABLE (
  institution_name TEXT,
  country TEXT,
  currency TEXT,
  confidence_level TEXT,
  usage_count INTEGER,
  date_formats TEXT[],
  category_mappings JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.institution_name,
    bp.country,
    bp.currency,
    bp.confidence_level,
    bp.usage_count,
    bp.date_formats,
    bp.category_mappings
  FROM bank_patterns bp
  WHERE bp.usage_count > 0
  ORDER BY bp.usage_count DESC, bp.confidence_level DESC;
END;
$$ LANGUAGE plpgsql;
