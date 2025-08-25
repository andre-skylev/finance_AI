-- Ensure credit card core tables exist (idempotent)
-- Creates minimal structures if missing; safe to run multiple times

-- credit_cards
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  card_name varchar NOT NULL,
  bank_name varchar NOT NULL,
  card_brand varchar,
  last_four_digits varchar,
  card_type varchar DEFAULT 'credit' CHECK (card_type IN ('credit','debit')),
  credit_limit numeric,
  currency varchar NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR','BRL','USD')),
  closing_day integer CHECK (closing_day >= 1 AND closing_day <= 31),
  due_day integer CHECK (due_day >= 1 AND due_day <= 31),
  current_balance numeric DEFAULT 0,
  available_limit numeric,
  annual_fee numeric DEFAULT 0,
  interest_rate numeric,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT credit_cards_pkey PRIMARY KEY (id)
);

-- credit_card_transactions
CREATE TABLE IF NOT EXISTS public.credit_card_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  credit_card_id uuid,
  statement_id uuid,
  transaction_date date NOT NULL,
  merchant_name varchar NOT NULL,
  category_id uuid,
  amount numeric NOT NULL,
  currency varchar NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR','BRL','USD')),
  transaction_type varchar DEFAULT 'purchase' CHECK (transaction_type IN ('purchase','refund','fee','interest','payment')),
  installments integer DEFAULT 1,
  installment_number integer DEFAULT 1,
  description text,
  location varchar,
  pattern_matched varchar,
  confidence_score integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  receipt_id uuid,
  CONSTRAINT credit_card_transactions_pkey PRIMARY KEY (id)
);

-- Add FKs if missing (best-effort)
DO $$ BEGIN
  ALTER TABLE public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_credit_card_id_fkey
      FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_cc_tx_user ON public.credit_card_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_tx_card ON public.credit_card_transactions(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_cc_tx_date ON public.credit_card_transactions(transaction_date);

-- RLS policies (best-effort)
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY cc_select_own ON public.credit_cards
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cc_modify_own ON public.credit_cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cc_update_own ON public.credit_cards
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY cctx_select_own ON public.credit_card_transactions
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cctx_insert_own ON public.credit_card_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cctx_update_own ON public.credit_card_transactions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
