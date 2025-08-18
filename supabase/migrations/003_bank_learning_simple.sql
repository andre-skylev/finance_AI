-- Criar tabela bank_patterns de forma simples
CREATE TABLE IF NOT EXISTS bank_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_name TEXT NOT NULL,
  country TEXT,
  currency TEXT,
  document_patterns JSONB,
  date_formats TEXT[],
  amount_patterns TEXT[],
  category_mappings JSONB,
  confidence_level TEXT DEFAULT 'medium',
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1,
  created_by UUID,
  is_verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bank_patterns_institution ON bank_patterns(institution_name);
CREATE INDEX IF NOT EXISTS idx_bank_patterns_country ON bank_patterns(country);
CREATE INDEX IF NOT EXISTS idx_bank_patterns_currency ON bank_patterns(currency);

-- RLS
ALTER TABLE bank_patterns ENABLE ROW LEVEL SECURITY;

-- Policies simplificadas
CREATE POLICY "Public read access" ON bank_patterns FOR SELECT USING (true);
CREATE POLICY "Authenticated insert" ON bank_patterns FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update" ON bank_patterns FOR UPDATE USING (true);

-- Criar tabela extraction_logs
CREATE TABLE IF NOT EXISTS extraction_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  institution_name TEXT,
  document_type TEXT,
  extraction_confidence TEXT,
  transactions_found INTEGER,
  success_rate DECIMAL(3,2),
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
CREATE POLICY "Users own logs" ON extraction_logs FOR ALL USING (true);
