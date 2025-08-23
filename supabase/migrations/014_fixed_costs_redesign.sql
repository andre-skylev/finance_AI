-- Nova estrutura para custos fixos europeus
-- Esta migração redefine o sistema de custos fixos para ser mais adequado ao contexto europeu

-- 1. Criar tabela para diferentes tipos de custos fixos
CREATE TYPE public.fixed_cost_type AS ENUM (
  'utilities',     -- Serviços públicos (água, gás, eletricidade)
  'housing',       -- Habitação (renda, condomínio, seguro)
  'insurance',     -- Seguros (saúde, automóvel, vida)
  'transport',     -- Transportes (passes, seguros automóvel)
  'communication', -- Comunicações (internet, telefone, TV)
  'financial',     -- Financeiros (empréstimos, cartões)
  'subscriptions', -- Subscrições (Netflix, Spotify, etc)
  'other'          -- Outros
);

-- 2. Criar tabela para lançamentos mensais de custos fixos
CREATE TABLE public.fixed_cost_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  fixed_cost_id UUID REFERENCES public.fixed_costs(id) ON DELETE CASCADE,
  month_year DATE NOT NULL, -- Formato YYYY-MM-01 para identificar o mês
  amount DECIMAL(15,2) NOT NULL,
  actual_amount DECIMAL(15,2), -- Valor real quando disponível
  due_date DATE,
  payment_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que só existe um lançamento por custo fixo por mês
  UNIQUE(fixed_cost_id, month_year)
);

-- 3. Adicionar tipo à tabela de custos fixos existente
ALTER TABLE public.fixed_costs 
ADD COLUMN cost_type public.fixed_cost_type DEFAULT 'other',
ADD COLUMN estimated_amount DECIMAL(15,2), -- Valor estimado quando variável
ADD COLUMN provider TEXT, -- Fornecedor (EDP, Vodafone, etc)
ADD COLUMN account_number TEXT, -- Número da conta/contrato
ADD COLUMN auto_payment BOOLEAN DEFAULT FALSE, -- Débito direto
ADD COLUMN notification_days INTEGER DEFAULT 5; -- Dias antes para notificar

-- 4. Índices para performance
CREATE INDEX idx_fixed_cost_entries_user_month ON public.fixed_cost_entries(user_id, month_year);
CREATE INDEX idx_fixed_cost_entries_status ON public.fixed_cost_entries(status);
CREATE INDEX idx_fixed_costs_type ON public.fixed_costs(cost_type);

-- 5. RLS (Row Level Security)
ALTER TABLE public.fixed_cost_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fixed cost entries" ON public.fixed_cost_entries
  USING (user_id = auth.uid());

-- 6. Trigger para atualizar updated_at
CREATE TRIGGER update_fixed_cost_entries_updated_at 
  BEFORE UPDATE ON public.fixed_cost_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Função para gerar lançamentos automáticos para o próximo mês
CREATE OR REPLACE FUNCTION generate_monthly_fixed_cost_entries(target_month DATE DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE)
RETURNS INTEGER AS $$
DECLARE
  cost_record RECORD;
  entries_created INTEGER := 0;
BEGIN
  -- Para cada custo fixo ativo
  FOR cost_record IN 
    SELECT fc.*, u.id as user_id
    FROM fixed_costs fc
    JOIN users u ON fc.user_id = u.id
    WHERE fc.is_active = TRUE
      AND (fc.end_date IS NULL OR fc.end_date >= target_month)
      AND fc.start_date <= target_month
  LOOP
    -- Verificar se já existe lançamento para este mês
    IF NOT EXISTS (
      SELECT 1 FROM fixed_cost_entries 
      WHERE fixed_cost_id = cost_record.id 
        AND month_year = target_month
    ) THEN
      -- Criar lançamento
      INSERT INTO fixed_cost_entries (
        user_id,
        fixed_cost_id, 
        month_year,
        amount,
        due_date
      ) VALUES (
        cost_record.user_id,
        cost_record.id,
        target_month,
        COALESCE(cost_record.estimated_amount, cost_record.amount),
        CASE 
          WHEN cost_record.due_day IS NOT NULL THEN 
            (target_month + INTERVAL '1 month' - INTERVAL '1 day')::DATE - 
            EXTRACT(DAY FROM (target_month + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER + 
            cost_record.due_day
          ELSE target_month + INTERVAL '1 month' - INTERVAL '1 day'
        END
      );
      
      entries_created := entries_created + 1;
    END IF;
  END LOOP;
  
  RETURN entries_created;
END;
$$ LANGUAGE plpgsql;
