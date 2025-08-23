#!/usr/bin/env node

// Enhanced test script for Google Cloud Document AI
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

function getGoogleCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    try {
      const credentialsJson = Buffer.from(
        process.env.GOOGLE_CREDENTIALS_BASE64,
        'base64'
      ).toString('utf-8');
      return JSON.parse(credentialsJson);
    } catch (error) {
      console.log('❌ Erro ao decodificar GOOGLE_CREDENTIALS_BASE64:', error.message);
      return null;
    }
  }
  return null;
}

async function testCredentials() {
  console.log('🔍 Testando credenciais do Google Cloud Document AI...\n');

  // Verificar variáveis de ambiente
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
  const receiptProcessorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID_RECEIPT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;

  console.log('📋 Variáveis de ambiente:');
  console.log(`   GOOGLE_CLOUD_PROJECT_ID: ${projectId || '❌ NÃO CONFIGURADO'}`);
  console.log(`   GOOGLE_DOCUMENT_AI_PROCESSOR_ID: ${processorId || '❌ NÃO CONFIGURADO'}`);
  console.log(`   GOOGLE_DOCUMENT_AI_PROCESSOR_ID_RECEIPT: ${receiptProcessorId || '❌ NÃO CONFIGURADO'}`);
  console.log(`   GOOGLE_CLOUD_LOCATION: ${location}`);
  console.log(`   GOOGLE_APPLICATION_CREDENTIALS: ${credentialsPath || '❌ NÃO CONFIGURADO'}`);
  console.log(`   GOOGLE_CREDENTIALS_BASE64: ${credentialsBase64 ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO'}\n`);

  // Get credentials
  let credentials = null;
  if (credentialsBase64) {
    credentials = getGoogleCredentials();
    if (credentials) {
      console.log('✅ Credenciais base64 decodificadas com sucesso');
      console.log(`   Email: ${credentials.client_email}`);
      console.log(`   Project ID no credentials: ${credentials.project_id}\n`);
    }
  } else if (credentialsPath && fs.existsSync(credentialsPath)) {
    try {
      credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      console.log('✅ Arquivo de credenciais carregado');
      console.log(`   Email: ${credentials.client_email}`);
      console.log(`   Project ID no arquivo: ${credentials.project_id}\n`);
    } catch (error) {
      console.log('❌ Erro ao ler arquivo de credenciais:', error.message, '\n');
    }
  }

  if (!credentials) {
    console.log('❌ Nenhuma credencial válida encontrada\n');
    return;
  }

  // Verificar se todas as variáveis estão configuradas
  if (!projectId) {
    console.log('❌ GOOGLE_CLOUD_PROJECT_ID não configurado\n');
    return;
  }

  // Testar conexão com Google Cloud
  try {
    console.log('🔐 Testando autenticação...');
    
    const apiEndpoint = location === 'eu' ? 'eu-documentai.googleapis.com' : 'us-documentai.googleapis.com';
    console.log(`   API Endpoint: ${apiEndpoint}`);
    
    const client = new DocumentProcessorServiceClient({
      projectId,
      apiEndpoint,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key
      }
    });

    // Tentar listar processadores para verificar autenticação
    const [processors] = await client.listProcessors({
      parent: `projects/${projectId}/locations/${location}`,
    });

    console.log('✅ Autenticação bem-sucedida!');
    console.log(`   Processadores encontrados: ${processors.length}\n`);
    
    // Verificar processadores configurados
    if (processors.length === 0) {
      console.log('❌ Nenhum processador encontrado. Você precisa criar processadores no Google Cloud Console.');
      console.log('   Vá para: https://console.cloud.google.com/ai/document-ai/processors');
      return;
    }

    console.log('📋 Processadores disponíveis:');
    processors.forEach(p => {
      const id = p.name.split('/').pop();
      console.log(`   ID: ${id} | Nome: ${p.displayName} | Tipo: ${p.type} | Estado: ${p.state}`);
    });
    console.log('');

    // Verificar processador principal
    if (processorId) {
      const targetProcessor = processors.find(p => p.name.includes(processorId));
      if (targetProcessor) {
        console.log('✅ Processador principal encontrado!');
        console.log(`   ID: ${processorId}`);
        console.log(`   Nome: ${targetProcessor.displayName}`);
        console.log(`   Tipo: ${targetProcessor.type}`);
        console.log(`   Estado: ${targetProcessor.state}\n`);
      } else {
        console.log(`❌ Processador principal (${processorId}) não encontrado\n`);
      }
    }

    // Verificar processador de recibos
    if (receiptProcessorId) {
      const receiptProcessor = processors.find(p => p.name.includes(receiptProcessorId));
      if (receiptProcessor) {
        console.log('✅ Processador de recibos encontrado!');
        console.log(`   ID: ${receiptProcessorId}`);
        console.log(`   Nome: ${receiptProcessor.displayName}`);
        console.log(`   Tipo: ${receiptProcessor.type}`);
        console.log(`   Estado: ${receiptProcessor.state}\n`);
      } else {
        console.log(`❌ Processador de recibos (${receiptProcessorId}) não encontrado\n`);
      }
    }

    console.log('🎉 Configuração verificada! Testando processamento de exemplo...\n');

    // Teste com um PDF simples (se existir)
    const testPdf = './teste-fatura.pdf';
    if (fs.existsSync(testPdf)) {
      console.log('📄 Testando com PDF de exemplo...');
      await testProcessDocument(client, projectId, location, processorId, testPdf);
    } else {
      console.log('📄 Arquivo teste-fatura.pdf não encontrado, pulando teste de processamento');
    }

  } catch (error) {
    console.log('❌ Erro na autenticação:', error.message);
    
    if (error.message.includes('PERMISSION_DENIED')) {
      console.log('\n💡 Possíveis soluções:');
      console.log('   1. Verifique se a API Document AI está habilitada');
      console.log('   2. Verifique se a service account tem as permissões corretas');
      console.log('   3. Tente criar uma nova service account com role "Document AI API User"');
    } else if (error.message.includes('INVALID_ARGUMENT')) {
      console.log('\n💡 Possíveis soluções:');
      console.log('   1. Verifique se o location está correto (us ou eu)');
      console.log('   2. Verifique se o processor ID está correto');
    }
    console.log('\n🔍 Detalhes do erro:', error);
  }
}

async function testProcessDocument(client, projectId, location, processorId, filePath) {
  try {
    if (!processorId) {
      console.log('   ⚠️  Processador não configurado, pulando teste');
      return;
    }

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const buffer = fs.readFileSync(filePath);
    
    console.log(`   Processando: ${filePath}`);
    console.log(`   Tamanho: ${(buffer.length / 1024).toFixed(1)} KB`);
    console.log(`   Processador: ${name}`);

    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    });

    const document = result.document;
    if (document) {
      console.log('   ✅ Processamento bem-sucedido!');
      console.log(`   Texto extraído: ${(document.text || '').length} caracteres`);
      console.log(`   Entidades encontradas: ${(document.entities || []).length}`);
      console.log(`   Páginas: ${(document.pages || []).length}`);
      
      // Mostrar algumas entidades como exemplo
      if (document.entities && document.entities.length > 0) {
        console.log('\n   📊 Primeiras entidades encontradas:');
        document.entities.slice(0, 5).forEach((entity, i) => {
          const text = entity.normalizedValue?.text || entity.mentionText || 'N/A';
          console.log(`   ${i + 1}. ${entity.type}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        });
      }
      
      // Detectar tipo de documento
      const docTypeEntity = document.entities?.find(e => e.type?.toLowerCase().includes('document_type'));
      if (docTypeEntity) {
        const docType = docTypeEntity.normalizedValue?.text || docTypeEntity.mentionText;
        console.log(`\n   📋 Tipo de documento detectado: ${docType}`);
      }
      
    } else {
      console.log('   ❌ Nenhum documento retornado');
    }
  } catch (error) {
    console.log(`   ❌ Erro no processamento: ${error.message}`);
    if (error.details) {
      console.log(`   Detalhes: ${error.details}`);
    }
  }
}

// Função para testar API endpoint local
async function testLocalEndpoint() {
  console.log('\n🌐 Testando endpoint local...');
  
  const testPdf = './teste-fatura.pdf';
  if (!fs.existsSync(testPdf)) {
    console.log('   ⚠️  Arquivo teste-fatura.pdf não encontrado, pulando teste local');
    return;
  }

  try {
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testPdf));
    form.append('auto', '1');
    form.append('debug', '1');

    console.log('   Enviando para http://localhost:3000/api/pdf-upload...');
    
    const response = await fetch('http://localhost:3000/api/pdf-upload', {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': 'Bearer fake-token-for-test' // This won't work without proper auth
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('   ✅ Endpoint local funcionando!');
      console.log(`   Transações encontradas: ${result.data?.transactions?.length || 0}`);
      console.log(`   Recibos encontrados: ${result.data?.receipts?.length || 0}`);
    } else {
      const error = await response.text();
      console.log(`   ❌ Erro no endpoint: ${response.status} - ${error}`);
    }
  } catch (error) {
    console.log(`   ❌ Erro na requisição: ${error.message}`);
    console.log('   (Isso é normal se o servidor não estiver rodando)');
  }
}

async function main() {
  await testCredentials();
  // await testLocalEndpoint(); // Descomente para testar endpoint local
}

main().catch(console.error);
