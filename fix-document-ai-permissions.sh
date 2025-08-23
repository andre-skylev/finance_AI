#!/bin/bash

# Script para configurar permissões do Google Cloud Document AI
# Execute este script para corrigir problemas de permissão

set -e

echo "🔧 Configurando permissões do Google Cloud Document AI..."

# Verificar se gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI não está instalado."
    echo "   Instale em: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Carregar variáveis de ambiente
if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"finance-app-469314"}
LOCATION=${GOOGLE_CLOUD_LOCATION:-"eu"}
SERVICE_ACCOUNT_EMAIL="finance-ocr@${PROJECT_ID}.iam.gserviceaccount.com"

echo "📋 Configuração:"
echo "   Project ID: $PROJECT_ID"
echo "   Location: $LOCATION"
echo "   Service Account: $SERVICE_ACCOUNT_EMAIL"

# Configurar projeto ativo
echo "🔧 Configurando projeto ativo..."
gcloud config set project $PROJECT_ID

# Habilitar APIs necessárias
echo "🔧 Habilitando APIs do Google Cloud..."
gcloud services enable documentai.googleapis.com
gcloud services enable iam.googleapis.com

# Adicionar permissões à service account
echo "🔧 Adicionando permissões Document AI..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/documentai.apiUser"

echo "🔧 Adicionando permissões de viewer para listar processadores..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/documentai.viewer"

# Verificar se existe processador
echo "📋 Verificando processadores existentes..."
gcloud ai document-processors list --location=$LOCATION --format="table(name,displayName,type,state)" || {
    echo "⚠️  Nenhum processador encontrado. Criando processador padrão..."
    
    # Criar processador OCR genérico
    echo "🔧 Criando processador Document OCR..."
    PROCESSOR_NAME=$(gcloud ai document-processors create \
        --location=$LOCATION \
        --display-name="Processador OCR Principal" \
        --type=OCR_PROCESSOR \
        --format="value(name)")
    
    # Extrair ID do processador
    PROCESSOR_ID=$(basename $PROCESSOR_NAME)
    echo "✅ Processador criado: $PROCESSOR_ID"
    echo "   Adicione ao .env.local: GOOGLE_DOCUMENT_AI_PROCESSOR_ID=$PROCESSOR_ID"
}

# Verificar se existe processador de formulários
echo "🔧 Verificando processador de formulários..."
if ! gcloud ai document-processors list --location=$LOCATION --filter="type:FORM_PARSER_PROCESSOR" --format="value(name)" | head -1 > /dev/null; then
    echo "🔧 Criando processador Form Parser..."
    FORM_PROCESSOR_NAME=$(gcloud ai document-processors create \
        --location=$LOCATION \
        --display-name="Processador Formulários" \
        --type=FORM_PARSER_PROCESSOR \
        --format="value(name)")
    
    FORM_PROCESSOR_ID=$(basename $FORM_PROCESSOR_NAME)
    echo "✅ Processador de formulários criado: $FORM_PROCESSOR_ID"
    echo "   Adicione ao .env.local: GOOGLE_DOCUMENT_AI_PROCESSOR_ID_BANK=$FORM_PROCESSOR_ID"
fi

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📝 Próximos passos:"
echo "1. Execute: node test-document-ai-improved.js"
echo "2. Se funcionar, teste: npm run dev"
echo "3. Teste upload de PDF na aplicação"
echo ""
echo "💡 Se ainda houver problemas:"
echo "1. Aguarde 1-2 minutos para as permissões se propagarem"
echo "2. Verifique se a API Document AI está habilitada no Console"
echo "3. Confirme que está usando a região correta ($LOCATION)"
