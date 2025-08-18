-- Migration: Enhanced Document Processing and User Consent
-- Adds support for improved OCR processing, user consent, and import jobs

-- Import jobs table for background processing
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  file_name VARCHAR(500),
  document_type VARCHAR(50) CHECK (document_type IN ('credit_card_statement', 'bank_statement')),
  bank_name VARCHAR(255),
  transaction_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  metadata JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User consent settings
CREATE TABLE IF NOT EXISTS user_consent_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  auto_process_documents BOOLEAN DEFAULT false,
  auto_create_accounts BOOLEAN DEFAULT true,
  auto_create_cards BOOLEAN DEFAULT true,
  require_confirmation_below_confidence INTEGER DEFAULT 85,
  privacy_consent_date TIMESTAMP WITH TIME ZONE,
  terms_accepted_date TIMESTAMP WITH TIME ZONE,
  marketing_consent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document processing history
CREATE TABLE IF NOT EXISTS document_processing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL,
  file_name VARCHAR(500),
  file_size INTEGER,
  processing_method VARCHAR(50), -- 'pdf-parse', 'google-ocr', etc.
  processing_time_ms INTEGER,
  text_length INTEGER,
  document_type VARCHAR(50),
  bank_name VARCHAR(255),
  confidence_score INTEGER,
  transaction_count INTEGER,
  card_count INTEGER,
  installment_count INTEGER,
  auto_processed BOOLEAN DEFAULT false,
  user_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced credit cards table with dependent card support
ALTER TABLE credit_cards 
ADD COLUMN IF NOT EXISTS card_holder VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_dependent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS shared_limit_group UUID;

-- Installment tracking table
CREATE TABLE IF NOT EXISTS installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  credit_card_transaction_id UUID REFERENCES credit_card_transactions(id) ON DELETE CASCADE,
  reference_number VARCHAR(100),
  merchant_name VARCHAR(500),
  original_amount DECIMAL(15,2),
  installment_amount DECIMAL(15,2),
  current_installment INTEGER,
  total_installments INTEGER,
  interest_rate DECIMAL(5,2),
  transaction_date DATE,
  first_payment_date DATE,
  last_payment_date DATE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google AI usage tracking (for OCR limits)
CREATE TABLE IF NOT EXISTS google_ai_usage (
  date DATE PRIMARY KEY,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_document_processing_history_user_id ON document_processing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_installments_user_id ON installments(user_id);
CREATE INDEX IF NOT EXISTS idx_installments_reference ON installments(reference_number);
CREATE INDEX IF NOT EXISTS idx_credit_cards_holder ON credit_cards(card_holder);
CREATE INDEX IF NOT EXISTS idx_credit_cards_parent ON credit_cards(parent_card_id);

-- RLS Policies
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own import jobs" ON import_jobs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own consent settings" ON user_consent_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own processing history" ON document_processing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own installments" ON installments
  FOR ALL USING (auth.uid() = user_id);

-- Google AI usage is system-wide, admin only
CREATE POLICY "Only system can manage AI usage" ON google_ai_usage
  FOR ALL USING (false);

-- Triggers
CREATE TRIGGER update_import_jobs_updated_at BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_consent_settings_updated_at BEFORE UPDATE ON user_consent_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_installments_updated_at BEFORE UPDATE ON installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create credit card with holder information
CREATE OR REPLACE FUNCTION auto_create_credit_card_with_holder(
  p_user_id UUID,
  p_bank_name VARCHAR(255),
  p_card_holder VARCHAR(255),
  p_last_four_digits VARCHAR(4),
  p_card_brand VARCHAR(50) DEFAULT NULL,
  p_credit_limit DECIMAL(15,2) DEFAULT NULL,
  p_is_dependent BOOLEAN DEFAULT false,
  p_parent_card_id UUID DEFAULT NULL,
  p_shared_limit_group UUID DEFAULT NULL
)
RETURNS TABLE(
  card_id UUID,
  card_name VARCHAR(255),
  was_created BOOLEAN
) AS $$
DECLARE
  existing_card_id UUID;
  new_card_id UUID;
  new_card_name VARCHAR(255);
  was_card_created BOOLEAN := false;
BEGIN
  -- Check if card already exists
  SELECT id INTO existing_card_id
  FROM credit_cards
  WHERE user_id = p_user_id
    AND bank_name = p_bank_name
    AND last_four_digits = p_last_four_digits
    AND (card_holder = p_card_holder OR (card_holder IS NULL AND p_card_holder IS NULL))
  LIMIT 1;
  
  IF existing_card_id IS NOT NULL THEN
    -- Card exists, update if needed
    UPDATE credit_cards
    SET 
      card_holder = COALESCE(p_card_holder, card_holder),
      card_brand = COALESCE(p_card_brand, card_brand),
      credit_limit = COALESCE(p_credit_limit, credit_limit),
      is_dependent = p_is_dependent,
      parent_card_id = p_parent_card_id,
      shared_limit_group = p_shared_limit_group,
      updated_at = NOW()
    WHERE id = existing_card_id;
    
    SELECT card_name INTO new_card_name
    FROM credit_cards
    WHERE id = existing_card_id;
    
    RETURN QUERY SELECT existing_card_id, new_card_name, false;
  ELSE
    -- Create new card
    new_card_name := COALESCE(
      p_card_holder || ' - ' || p_bank_name || ' ****' || p_last_four_digits,
      p_bank_name || ' ****' || p_last_four_digits
    );
    
    -- Generate shared limit group if not provided and card has limit
    IF p_shared_limit_group IS NULL AND p_credit_limit IS NOT NULL THEN
      p_shared_limit_group := gen_random_uuid();
    END IF;
    
    INSERT INTO credit_cards (
      user_id,
      card_name,
      bank_name,
      card_brand,
      last_four_digits,
      card_holder,
      credit_limit,
      is_dependent,
      parent_card_id,
      shared_limit_group,
      currency,
      is_active
    ) VALUES (
      p_user_id,
      new_card_name,
      p_bank_name,
      p_card_brand,
      p_last_four_digits,
      p_card_holder,
      p_credit_limit,
      p_is_dependent,
      p_parent_card_id,
      p_shared_limit_group,
      'EUR',
      true
    ) RETURNING id INTO new_card_id;
    
    RETURN QUERY SELECT new_card_id, new_card_name, true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process installment transactions
CREATE OR REPLACE FUNCTION process_installment_transaction(
  p_user_id UUID,
  p_transaction_id UUID,
  p_reference VARCHAR(100),
  p_current_installment INTEGER,
  p_total_installments INTEGER,
  p_merchant VARCHAR(500),
  p_original_amount DECIMAL(15,2) DEFAULT NULL,
  p_interest_rate DECIMAL(5,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_installment_id UUID;
  transaction_amount DECIMAL(15,2);
  transaction_date DATE;
BEGIN
  -- Get transaction details
  SELECT amount, date INTO transaction_amount, transaction_date
  FROM transactions
  WHERE id = p_transaction_id AND user_id = p_user_id;
  
  IF transaction_amount IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  -- Check if installment already exists
  SELECT id INTO new_installment_id
  FROM installments
  WHERE user_id = p_user_id
    AND transaction_id = p_transaction_id;
  
  IF new_installment_id IS NOT NULL THEN
    -- Update existing installment
    UPDATE installments
    SET
      reference_number = COALESCE(p_reference, reference_number),
      current_installment = COALESCE(p_current_installment, current_installment),
      total_installments = COALESCE(p_total_installments, total_installments),
      merchant_name = COALESCE(p_merchant, merchant_name),
      original_amount = COALESCE(p_original_amount, original_amount),
      interest_rate = COALESCE(p_interest_rate, interest_rate),
      updated_at = NOW()
    WHERE id = new_installment_id;
  ELSE
    -- Create new installment record
    INSERT INTO installments (
      user_id,
      transaction_id,
      reference_number,
      merchant_name,
      original_amount,
      installment_amount,
      current_installment,
      total_installments,
      interest_rate,
      transaction_date,
      first_payment_date,
      status
    ) VALUES (
      p_user_id,
      p_transaction_id,
      p_reference,
      p_merchant,
      COALESCE(p_original_amount, transaction_amount * p_total_installments),
      transaction_amount,
      p_current_installment,
      p_total_installments,
      p_interest_rate,
      transaction_date,
      transaction_date - INTERVAL '1 month' * (p_current_installment - 1),
      CASE 
        WHEN p_current_installment >= p_total_installments THEN 'completed'
        ELSE 'active'
      END
    ) RETURNING id INTO new_installment_id;
  END IF;
  
  RETURN new_installment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for installment summary
DROP VIEW IF EXISTS installment_summary;
CREATE VIEW installment_summary AS
SELECT 
  i.user_id,
  i.merchant_name,
  i.reference_number,
  i.original_amount,
  i.total_installments,
  COUNT(*) as paid_installments,
  SUM(i.installment_amount) as total_paid,
  i.original_amount - SUM(i.installment_amount) as remaining_amount,
  MAX(i.current_installment) as last_installment_number,
  i.status,
  i.interest_rate,
  MIN(i.first_payment_date) as first_payment_date,
  MAX(i.transaction_date) as last_payment_date
FROM installments i
WHERE i.user_id = auth.uid()
GROUP BY 
  i.user_id,
  i.merchant_name,
  i.reference_number,
  i.original_amount,
  i.total_installments,
  i.status,
  i.interest_rate;