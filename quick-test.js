#!/usr/bin/env node

// Teste simples para verificar acesso ao Document AI
require('dotenv').config({ path: '.env.local' });

async function quickTest() {
  console.log('🔍 Teste rápido de acesso ao Google Cloud...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
    
    console.log(`📋 Projeto: ${projectId}`);
    console.log(`📋 Processador: ${processorId}`);
    console.log(`📋 Localização: ${location}\n`);
    
    const client = new DocumentProcessorServiceClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Teste direto com um documento vazio para verificar acesso
    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    
    console.log('🧪 Testando acesso ao processador...');
    
    // Criar um PDF mínimo para teste
    const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n196\n%%EOF');
    
    const request = {
      name: processorName,
      rawDocument: {
        content: testPdf.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    const [response] = await client.processDocument(request);
    
    console.log('✅ Sucesso! Processador está acessível.');
    console.log(`📄 Texto extraído: "${response.document.text || 'Nenhum texto (esperado para PDF vazio)'}"`);
    console.log('\n🎉 Google Cloud Document AI está funcionando!');
    
  } catch (error) {
    console.log('❌ Erro:', error.message);
    
    if (error.message.includes('PERMISSION_DENIED')) {
      console.log('\n💡 Soluções:');
      console.log('1. Vá para: https://console.cloud.google.com/apis/library/documentai.googleapis.com');
      console.log('2. Clique em "Enable" para habilitar a API');
      console.log('3. Vá para: https://console.cloud.google.com/iam-admin/iam');
      console.log('4. Adicione role "Document AI API User" à service account');
    } else if (error.message.includes('NOT_FOUND')) {
      console.log('\n💡 Processador não encontrado:');
      console.log('1. Vá para: https://console.cloud.google.com/ai/document-ai/processors');
      console.log('2. Crie um novo processador tipo "Document OCR"');
      console.log('3. IMPORTANTE: Selecione região "eu" (Europa)');
      console.log('4. Copie o ID do processador para o .env.local');
    } else if (error.message.includes('INVALID_ARGUMENT')) {
      console.log('\n💡 Argumento inválido (possivelmente região incorreta):');
      console.log('1. Verifique se o processador existe na região "eu"');
      console.log('2. Vá para: https://console.cloud.google.com/ai/document-ai/processors');
      console.log('3. Crie um processador na região "eu" se necessário');
    }
  }
}

quickTest();
