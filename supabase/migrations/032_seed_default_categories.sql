-- Seed default categories and subcategories with parent_id hierarchy
-- Parents are inserted if missing; children reference their parent via parent_id

DO $$
DECLARE
  p_super UUID;
  p_trans UUID;
  p_saude UUID;
  -- other parents (ids not strictly needed for children right now)
BEGIN
  -- Parents (Expense)
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='alimentação' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Alimentação','expense','#f59e0b', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Supermercado','expense','#10b981', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='transporte' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Transporte','expense','#3b82f6', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='habitação' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Habitação','expense','#6366f1', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='serviços públicos' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Serviços Públicos','expense','#0ea5e9', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='saúde' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Saúde','expense','#ef4444', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='educação' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Educação','expense','#8b5cf6', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='lazer' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Lazer','expense','#f97316', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='viagens' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Viagens','expense','#22c55e', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='compras' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Compras','expense','#ec4899', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='assinaturas' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Assinaturas','expense','#14b8a6', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='impostos' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Impostos','expense','#b91c1c', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='taxas' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Taxas','expense','#6b7280', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='seguros' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Seguros','expense','#4b5563', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='pets' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Pets','expense','#a3e635', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='presentes' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Presentes','expense','#f43f5e', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='doações' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Doações','expense','#06b6d4', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='investimentos' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Investimentos','expense','#84cc16', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='outros' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Outros','expense','#9ca3af', true);
  END IF;

  -- Parents (Income)
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='salário' AND type='income') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Salário','income','#059669', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='freelance' AND type='income') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Freelance','income','#10b981', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='reembolsos' AND type='income') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Reembolsos','income','#16a34a', true);
  END IF;
  -- Ambiguous: seed both income and expense for Transferência to allow mapping by sign
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='transferência' AND type='income') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Transferência','income','#6b7280', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='transferência' AND type='expense') THEN
    INSERT INTO public.categories (name, type, color, is_default) VALUES ('Transferência','expense','#6b7280', true);
  END IF;

  -- Lookup parent ids for subcategory seeding
  SELECT id INTO p_super FROM public.categories WHERE lower(name)='supermercado' AND type='expense' LIMIT 1;
  SELECT id INTO p_trans FROM public.categories WHERE lower(name)='transporte' AND type='expense' LIMIT 1;
  SELECT id INTO p_saude FROM public.categories WHERE lower(name)='saúde' AND type='expense' LIMIT 1;

  -- Supermercado subcategories (Expense)
  IF p_super IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - cesta básica' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Cesta Básica','expense','#34d399', true, p_super);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - higiene e limpeza' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Higiene e Limpeza','expense','#22c55e', true, p_super);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - supérfluos' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Supérfluos','expense','#f472b6', true, p_super);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - bebidas' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Bebidas','expense','#60a5fa', true, p_super);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - padaria' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Padaria','expense','#f59e0b', true, p_super);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - açougue' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Açougue','expense','#fb7185', true, p_super);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - frutas e verduras' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Frutas e Verduras','expense','#84cc16', true, p_super);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - congelados' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Congelados','expense','#38bdf8', true, p_super);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='supermercado - petiscos' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Supermercado - Petiscos','expense','#eab308', true, p_super);
    END IF;
  END IF;

  -- Transporte subcategories (Expense)
  IF p_trans IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='transporte - combustível' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Transporte - Combustível','expense','#93c5fd', true, p_trans);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='transporte - manutenção' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Transporte - Manutenção','expense','#60a5fa', true, p_trans);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='transporte - estacionamento' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Transporte - Estacionamento','expense','#3b82f6', true, p_trans);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='transporte - pedágio' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Transporte - Pedágio','expense','#2563eb', true, p_trans);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='transporte - transporte público' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Transporte - Transporte Público','expense','#1d4ed8', true, p_trans);
    END IF;
  END IF;

  -- Saúde subcategories (Expense)
  IF p_saude IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='saúde - medicamentos' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Saúde - Medicamentos','expense','#fca5a5', true, p_saude);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='saúde - consultas' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Saúde - Consultas','expense','#f87171', true, p_saude);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='saúde - exames' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Saúde - Exames','expense','#ef4444', true, p_saude);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE lower(name)='saúde - seguro saúde' AND type='expense') THEN
      INSERT INTO public.categories (name, type, color, is_default, parent_id) VALUES ('Saúde - Seguro Saúde','expense','#dc2626', true, p_saude);
    END IF;
  END IF;
END $$;
