-- Seed default categories for all users (is_default = true)
-- These categories are global and will appear for every user

-- Expenses
INSERT INTO categories (name, icon, color, type, is_default)
SELECT * FROM (
  VALUES
  ('Alimentação', NULL, '#ef4444', 'expense', true),
  ('Supermercado', NULL, '#f97316', 'expense', true),
  ('Transporte', NULL, '#10b981', 'expense', true),
  ('Habitação', NULL, '#3b82f6', 'expense', true),
  ('Serviços Públicos', NULL, '#a855f7', 'expense', true),
  ('Saúde', NULL, '#ef4444', 'expense', true),
  ('Educação', NULL, '#22c55e', 'expense', true),
  ('Lazer', NULL, '#06b6d4', 'expense', true),
  ('Viagens', NULL, '#6366f1', 'expense', true),
  ('Compras', NULL, '#db2777', 'expense', true),
  ('Assinaturas', NULL, '#f59e0b', 'expense', true),
  ('Impostos', NULL, '#f43f5e', 'expense', true),
  ('Taxas', NULL, '#64748b', 'expense', true),
  ('Seguros', NULL, '#0ea5e9', 'expense', true),
  ('Pets', NULL, '#84cc16', 'expense', true),
  ('Presentes', NULL, '#a855f7', 'expense', true),
  ('Doações', NULL, '#22c55e', 'expense', true),
  ('Investimentos', NULL, '#10b981', 'expense', true),
  ('Outros', NULL, '#6b7280', 'expense', true)
) AS v(name, icon, color, type, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.name = v.name AND c.type = v.type AND c.is_default = true
);

-- Income
INSERT INTO categories (name, icon, color, type, is_default)
SELECT * FROM (
  VALUES
  ('Salário', NULL, '#10b981', 'income', true),
  ('Freelance', NULL, '#06b6d4', 'income', true),
  ('Investimentos', NULL, '#22c55e', 'income', true),
  ('Reembolsos', NULL, '#3b82f6', 'income', true),
  ('Outros', NULL, '#6b7280', 'income', true)
) AS v(name, icon, color, type, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.name = v.name AND c.type = v.type AND c.is_default = true
);
