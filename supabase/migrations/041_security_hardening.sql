-- Security hardening to address Supabase linter findings
-- - Convert SECURITY DEFINER views to SECURITY INVOKER
-- - Enable RLS and add sane policies on flagged public tables

-- 1) Views: force SECURITY INVOKER (Postgres 15+)
DO $$ BEGIN
  EXECUTE 'ALTER VIEW IF EXISTS public.accounts_masked SET (security_invoker = true)';
  EXECUTE 'ALTER VIEW IF EXISTS public.account_summary SET (security_invoker = true)';
  EXECUTE 'ALTER VIEW IF EXISTS public.accounts_secure SET (security_invoker = true)';
  EXECUTE 'ALTER VIEW IF EXISTS public.account_balances_secure SET (security_invoker = true)';
  EXECUTE 'ALTER VIEW IF EXISTS public.credit_cards_masked SET (security_invoker = true)';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not alter one or more views to security_invoker: %', SQLERRM;
END $$;

-- 2) Enable RLS on flagged tables (idempotent)
ALTER TABLE IF EXISTS public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enhanced_transaction_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipt_items_backup_20250824 ENABLE ROW LEVEL SECURITY;

-- 3) Policies
-- 3.1 exchange_rates: allow read for anon/authenticated, deny write (service role bypasses RLS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exchange_rates' AND policyname = 'allow_read_rates'
  ) THEN
    CREATE POLICY allow_read_rates ON public.exchange_rates FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- 3.2 bank_statements: user can CRUD only own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bank_statements' AND policyname = 'bank_statements_select_own'
  ) THEN
    CREATE POLICY bank_statements_select_own ON public.bank_statements FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bank_statements' AND policyname = 'bank_statements_insert_own'
  ) THEN
    CREATE POLICY bank_statements_insert_own ON public.bank_statements FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bank_statements' AND policyname = 'bank_statements_update_own'
  ) THEN
    CREATE POLICY bank_statements_update_own ON public.bank_statements FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bank_statements' AND policyname = 'bank_statements_delete_own'
  ) THEN
    CREATE POLICY bank_statements_delete_own ON public.bank_statements FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 3.3 enhanced_transaction_patterns: readable to all app users, no writes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'enhanced_transaction_patterns' AND policyname = 'patterns_read_all'
  ) THEN
    CREATE POLICY patterns_read_all ON public.enhanced_transaction_patterns FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- 3.4 user_security_settings: user can view/update own settings; insert own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_security_settings' AND policyname = 'user_security_select_own'
  ) THEN
    CREATE POLICY user_security_select_own ON public.user_security_settings FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_security_settings' AND policyname = 'user_security_insert_own'
  ) THEN
    CREATE POLICY user_security_insert_own ON public.user_security_settings FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_security_settings' AND policyname = 'user_security_update_own'
  ) THEN
    CREATE POLICY user_security_update_own ON public.user_security_settings FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 3.5 audit_log: user can read only own entries; writes done by service role (bypasses RLS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log' AND policyname = 'audit_log_select_own'
  ) THEN
    CREATE POLICY audit_log_select_own ON public.audit_log FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 3.6 receipt_items_backup_20250824: enable RLS with no policies (deny all)
-- Intentionally no read/write policies for end-users.
