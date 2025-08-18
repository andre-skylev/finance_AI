# Configuração Google Cloud Document AI

## 1. Criar/Configurar Projeto no Google Cloud

### Passo 1: Acesse o Google Cloud Console
- Vá para: https://console.cloud.google.com/
- Faça login com sua conta Google

### Passo 2: Criar ou Selecionar Projeto
```bash
# Se não tiver projeto, criar um novo:
# 1. Clique em "Select a project" no topo
# 2. Clique em "New Project"
# 3. Nome: "finance-ai" ou similar
# 4. Clique em "Create"
```

### Passo 3: Ativar a API Document AI
```bash
# No console, vá para:
# APIs & Services > Library
# Procure por "Document AI API"
# Clique em "Enable"
```

## 2. Criar Service Account e Chaves

### Passo 1: Criar Service Account
```bash
# Vá para: IAM & Admin > Service Accounts
# Clique em "Create Service Account"
# 
# Nome: finance-ai-ocr
# Description: Service account for PDF OCR processing
# Clique em "Create and Continue"
```

### Passo 2: Definir Permissões
```bash
# Role: Document AI API User
# Clique em "Continue" e depois "Done"
```

### Passo 3: Gerar Chave JSON
```bash
# Na lista de Service Accounts, clique nos 3 pontos da sua service account
# Clique em "Manage keys"
# Clique em "Add Key" > "Create new key"
# Selecione "JSON"
# Clique em "Create"
# 
# Isso baixará um arquivo JSON - GUARDE-O COM SEGURANÇA!
```

## 3. Configurar Credenciais no Projeto

### Método 1: Arquivo de Credenciais (Recomendado para desenvolvimento)

1. **Copie o arquivo JSON baixado para seu projeto:**
```bash
# Renomeie o arquivo para algo como:
# google-credentials.json
# 
# Mova para uma pasta segura no seu projeto:
mkdir -p /Users/andrecruz/CODES/finance_AI/credentials
mv ~/Downloads/finance-ai-*.json /Users/andrecruz/CODES/finance_AI/credentials/google-credentials.json
```

2. **Adicione ao .env.local:**
```bash
# Caminho para o arquivo de credenciais
GOOGLE_APPLICATION_CREDENTIALS=/Users/andrecruz/CODES/finance_AI/credentials/google-credentials.json

# ID do projeto (encontre no console do Google Cloud)
GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id

# Região do processador (padrão: us)
GOOGLE_CLOUD_PROCESSOR_LOCATION=us

# Limites de custo (opcional)
GOOGLE_AI_DAILY_LIMIT=100
GOOGLE_AI_MONTHLY_BUDGET=5.00
```

### Método 2: Variáveis de Ambiente (Para produção)

```bash
# Se preferir usar variáveis de ambiente:
GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSua chave privada aqui\n-----END PRIVATE KEY-----\n"
GOOGLE_CLOUD_CLIENT_EMAIL=finance-ai-ocr@seu-projeto.iam.gserviceaccount.com
```

## 4. Configurar Processador Document AI

### Passo 1: Criar Processador
```bash
# No Google Cloud Console:
# Document AI > Processors
# Clique em "Create Processor"
# Tipo: "Document OCR"
# Nome: "finance-ai-ocr"
# Região: "us" (ou sua preferência)
# Clique em "Create"
```

### Passo 2: Obter ID do Processador
```bash
# Anote o Processor ID que aparece na página
# Adicione ao .env.local:
GOOGLE_CLOUD_PROCESSOR_ID=seu-processor-id
```

## 5. Verificar Configuração

Execute este comando para testar:
```bash
npm run dev
```

Depois teste o upload de um PDF na aplicação!

## 6. Custos Estimados

- **Gratuito:** 1000 páginas/mês
- **Pago:** $1.50 por 1000 páginas adicionais
- **Seu uso estimado:** ~$0.01-0.05/mês (uso pessoal)

## 7. Segurança

⚠️ **IMPORTANTE:**
- Nunca commite o arquivo JSON no git
- Adicione `credentials/` no .gitignore
- Use variáveis de ambiente em produção
