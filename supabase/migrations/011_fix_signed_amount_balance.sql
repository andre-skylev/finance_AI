-- Migration: Fix account balance updates to use signed transaction amounts
-- Created: 2025-08-22

-- Replace function to update account balances using signed amounts
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: add signed amount
  IF TG_OP = 'INSERT' THEN
    UPDATE public.accounts 
    SET 
      balance = COALESCE(balance, 0) + COALESCE(NEW.amount, 0),
      updated_at = NOW()
    WHERE id = NEW.account_id;
    RETURN NEW;
  END IF;

  -- UPDATE: remove old signed amount and add new signed amount
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.accounts 
    SET 
      balance = COALESCE(balance, 0) - COALESCE(OLD.amount, 0) + COALESCE(NEW.amount, 0),
      updated_at = NOW()
    WHERE id = NEW.account_id;
    RETURN NEW;
  END IF;

  -- DELETE: subtract old signed amount
  IF TG_OP = 'DELETE' THEN
    UPDATE public.accounts 
    SET 
      balance = COALESCE(balance, 0) - COALESCE(OLD.amount, 0),
      updated_at = NOW()
    WHERE id = OLD.account_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
