-- Migration: Enhance Credit Card Transactions for Installments
-- Adds fields for better installment tracking and Portuguese fatura parsing

-- Add new fields to credit_card_transactions table
ALTER TABLE credit_card_transactions 
ADD COLUMN IF NOT EXISTS tan_rate DECIMAL(5,4), -- Taxa de juro (ex: 9.9000%)
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2); -- Valor original antes do parcelamento

-- Create function to update available limit when transactions are added
CREATE OR REPLACE FUNCTION update_credit_card_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Atualizar saldo atual do cartão
    UPDATE credit_cards 
    SET current_balance = current_balance + NEW.amount,
        available_limit = credit_limit - (current_balance + NEW.amount),
        updated_at = NOW()
    WHERE id = NEW.credit_card_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Atualizar baseado na diferença
    UPDATE credit_cards 
    SET current_balance = current_balance - OLD.amount + NEW.amount,
        available_limit = credit_limit - (current_balance - OLD.amount + NEW.amount),
        updated_at = NOW()
    WHERE id = NEW.credit_card_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Remover valor do saldo
    UPDATE credit_cards 
    SET current_balance = current_balance - OLD.amount,
        available_limit = credit_limit - (current_balance - OLD.amount),
        updated_at = NOW()
    WHERE id = OLD.credit_card_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update balances
CREATE TRIGGER credit_card_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON credit_card_transactions
  FOR EACH ROW EXECUTE FUNCTION update_credit_card_balance();

-- Create view for installment summary
CREATE OR REPLACE VIEW installment_summary AS
SELECT 
  merchant_name,
  original_amount,
  installments,
  COUNT(*) as paid_installments,
  SUM(amount) as total_paid,
  original_amount - SUM(amount) as remaining_amount,
  (COUNT(*) * 100.0 / installments) as progress_percentage,
  MAX(transaction_date) as last_payment_date,
  (MAX(transaction_date) + INTERVAL '1 month') as next_payment_date,
  credit_card_id,
  user_id,
  tan_rate
FROM credit_card_transactions 
WHERE installments > 1 
GROUP BY merchant_name, original_amount, installments, credit_card_id, user_id, tan_rate;

-- Grant permissions for the view
GRANT SELECT ON installment_summary TO authenticated;

-- Comments for documentation
COMMENT ON COLUMN credit_card_transactions.tan_rate IS 'Taxa de juro anual nominal (TAN) para parcelamentos';
COMMENT ON COLUMN credit_card_transactions.original_amount IS 'Valor original da compra antes do parcelamento';
COMMENT ON VIEW installment_summary IS 'Resumo dos parcelamentos ativos por usuário';
