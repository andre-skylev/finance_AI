-- Migration: Receipts and Receipt Items for Itemized Purchases
-- Adds support for itemized receipt storage linked to transactions

CREATE TABLE IF NOT EXISTS receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  merchant_name TEXT,
  receipt_date DATE,
  currency TEXT CHECK (currency IN ('EUR','BRL')),
  subtotal DECIMAL(15,2),
  tax DECIMAL(15,2),
  total DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  line_no INTEGER,
  description TEXT NOT NULL,
  quantity DECIMAL(15,3) DEFAULT 1,
  unit_price DECIMAL(15,4),
  tax_rate DECIMAL(6,3),
  tax_amount DECIMAL(15,2),
  total DECIMAL(15,2),
  sku TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_account_id ON receipts(account_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_user_id ON receipt_items(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);

-- RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage own receipts" ON receipts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can manage own receipt items" ON receipt_items
  FOR ALL USING (auth.uid() = user_id);

-- Trigger to maintain updated_at
CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipt_items_updated_at BEFORE UPDATE ON receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
