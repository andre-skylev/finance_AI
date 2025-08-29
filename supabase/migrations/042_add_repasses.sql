-- Repasses (Payouts) core tables
-- Creates repasse_rules and repasse_executions with RLS

create table if not exists public.repasse_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  percentage numeric not null check (percentage > 0 and percentage <= 100),
  payout_day int not null check (payout_day >= 1 and payout_day <= 31),
  -- target_account_id kept for backwards-compat but unused by UI/API
  target_account_id uuid references public.accounts(id) on delete set null,
  -- If true, this rule is intended to run every period (e.g., monthly) like a profit-sharing
  is_recurring boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.repasse_rules enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'repasse_rules' and policyname = 'repasse_rules_select_own'
  ) then
    create policy repasse_rules_select_own on public.repasse_rules
      for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'repasse_rules' and policyname = 'repasse_rules_modify_own'
  ) then
    create policy repasse_rules_modify_own on public.repasse_rules
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

create table if not exists public.repasse_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null references public.repasse_rules(id) on delete cascade,
  execution_date date not null,
  amount numeric not null check (amount >= 0),
  currency text not null check (currency in ('EUR','BRL','USD')),
  account_id uuid references public.accounts(id) on delete set null,
  notes text,
  bank_transaction_id uuid references public.bank_account_transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.repasse_executions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'repasse_executions' and policyname = 'repasse_executions_select_own'
  ) then
    create policy repasse_executions_select_own on public.repasse_executions
      for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'repasse_executions' and policyname = 'repasse_executions_modify_own'
  ) then
    create policy repasse_executions_modify_own on public.repasse_executions
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Targets: allow multi-account allocation per rule (percentages should sum to 100 client-side)
create table if not exists public.repasse_rule_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null references public.repasse_rules(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  share_percent numeric not null check (share_percent > 0 and share_percent <= 100),
  created_at timestamptz not null default now()
);

alter table public.repasse_rule_targets enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'repasse_rule_targets' and policyname = 'repasse_rule_targets_select_own'
  ) then
    create policy repasse_rule_targets_select_own on public.repasse_rule_targets
      for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'repasse_rule_targets' and policyname = 'repasse_rule_targets_modify_own'
  ) then
    create policy repasse_rule_targets_modify_own on public.repasse_rule_targets
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Sources: accounts whose profits are summed to form the base for the rule percentage
create table if not exists public.repasse_rule_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null references public.repasse_rules(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.repasse_rule_sources enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'repasse_rule_sources' and policyname = 'repasse_rule_sources_select_own'
  ) then
    create policy repasse_rule_sources_select_own on public.repasse_rule_sources
      for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'repasse_rule_sources' and policyname = 'repasse_rule_sources_modify_own'
  ) then
    create policy repasse_rule_sources_modify_own on public.repasse_rule_sources
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
