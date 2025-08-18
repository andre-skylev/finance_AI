# 🚀 Criando Novo Processador Document AI - Região EU

## 📝 Passo a Passo

### 1. Acesse o Console
👉 https://console.cloud.google.com/ai/document-ai/processors

### 2. Verifique o Projeto
- Certifique-se de que está no projeto: **finance-app-469314**
- Se não estiver, clique no seletor de projeto no topo

### 3. Criar Processador
1. **Clique em:** "Create Processor"
2. **Selecione:** "Document OCR"
3. **Configure:**
   - **Processor name:** finance-ai-ocr-eu
   - **Location:** 🇪🇺 **eu (Europe)**
4. **Clique em:** "Create"

### 4. Copiar ID do Processador
- Após criar, você verá o processador na lista
- **Clique** no processador criado
- Na página de detalhes, **copie o Processor ID**
- Formato: `abcd1234efgh5678` (16 caracteres)

### 5. Atualizar .env.local
Substitua no arquivo `.env.local`:
```bash
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=SEU_NOVO_ID_AQUI
```

### 6. Testar
```bash
node teste-exato.js
```

## 🔍 Se não aparecer nenhum processador

Isso pode significar que:
1. **API não está habilitada** - Vá para: https://console.cloud.google.com/apis/library/documentai.googleapis.com
2. **Sem permissões** - A service account precisa da role "Document AI API User"
3. **Projeto incorreto** - Verifique se está no projeto certo

## ✅ Próximos Passos

Após criar o processador:
1. ✅ Testar com: `node teste-exato.js`
2. ✅ Testar PDF real na aplicação
3. ✅ Verificar funcionamento completo

**Região configurada:** 🇪🇺 Europa (eu)
**Projeto:** finance-app-469314
