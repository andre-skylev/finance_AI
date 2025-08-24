# Enhanced Transaction Structure - What Will Change

## Current Structure Analysis

### Before Migration:
```sql
-- transactions table (basic)
- id, user_id, account_id, category_id
- amount, currency, description, transaction_date, type
- is_recurring, recurring_period, tags
- receipt_id (recently added)
- created_at, updated_at
```

### After Migration:
```sql
-- transactions table (enhanced)
ALL EXISTING COLUMNS PLUS:
- merchant_name VARCHAR(500)         -- Extracted merchant name
- location VARCHAR(255)              -- Transaction location  
- pattern_matched VARCHAR(255)       -- Auto-categorization pattern used
- confidence_score INTEGER           -- Categorization confidence (0-100)
- transaction_type VARCHAR(50)       -- Source: manual/imported/receipt/recurring/transfer
- source_document VARCHAR(500)       -- Original filename/source
- import_job_id UUID                 -- Links to import job
- statement_id UUID                  -- Links to bank statement
- installments INTEGER               -- Number of installments
- installment_number INTEGER         -- Current installment number
- original_amount NUMERIC            -- Original amount before conversion
- exchange_rate NUMERIC              -- Currency conversion rate
- notes TEXT                         -- Additional notes
```

## New Tables Created:

### 1. bank_statements
```sql
-- Organizes transactions by import periods (like credit_card_statements)
- id, user_id, account_id
- statement_date, period_start, period_end
- opening_balance, closing_balance
- total_credits, total_debits
- pdf_file_name, currency
- is_processed, created_at, updated_at
```

### 2. enhanced_transaction_patterns
```sql
-- Advanced auto-categorization patterns
- id, pattern_name
- keywords[], merchant_patterns[], location_patterns[]
- suggested_category, transaction_type
- confidence_score, country_code
- is_active, created_at, updated_at
```

## New Functions Created:

### 1. auto_categorize_transaction()
- Smart categorization based on description and merchant
- Returns: suggested_category, confidence_score, pattern_matched
- Uses enhanced patterns for better accuracy

### 2. process_bank_statement_transaction()
- Standardized transaction creation with auto-categorization
- Similar to credit card processing workflow
- Automatically creates categories if needed

## New Views Created:

### 1. all_transactions
- Unified view of bank + credit card transactions
- Consistent structure across both types
- Single query for all transaction analytics

## Benefits After Migration:

✅ **Source Tracking**: Know where every transaction came from
✅ **Enhanced Categorization**: Auto-categorization with confidence scores  
✅ **Better Receipt Integration**: Transactions linked to receipt line items
✅ **Installment Support**: Bank transactions can have installments
✅ **Unified Analytics**: Single view of all transactions
✅ **Statement Organization**: Group transactions by import periods
✅ **Merchant Intelligence**: Extract and track merchant names
✅ **Location Tracking**: Track transaction locations
✅ **Audit Trail**: Full history from source document to transaction

## Migration Safety:
- ✅ All changes use `ADD COLUMN IF NOT EXISTS`
- ✅ No existing data is modified  
- ✅ Backward compatibility maintained
- ✅ New features are opt-in
- ✅ Can be applied incrementally

## Default Patterns Included:
- Supermarket Purchases (Continente, Pingo Doce, Lidl, etc.)
- Fuel Stations (Galp, BP, Repsol, etc.)
- Restaurants (generic restaurant patterns)
- Pharmacy (Farmácia patterns)
- ATM Withdrawals (Multibanco, ATM patterns)
- Bank Transfers (Transferência patterns)
- Online Shopping (Amazon, PayPal, etc.)
- Utilities (EDP, Galp Energia, etc.)

## Next Steps After Migration:
1. Update PDF import APIs to use new structure
2. Enhance frontend to display new metadata
3. Test receipt → transaction → statement flow
4. Add more transaction patterns as needed
5. Update analytics to use unified view
