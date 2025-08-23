-- Add receipt_id column to transactions table to link transactions to receipts
-- This allows grouping transaction items from the same receipt together

-- Add receipt_id column as a foreign key to receipts table
ALTER TABLE transactions 
ADD COLUMN receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL;

-- Add index for better performance when querying transactions by receipt
CREATE INDEX idx_transactions_receipt_id ON transactions(receipt_id);

-- Add comment explaining the purpose
COMMENT ON COLUMN transactions.receipt_id IS 'Links transaction to a receipt when transaction was created from receipt processing';
