# 🎯 Sistema de Auto-Criação de Contas/Cartões - Guia de Uso

## 📋 **Como Funciona**

Quando você faz upload de um PDF (extrato ou fatura), o sistema:

1. **🔍 Identifica o tipo**: Extrato bancário ou fatura de cartão
2. **🏦 Detecta o banco**: Usando padrões inteligentes PT/BR
3. **🎯 Localiza identificadores**: Últimos 4 dígitos, bandeira do cartão, etc.
4. **✨ Cria automaticamente**: Conta ou cartão se não existir
5. **📊 Importa transações**: Associa às contas corretas

## 🚀 **Benefícios de Segurança**

- ✅ **Sem dados sensíveis**: Apenas últimos 4 dígitos armazenados
- ✅ **Labels editáveis**: Usuário pode personalizar nomes
- ✅ **Identificação inteligente**: Sistema reconhece automaticamente
- ✅ **Zero configuração**: Não precisa criar contas manualmente

## 📝 **Exemplos de Auto-Criação**

### 💳 **Cartão de Crédito**
```
Banco Detectado: "Millennium BCP"
Últimos 4 Dígitos: "1234"
Bandeira: "Visa"
Nome Auto-Gerado: "Millennium BCP •••• 1234 (Visa)"
```

### 🏦 **Conta Bancária**
```
Banco Detectado: "Santander Totta"
Número Parcial: "••••5678"
Nome Auto-Gerado: "Santander Totta ••••5678"
```

## ⚙️ **Para Testar o Sistema**

### 1. **Execute as migrações**:
```sql
-- No Supabase SQL Editor:
-- 1. Execute 004_credit_cards.sql
-- 2. Execute 005_auto_account_creation.sql
```

### 2. **Teste com fatura de cartão**:
- Vá para `/transactions/add`
- Upload de uma fatura de cartão em PDF
- Sistema detecta automaticamente e cria o cartão
- Mostra notificação: "Cartão criado automaticamente"

### 3. **Teste com extrato bancário**:
- Upload de extrato bancário em PDF
- Sistema detecta e cria conta automaticamente
- Mostra notificação: "Conta criada automaticamente"

### 4. **Edite os nomes**:
- Vá para `/credit-cards` ou `/settings` (contas)
- Edite o nome auto-gerado para algo mais personalizado
- Ex: "Millennium BCP •••• 1234 (Visa)" → "Cartão Principal"

## 🔧 **Configurações Avançadas**

### **Função para sugerir nomes personalizados**:
```sql
SELECT suggest_account_label('Millennium BCP', '1234', 'Visa', 'credit');
-- Retorna: "Millennium BCP - Cartão de Crédito Visa •••• 1234"
```

### **Buscar contas criadas automaticamente**:
```sql
SELECT * FROM auto_process_and_create_account(
  'user-uuid', 
  'credit_card_statement', 
  'Millennium BCP', 
  '1234', 
  'Visa', 
  NULL, 
  5000.00, 
  'EUR'
);
```

## 📊 **Integração com Transações**

Quando as transações são salvas:
- **Cartões**: Vão para `credit_card_transactions`
- **Contas**: Vão para `transactions` normais
- **Account ID**: Automaticamente associado à conta criada

## 🎨 **Interface do Usuário**

### **Notificações Visuais**:
- 🟢 **Verde**: "Cartão criado automaticamente"
- 🔵 **Azul**: "Cartão identificado" (já existia)
- 📝 **Info**: Link para editar nome em Configurações

### **Fluxo Completo**:
1. Upload PDF → 2. Detecção automática → 3. Criação/identificação → 4. Review das transações → 5. Importação

## 🚨 **Casos Especiais**

### **Múltiplos cartões do mesmo banco**:
- Sistema usa últimos 4 dígitos para diferenciar
- Se não tiver dígitos, cria genérico editável

### **Bancos não reconhecidos**:
- IA tenta identificar mesmo bancos desconhecidos
- Cria com nome detectado pela IA

### **Conflitos**:
- Se já existe conta similar, usa a existente
- Não cria duplicatas

## 🎯 **Resultado Final**

✨ **Experiência do usuário**:
1. Faz upload de qualquer extrato/fatura
2. Sistema automaticamente cria conta/cartão
3. Usuário só precisa revisar e confirmar transações
4. Pode editar nomes depois se quiser

🔒 **Máxima segurança**:
- Nenhum número completo armazenado
- Apenas identificadores não-sensíveis
- Labels totalmente editáveis pelo usuário
