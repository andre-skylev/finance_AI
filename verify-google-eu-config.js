#!/usr/bin/env node

/**
 * Verify Google Document AI EU Region Configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuração do Google Document AI (Região EU)...\n');

// Check environment variables
const requiredEnvVars = {
  'GOOGLE_CLOUD_PROJECT_ID': process.env.GOOGLE_CLOUD_PROJECT_ID,
  'GOOGLE_CLOUD_REGION': process.env.GOOGLE_CLOUD_REGION || process.env.GOOGLE_CLOUD_LOCATION,
  'GOOGLE_DOCUMENT_AI_PROCESSOR_ID': process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,
  'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
  'GOOGLE_AI_DAILY_LIMIT': process.env.GOOGLE_AI_DAILY_LIMIT || '50'
};

console.log('📋 Variáveis de Ambiente:');
console.log('------------------------');
for (const [key, value] of Object.entries(requiredEnvVars)) {
  const status = value ? '✅' : '❌';
  const displayValue = value ? (key.includes('KEY') || key.includes('CREDENTIALS') ? '***' : value) : 'NÃO CONFIGURADO';
  console.log(`${status} ${key}: ${displayValue}`);
}

// Check region
const region = process.env.GOOGLE_CLOUD_REGION || process.env.GOOGLE_CLOUD_LOCATION;
if (region) {
  console.log('\n🌍 Região Configurada:', region);
  if (region === 'eu') {
    console.log('✅ Região EU configurada corretamente');
    console.log('   Endpoint: eu-documentai.googleapis.com');
  } else if (region === 'us') {
    console.log('⚠️  Região US configurada - considere usar EU para conformidade GDPR');
    console.log('   Endpoint: us-documentai.googleapis.com');
  } else {
    console.log('⚠️  Região personalizada:', region);
    console.log(`   Endpoint: ${region}-documentai.googleapis.com`);
  }
} else {
  console.log('\n❌ Região não configurada - será usado EU por padrão');
}

// Check credentials file
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath) {
  const resolvedPath = credPath.startsWith('./') 
    ? path.resolve(process.cwd(), credPath)
    : credPath;
  
  console.log('\n📄 Arquivo de Credenciais:');
  console.log('   Caminho:', resolvedPath);
  
  if (fs.existsSync(resolvedPath)) {
    console.log('✅ Arquivo existe');
    
    try {
      const creds = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      console.log('   Tipo:', creds.type || 'Desconhecido');
      console.log('   Projeto:', creds.project_id || 'Não especificado');
      console.log('   Email:', creds.client_email ? creds.client_email.substring(0, 20) + '...' : 'Não especificado');
    } catch (error) {
      console.log('⚠️  Não foi possível ler o arquivo de credenciais');
    }
  } else {
    console.log('❌ Arquivo não encontrado');
  }
}

// Check processor configuration
console.log('\n🤖 Processador Document AI:');
if (process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID) {
  const processorPath = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/${region || 'eu'}/processors/${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;
  console.log('   Caminho completo:', processorPath);
  console.log('   ⚠️  Certifique-se de que o processador foi criado na região:', region || 'eu');
} else {
  console.log('❌ ID do processador não configurado');
}

// Recommendations
console.log('\n📝 Recomendações:');
console.log('================');

if (!region || region !== 'eu') {
  console.log('1. Configure GOOGLE_CLOUD_REGION=eu no arquivo .env');
}

if (!process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID) {
  console.log('2. Crie um processador OCR na região EU:');
  console.log('   - Acesse: https://console.cloud.google.com/ai/document-ai');
  console.log('   - Selecione região: Europe (eu)');
  console.log('   - Crie um processador: Document OCR');
  console.log('   - Copie o ID do processador para GOOGLE_DOCUMENT_AI_PROCESSOR_ID');
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('3. Configure as credenciais do Google Cloud:');
  console.log('   - Crie uma service account');
  console.log('   - Baixe o arquivo JSON de credenciais');
  console.log('   - Configure GOOGLE_APPLICATION_CREDENTIALS=./caminho/para/credenciais.json');
}

console.log('\n✨ Para usar a região EU corretamente:');
console.log('   1. O processador DEVE ser criado na região EU');
console.log('   2. Configure GOOGLE_CLOUD_REGION=eu');
console.log('   3. O endpoint será: eu-documentai.googleapis.com');
console.log('   4. Isso garante conformidade com GDPR para dados europeus');

// Test configuration
console.log('\n🧪 Teste de Configuração:');
console.log('========================');

async function testConfiguration() {
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
    
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const resolvedCredentialsPath = credentialsPath?.startsWith('./') 
      ? path.resolve(process.cwd(), credentialsPath)
      : credentialsPath;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = region || 'eu';
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    
    if (!projectId || !processorId) {
      console.log('❌ Configuração incompleta - não é possível testar');
      return;
    }
    
    console.log('Tentando criar cliente com:');
    console.log('  - Região:', location);
    console.log('  - Endpoint:', `${location}-documentai.googleapis.com`);
    
    const client = new DocumentProcessorServiceClient({
      projectId: projectId,
      keyFilename: resolvedCredentialsPath,
      apiEndpoint: `${location}-documentai.googleapis.com`,
    });
    
    console.log('✅ Cliente criado com sucesso');
    
    // Try to get processor info
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log('Verificando processador:', name);
    
    const [processor] = await client.getProcessor({ name });
    console.log('✅ Processador encontrado:', processor.displayName || 'Sem nome');
    console.log('   Tipo:', processor.type);
    console.log('   Estado:', processor.state);
    
  } catch (error) {
    console.log('❌ Erro ao testar configuração:', error.message);
    if (error.message.includes('NOT_FOUND')) {
      console.log('   → O processador não existe na região especificada');
      console.log('   → Crie o processador na região EU através do console');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.log('   → Service account sem permissões');
      console.log('   → Adicione o role "Document AI API User" à service account');
    } else if (error.message.includes('INVALID_ARGUMENT')) {
      console.log('   → Configuração inválida');
      console.log('   → Verifique se o processador foi criado na região correta');
    }
  }
}

// Run test if all required vars are present
if (requiredEnvVars.GOOGLE_CLOUD_PROJECT_ID && 
    requiredEnvVars.GOOGLE_DOCUMENT_AI_PROCESSOR_ID && 
    requiredEnvVars.GOOGLE_APPLICATION_CREDENTIALS) {
  testConfiguration();
} else {
  console.log('⚠️  Configure todas as variáveis necessárias para executar o teste');
}