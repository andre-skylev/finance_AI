#!/usr/bin/env node

// Teste simples para verificar se o processador responde
require('dotenv').config({ path: '.env.local' });

async function testeBasico() {
  console.log('🔍 Teste básico do processador...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    
    console.log(`📋 Testando:`);
    console.log(`   Projeto: ${projectId}`);
    console.log(`   Região: ${location}`);
    console.log(`   Processador: ${processorId}\n`);
    
    const client = new DocumentProcessorServiceClient({
      projectId: projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Vamos tentar diferentes formatos de PDF mais simples
    console.log('🧪 Testando com PDF ultra-simples...');
    
    // PDF absolutamente mínimo
    const simplePdf = Buffer.from('%PDF-1.4\n%%EOF');
    
    const request = {
      name: `projects/${projectId}/locations/${location}/processors/${processorId}`,
      rawDocument: {
        content: simplePdf.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    console.log('📡 Enviando requisição...');
    const [response] = await client.processDocument(request);
    
    console.log('✅ SUCESSO! Processador está funcionando!');
    console.log('🎉 Google Cloud Document OCR configurado corretamente!');
    
    // Agora testar na aplicação real
    console.log('\n🚀 Vamos testar na aplicação:');
    console.log('1. Execute: npm run dev');
    console.log('2. Vá para: http://localhost:3000/pdf-import');
    console.log('3. Faça upload de um PDF real');
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    
    if (error.code === 7) { // PERMISSION_DENIED
      console.log('\n🔑 Problema de permissões detectado!');
      console.log('💡 Soluções:');
      console.log('1. Vá para: https://console.cloud.google.com/iam-admin/iam');
      console.log('2. Encontre: finance-ocr@finance-app-469314.iam.gserviceaccount.com');
      console.log('3. Adicione a role: "Document AI API User"');
      console.log('4. Aguarde 1-2 minutos para as permissões propagarem');
    } else if (error.code === 3) { // INVALID_ARGUMENT
      console.log('\n⏳ Possível problema de timing ou configuração:');
      console.log('1. O processador pode estar ainda sendo criado (aguarde 2-3 minutos)');
      console.log('2. Verifique se o ID está correto: 59d168b062d95b94');
      console.log('3. Verifique se a região está correta: eu');
    }
  }
}

testeBasico();
