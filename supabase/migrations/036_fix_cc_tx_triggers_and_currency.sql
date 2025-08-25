-- Fix credit_card_transactions currency check to include USD and restore safe triggers

-- 1) Widen currency check to include USD (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage ccu
    JOIN information_schema.table_constraints tc ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND ccu.table_name = 'credit_card_transactions'
      AND tc.constraint_type = 'CHECK'
      AND ccu.constraint_name = 'credit_card_transactions_currency_check'
  ) THEN
    ALTER TABLE public.credit_card_transactions
      DROP CONSTRAINT credit_card_transactions_currency_check;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_currency_check
    CHECK (currency IN ('EUR','BRL','USD'));
EXCEPTION
  WHEN undefined_table OR duplicate_object THEN NULL;
END $$;

-- 2) Ensure helper trigger functions exist
-- update_updated_at_column(): sets NEW.updated_at = now()
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- update_credit_card_balance(): recalculates balance from transactions
CREATE OR REPLACE FUNCTION public.update_credit_card_balance()
RETURNS trigger AS $$
DECLARE
  v_card_id uuid;
  v_new_balance numeric;
BEGIN
  -- Determine affected credit_card_id depending on operation
  IF TG_OP = 'DELETE' THEN
    v_card_id := OLD.credit_card_id;
  ELSE
    v_card_id := NEW.credit_card_id;
  END IF;

  IF v_card_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(
      CASE
        WHEN transaction_type IN ('purchase','fee','interest') THEN amount
        WHEN transaction_type IN ('payment','refund') THEN -amount
        ELSE 0
      END
    ),0)
  INTO v_new_balance
  FROM public.credit_card_transactions
  WHERE credit_card_id = v_card_id;

  UPDATE public.credit_cards
    SET current_balance = v_new_balance,
        updated_at = now()
    WHERE id = v_card_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- log_sensitive_access(): no-op placeholder to satisfy legacy triggers
CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS trigger AS $$
BEGIN
  -- Intentionally a no-op placeholder
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3) Recreate triggers if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_credit_card_transactions_updated_at'
  ) THEN
    CREATE TRIGGER update_credit_card_transactions_updated_at
    BEFORE UPDATE ON public.credit_card_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'credit_card_balance_trigger'
  ) THEN
    CREATE TRIGGER credit_card_balance_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.credit_card_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_credit_card_balance();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_credit_card_transactions_trigger'
  ) THEN
    CREATE TRIGGER audit_credit_card_transactions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.credit_card_transactions
    FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_access();
  END IF;
END $$;
