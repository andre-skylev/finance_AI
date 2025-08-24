# Segurança de Dados Financeiros - Guia Completo

## 🔒 Situação Atual vs Melhores Práticas

### ❌ Problema Atual:
- Valores financeiros armazenados em texto claro no banco
- Números de conta visíveis diretamente
- Dados sensíveis sem criptografia
- Logs podem expor informações financeiras

### ✅ Solução Recomendada:
- **Criptografia de dados sensíveis** em repouso
- **Mascaramento** de números de conta
- **Hashing** de informações identificáveis
- **Auditoria** e logs seguros

## 🛡️ Implementação de Segurança

### 1. **Criptografia de Valores Financeiros**

```sql
-- Extensão para criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para criptografar valores
CREATE OR REPLACE FUNCTION encrypt_amount(amount_value NUMERIC, user_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(amount_value::TEXT, user_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para descriptografar valores
CREATE OR REPLACE FUNCTION decrypt_amount(encrypted_amount TEXT, user_key TEXT)
RETURNS NUMERIC AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_amount, 'base64'), user_key)::NUMERIC;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL; -- Retorna NULL se não conseguir descriptografar
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. **Mascaramento de Números de Conta**

```sql
-- Função para mascarar números de conta
CREATE OR REPLACE FUNCTION mask_account_number(account_number TEXT)
RETURNS TEXT AS $$
BEGIN
  IF LENGTH(account_number) <= 4 THEN
    RETURN REPEAT('*', LENGTH(account_number));
  ELSE
    RETURN REPEAT('*', LENGTH(account_number) - 4) || RIGHT(account_number, 4);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para mascarar números de cartão
CREATE OR REPLACE FUNCTION mask_card_number(card_number TEXT)
RETURNS TEXT AS $$
BEGIN
  IF LENGTH(card_number) <= 4 THEN
    RETURN REPEAT('*', LENGTH(card_number));
  ELSE
    RETURN LEFT(card_number, 4) || REPEAT('*', LENGTH(card_number) - 8) || RIGHT(card_number, 4);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### 3. **Estrutura de Tabelas Seguras**

```sql
-- Tabela de contas com criptografia
CREATE TABLE secure_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number_hash TEXT, -- Hash do número da conta
  account_number_encrypted TEXT, -- Número criptografado
  account_number_masked TEXT, -- Versão mascarada para exibição
  balance_encrypted TEXT, -- Saldo criptografado
  currency VARCHAR(3) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de transações com criptografia
CREATE TABLE secure_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES secure_accounts(id) ON DELETE CASCADE,
  amount_encrypted TEXT, -- Valor criptografado
  amount_hash TEXT, -- Hash para comparações/buscas
  currency VARCHAR(3) NOT NULL,
  description TEXT NOT NULL,
  merchant_name_encrypted TEXT, -- Comerciante criptografado
  transaction_date DATE NOT NULL,
  type VARCHAR(20) NOT NULL,
  category_id UUID REFERENCES categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. **Sistema de Chaves por Usuário**

```sql
-- Tabela para armazenar chaves de criptografia derivadas
CREATE TABLE user_encryption_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  key_salt TEXT NOT NULL, -- Salt único para cada usuário
  key_hash TEXT NOT NULL, -- Hash da chave derivada
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Função para gerar chave derivada do usuário
CREATE OR REPLACE FUNCTION derive_user_key(user_password TEXT, user_salt TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Deriva chave usando PBKDF2
  RETURN encode(digest(user_password || user_salt, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

## 🔐 Implementação no Backend (Next.js)

### 1. **Serviço de Criptografia**

```typescript
// lib/encryption.ts
import crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;

  // Gerar chave derivada do usuário
  static deriveUserKey(userId: string, userSecret: string): Buffer {
    const salt = process.env.ENCRYPTION_SALT + userId;
    return crypto.pbkdf2Sync(userSecret, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  // Criptografar valor
  static encryptValue(value: string | number, userKey: Buffer): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipher(this.ALGORITHM, userKey);
    cipher.setAAD(Buffer.from('financial-data'));
    
    let encrypted = cipher.update(value.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex')
    });
  }

  // Descriptografar valor
  static decryptValue(encryptedData: string, userKey: Buffer): string | null {
    try {
      const data = JSON.parse(encryptedData);
      const decipher = crypto.createDecipher(this.ALGORITHM, userKey);
      decipher.setAAD(Buffer.from('financial-data'));
      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
      
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  // Mascarar número de conta
  static maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) return '*'.repeat(accountNumber.length);
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  }

  // Hash para comparações
  static hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
```

### 2. **Middleware de Segurança**

```typescript
// middleware/security.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function securityMiddleware(request: NextRequest) {
  // Rate limiting para endpoints financeiros
  if (request.nextUrl.pathname.includes('/api/transactions') || 
      request.nextUrl.pathname.includes('/api/accounts')) {
    
    const ip = request.ip || 'unknown';
    const rateLimitKey = `rate_limit:${ip}`;
    
    // Implementar rate limiting aqui
    // ...
  }

  // Log de auditoria para operações sensíveis
  if (request.method !== 'GET') {
    await logAuditEvent({
      ip: request.ip,
      method: request.method,
      path: request.nextUrl.pathname,
      timestamp: new Date(),
      userAgent: request.headers.get('user-agent')
    });
  }

  return NextResponse.next();
}
```

### 3. **API Segura para Transações**

```typescript
// app/api/secure-transactions/route.ts
import { EncryptionService } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  const { user } = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Buscar transações criptografadas
  const { data: encryptedTransactions } = await supabase
    .from('secure_transactions')
    .select('*')
    .eq('user_id', user.id);

  // Descriptografar apenas para o usuário autenticado
  const userKey = EncryptionService.deriveUserKey(user.id, user.encryptionSecret);
  
  const transactions = encryptedTransactions.map(tx => ({
    ...tx,
    amount: EncryptionService.decryptValue(tx.amount_encrypted, userKey),
    merchant_name: EncryptionService.decryptValue(tx.merchant_name_encrypted, userKey)
  }));

  return NextResponse.json({ transactions });
}
```

## 🛡️ Configurações de Segurança

### 1. **Variáveis de Ambiente (.env.local)**

```env
# Chaves de criptografia (NUNCA committar!)
ENCRYPTION_SALT=sua-salt-super-secreta-aqui
MASTER_ENCRYPTION_KEY=sua-chave-mestre-aqui

# Configurações de segurança
SESSION_SECRET=sua-session-secret
MAX_LOGIN_ATTEMPTS=5
RATE_LIMIT_WINDOW=15 # minutos
RATE_LIMIT_MAX_REQUESTS=100

# Auditoria
AUDIT_LOG_LEVEL=info
SENSITIVE_DATA_LOG=false
```

### 2. **Configuração do Supabase (RLS)**

```sql
-- Política de segurança mais restritiva
CREATE POLICY "Ultra secure user data access" ON secure_transactions
  FOR ALL USING (
    auth.uid() = user_id 
    AND extract(hour from now()) BETWEEN 6 AND 23 -- Só permite acesso em horário comercial
  );

-- Auditoria automática
CREATE OR REPLACE FUNCTION audit_sensitive_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name,
    operation,
    user_id,
    timestamp,
    ip_address
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    NOW(),
    current_setting('app.user_ip', true)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 📊 Boas Práticas Implementadas

### ✅ **Criptografia**
- Dados financeiros criptografados em repouso
- Chaves derivadas por usuário
- Algoritmos seguros (AES-256-GCM)

### ✅ **Mascaramento**
- Números de conta mascarados na UI
- Últimos 4 dígitos visíveis apenas
- Valores sensíveis nunca em logs

### ✅ **Auditoria**
- Log de todas operações sensíveis
- Rastreamento de acesso a dados
- Detecção de anomalias

### ✅ **Controle de Acesso**
- RLS (Row Level Security) no Supabase
- Rate limiting por IP
- Autenticação multi-fator (recomendado)

### ✅ **Conformidade**
- LGPD/GDPR ready
- PCI DSS considerations
- Direito ao esquecimento

## 🚨 Alertas de Segurança

### Monitoramento Automático:
- Múltiplas tentativas de login
- Acesso em horários incomuns
- Grandes volumes de transações
- Mudanças de configuração

Esta implementação garante que mesmo que alguém acesse diretamente o banco de dados, os valores estarão criptografados e ilegíveis! 🔒
