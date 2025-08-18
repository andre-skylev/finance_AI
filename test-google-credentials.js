#!/usr/bin/env node

// Script para testar credenciais do Google Cloud Document AI
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function testCredentials() {
  console.log('🔍 Testando credenciais do Google Cloud...\n');

  // Verificar variáveis de ambiente
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  console.log('📋 Variáveis de ambiente:');
  console.log(`   GOOGLE_CLOUD_PROJECT_ID: ${projectId || '❌ NÃO CONFIGURADO'}`);
  console.log(`   GOOGLE_DOCUMENT_AI_PROCESSOR_ID: ${processorId || '❌ NÃO CONFIGURADO'}`);
  console.log(`   GOOGLE_CLOUD_LOCATION: ${location}`);
  console.log(`   GOOGLE_APPLICATION_CREDENTIALS: ${credentialsPath || '❌ NÃO CONFIGURADO'}\n`);

  // Verificar arquivo de credenciais
  if (credentialsPath) {
    if (fs.existsSync(credentialsPath)) {
      console.log('✅ Arquivo de credenciais encontrado');
      try {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        console.log(`   Email: ${credentials.client_email}`);
        console.log(`   Project ID no arquivo: ${credentials.project_id}\n`);
      } catch (error) {
        console.log('❌ Erro ao ler arquivo de credenciais:', error.message, '\n');
      }
    } else {
      console.log('❌ Arquivo de credenciais não encontrado no caminho especificado\n');
    }
  }

  // Verificar se todas as variáveis estão configuradas
  if (!projectId || !processorId) {
    console.log('❌ Credenciais incompletas. Configure todas as variáveis necessárias.\n');
    console.log('📝 Para obter o Processor ID:');
    console.log('   1. Vá para: https://console.cloud.google.com/ai/document-ai/processors');
    console.log('   2. Selecione seu projeto');
    console.log('   3. Clique em "Create Processor" se não tiver nenhum');
    console.log('   4. Copie o Processor ID da lista\n');
    return;
  }

  // Testar conexão com Google Cloud
  try {
    console.log('🔐 Testando autenticação...');
    
    const client = new DocumentProcessorServiceClient({
      keyFilename: credentialsPath,
    });

    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log(`   Testando processador: ${processorName}`);

    // Tentar listar processadores para verificar autenticação
    const [processors] = await client.listProcessors({
      parent: `projects/${projectId}/locations/${location}`,
    });

    console.log('✅ Autenticação bem-sucedida!');
    console.log(`   Processadores encontrados: ${processors.length}`);
    
    // Verificar se o processador específico existe
    const targetProcessor = processors.find(p => p.name.includes(processorId));
    if (targetProcessor) {
      console.log('✅ Processador configurado encontrado!');
      console.log(`   Nome: ${targetProcessor.displayName}`);
      console.log(`   Tipo: ${targetProcessor.type}`);
      console.log(`   Estado: ${targetProcessor.state}\n`);
      console.log('🎉 Configuração completa! Você pode usar o OCR do Google Cloud.');
    } else {
      console.log('❌ Processador não encontrado. Verifique o PROCESSOR_ID.');
      console.log('\n📋 Processadores disponíveis:');
      processors.forEach(p => {
        const id = p.name.split('/').pop();
        console.log(`   ID: ${id} | Nome: ${p.displayName} | Tipo: ${p.type}`);
      });
    }

  } catch (error) {
    console.log('❌ Erro na autenticação:', error.message);
    
    if (error.message.includes('PERMISSION_DENIED')) {
      console.log('\n💡 Possíveis soluções:');
      console.log('   1. Verifique se a API Document AI está habilitada');
      console.log('   2. Verifique se a service account tem as permissões corretas');
      console.log('   3. Tente criar uma nova service account com role "Document AI API User"');
    }
  }
}

testCredentials().catch(console.error);
