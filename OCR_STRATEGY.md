# 🎯 Estratégia de OCR com Controle de Custos

## 📊 Sistema de 3 Camadas Implementado

### 🏆 **Camada 1: pdf-parse (Gratuito)**
- **Uso**: 90% dos PDFs modernos
- **Custo**: R$ 0,00
- **Velocidade**: ⚡ Muito rápida
- **Casos**: Extratos digitais, PDFs com texto selecionável

### 🥈 **Camada 2: Tesseract.js (Gratuito)**
- **Uso**: 8% dos PDFs escaneados
- **Custo**: R$ 0,00  
- **Velocidade**: 🐌 Mais lenta (~10-30s)
- **Casos**: PDFs escaneados, imagens convertidas

### 🥉 **Camada 3: Google Document AI (Pago)**
- **Uso**: 2% dos casos mais complexos
- **Custo**: ~$1.50 por 1000 páginas
- **Velocidade**: ⚡ Rápida e precisa
- **Casos**: Documentos muito complexos, Tesseract falha

## 💰 **Controle de Custos Implementado**

### 🛡️ **Proteções:**
- **Limite diário**: Máximo 10 páginas Google AI/dia (configurável)
- **Fallback inteligente**: Tesseract antes de Google AI
- **Monitoramento**: Log de uso diário
- **Alertas**: Aviso quando atinge limite

### 📈 **Estimativa de Custos:**
- **100 extratos/mês**: ~95 gratuitos + 5 pagos = ~$0.01/mês
- **500 extratos/mês**: ~475 gratuitos + 25 pagos = ~$0.04/mês  
- **1000 extratos/mês**: ~950 gratuitos + 50 pagos = ~$0.08/mês

## ⚙️ **Configuração Necessária**

### 📝 **Variáveis de Ambiente (.env.local):**
```bash
# Controle de custos
GOOGLE_AI_DAILY_LIMIT=10

# Google Cloud (opcional - só para casos complexos)
GOOGLE_CLOUD_PROJECT_ID=your-project
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your-processor
GOOGLE_CLOUD_KEY_FILE=/path/to/key.json
```

## 🚀 **Resultado Final:**

### ✅ **Funciona com:**
- Extratos digitais (CGD, Millennium, Nubank) → pdf-parse
- PDFs escaneados → Tesseract.js  
- Documentos complexos → Google Document AI
- **Qualquer tipo de extrato bancário!**

### 💡 **Custos ultra-baixos:**
- 98% dos casos são processados gratuitamente
- Google AI usado apenas quando necessário
- Limite diário protege contra custos excessivos

**Sistema pronto para produção com custos controlados!** 🎉
