# 🇪🇺 Google Document AI - Configuração Região EU

## Por que usar a região EU?

- **Conformidade GDPR**: Dados processados dentro da União Europeia
- **Menor latência**: Para usuários em Portugal/Europa
- **Requisitos legais**: Alguns dados financeiros devem permanecer na EU

## Passo a Passo - Configuração Completa

### 1. Criar Projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione um existente
3. Anote o **Project ID** (será usado como `GOOGLE_CLOUD_PROJECT_ID`)

### 2. Ativar Document AI API

```bash
# Via CLI
gcloud services enable documentai.googleapis.com

# Ou acesse:
# https://console.cloud.google.com/apis/library/documentai.googleapis.com
```

### 3. Criar Processador OCR na Região EU

⚠️ **IMPORTANTE**: O processador DEVE ser criado na região EU!

1. Acesse [Document AI Console](https://console.cloud.google.com/ai/document-ai)
2. Clique em **"Create Processor"**
3. **SELECIONE REGIÃO**: `Europe (eu)` ← CRUCIAL!
4. Escolha tipo: **"Document OCR"**
5. Nome: `ocr-processor-eu` (ou outro de sua preferência)
6. Clique em **"Create"**
7. **COPIE O PROCESSOR ID** (formato: `xxxxxxxxxxxxxxxx`)

### 4. Criar Service Account

```bash
# Via CLI
gcloud iam service-accounts create document-ai-service \
    --display-name="Document AI Service Account"

# Ou via Console:
# https://console.cloud.google.com/iam-admin/serviceaccounts
```

### 5. Dar Permissões à Service Account

```bash
# Adicionar role de Document AI User
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:document-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/documentai.apiUser"
```

### 6. Baixar Credenciais

1. No Console, vá para [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Clique na service account criada
3. Aba **"Keys"** → **"Add Key"** → **"Create new key"**
4. Escolha **JSON**
5. Salve o arquivo como `google-credentials.json` na raiz do projeto

### 7. Configurar Variáveis de Ambiente

Crie ou atualize o arquivo `.env`:

```env
# Google Cloud - Document AI (Região EU)
GOOGLE_CLOUD_PROJECT_ID=seu-project-id
GOOGLE_CLOUD_REGION=eu
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=xxxxxxxxxxxxxxxx
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_AI_DAILY_LIMIT=50

# OpenAI (para processamento de texto)
OPENAI_API_KEY=sk-...
```

### 8. Estrutura de Custos (Região EU)

| Recurso | Preço (EU) | Notas |
|---------|------------|-------|
| Document OCR | €1.50 por 1000 páginas | Primeiras 1000 páginas/mês grátis |
| Armazenamento | Não aplicável | PDFs não são armazenados |
| API Calls | Incluído | Sem custo adicional |

### 9. Verificar Configuração

Execute o script de verificação:

```bash
node verify-google-eu-config.js
```

Saída esperada:
```
✅ GOOGLE_CLOUD_PROJECT_ID: seu-project-id
✅ GOOGLE_CLOUD_REGION: eu
✅ GOOGLE_DOCUMENT_AI_PROCESSOR_ID: xxxxxxxxxxxxxxxx
✅ GOOGLE_APPLICATION_CREDENTIALS: ***
✅ GOOGLE_AI_DAILY_LIMIT: 50

🌍 Região Configurada: eu
✅ Região EU configurada corretamente
   Endpoint: eu-documentai.googleapis.com
```

### 10. Testar Upload de PDF

```bash
# Teste com PDF de exemplo
node test-document-upload-system.js
```

## Troubleshooting

### Erro: "Request contains an invalid argument"

**Causa**: Processador criado em região diferente da configurada

**Solução**:
1. Verifique se `GOOGLE_CLOUD_REGION=eu`
2. Confirme que o processador foi criado na região EU
3. Se criou em US, delete e recrie na EU

### Erro: "Processor not found"

**Causa**: ID do processador incorreto ou região errada

**Solução**:
1. Acesse [Document AI Processors](https://console.cloud.google.com/ai/document-ai/processors)
2. Filtre por região "Europe"
3. Copie o ID correto do processador

### Erro: "Permission denied"

**Causa**: Service account sem permissões

**Solução**:
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
    --role="roles/documentai.apiUser"
```

## Segurança e Conformidade

### GDPR Compliance ✅

- ✅ Dados processados na EU
- ✅ Sem armazenamento de PDFs
- ✅ Apenas texto extraído é salvo
- ✅ Criptografia em trânsito
- ✅ Logs de auditoria disponíveis

### Boas Práticas

1. **Nunca commitar credenciais**:
   ```gitignore
   google-credentials.json
   .env
   ```

2. **Rotacionar chaves regularmente**:
   - A cada 90 dias
   - Após qualquer suspeita de comprometimento

3. **Monitorar uso**:
   - Configure alertas de quota
   - Revise logs mensalmente

4. **Limitar escopo**:
   - Use roles mínimas necessárias
   - Restrinja por IP se possível

## Exemplo de Uso Completo

```javascript
// Configuração automática para região EU
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');

const client = new DocumentProcessorServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  apiEndpoint: 'eu-documentai.googleapis.com', // Força endpoint EU
});

const processorPath = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/eu/processors/${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;

// Processar documento
const [result] = await client.processDocument({
  name: processorPath,
  rawDocument: {
    content: base64Content,
    mimeType: 'application/pdf',
  },
});

console.log('Texto extraído:', result.document.text);
```

## Suporte

- [Documentação Oficial](https://cloud.google.com/document-ai/docs)
- [Regiões Disponíveis](https://cloud.google.com/document-ai/docs/regions)
- [Preços](https://cloud.google.com/document-ai/pricing)
- [Quotas e Limites](https://cloud.google.com/document-ai/quotas)

---

⚠️ **Lembre-se**: O processador DEVE ser criado na região EU para funcionar corretamente!