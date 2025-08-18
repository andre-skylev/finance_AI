# 🔄 Mudando para Document OCR

## ✅ Por que Document OCR é melhor para o seu caso:

- **✅ Mais genérico:** Funciona com qualquer tipo de PDF
- **✅ Mais simples:** Não precisa de formato específico
- **✅ Mais barato:** Processamento mais direto
- **✅ Mais flexível:** Trabalha com qualquer documento

## 🛠️ Passos para criar Document OCR:

### 1. Vá para o Console
👉 https://console.cloud.google.com/ai/document-ai/processors

### 2. Criar novo processador
1. **Clique em:** "Create Processor"
2. **Selecione:** "Document OCR" (não Bank Statement Parser)
3. **Configure:**
   - **Name:** finance-ai-document-ocr
   - **Location:** eu
4. **Clique em:** "Create"

### 3. Copiar o novo ID
- Anote o **Processor ID** do novo processador Document OCR
- Será diferente do atual: `7a21597897ab6d3e`

### 4. Atualizar .env.local
Substitua o ID antigo pelo novo:
```bash
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=NOVO_ID_AQUI
```

### 5. (Opcional) Desativar o antigo
- Na lista de processadores, você pode desativar o Bank Statement Parser
- Clique nele > "Disable Processor"

## 🧪 Teste após a mudança
```bash
node testar-bank-parser.js
```

## 💡 Vantagens do Document OCR vs Bank Statement Parser:

| Característica | Document OCR | Bank Statement Parser |
|---------------|--------------|----------------------|
| **Flexibilidade** | ✅ Qualquer PDF | ❌ Só extratos bancários |
| **Simplicidade** | ✅ Simples | ❌ Complexo |
| **Custo** | ✅ Menor | ❌ Maior |
| **Extração** | ✅ Texto puro | ❌ Entidades específicas |
| **Compatibilidade** | ✅ 100% PDFs | ❌ Formato específico |

Document OCR é perfeito para extrair texto de qualquer PDF e depois usar OpenAI para estruturar os dados!
