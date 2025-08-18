#!/bin/bash

echo "🔧 Script para configurar Google Cloud Document AI"
echo "=================================================="
echo ""

# Verificar se gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI não está instalado."
    echo "📝 Para instalar:"
    echo "   brew install google-cloud-sdk"
    echo "   # ou baixe de: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ Google Cloud CLI encontrado"

# Fazer login (se necessário)
echo ""
echo "🔐 Fazendo login no Google Cloud..."
gcloud auth login --brief

# Definir projeto
echo ""
echo "🎯 Configurando projeto..."
gcloud config set project finance-app-469314

# Habilitar APIs necessárias
echo ""
echo "🚀 Habilitando APIs necessárias..."
gcloud services enable documentai.googleapis.com
gcloud services enable cloudbilling.googleapis.com

# Verificar service accounts
echo ""
echo "👤 Listando service accounts..."
gcloud iam service-accounts list --filter="email:finance-ocr@*"

echo ""
echo "🔑 Adicionando permissões necessárias..."
gcloud projects add-iam-policy-binding finance-app-469314 \
    --member="serviceAccount:finance-ocr@finance-app-469314.iam.gserviceaccount.com" \
    --role="roles/documentai.apiUser"

gcloud projects add-iam-policy-binding finance-app-469314 \
    --member="serviceAccount:finance-ocr@finance-app-469314.iam.gserviceaccount.com" \
    --role="roles/documentai.editor"

echo ""
echo "📋 Listando processadores disponíveis..."
gcloud ai document-processors list --location=us

echo ""
echo "✅ Configuração concluída!"
echo "🧪 Teste novamente com: node test-google-credentials.js"
