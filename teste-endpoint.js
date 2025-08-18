#!/usr/bin/env node

// Teste final com endpoint explícito
require('dotenv').config({ path: '.env.local' });
const path = require('path');

async function testeComEndpointExplicito() {
  console.log('🔍 Teste final com endpoint explícito...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const resolvedCredentialsPath = path.resolve(process.cwd(), credentialsPath);
    
    const clientOptions = {
      apiEndpoint: `${location}-documentai.googleapis.com`,
      keyFilename: resolvedCredentialsPath,
    };
    
    console.log(`📋 Configuração:`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Location: ${location}`);
    console.log(`   Processor ID: ${processorId}`);
    console.log(`   Endpoint: ${clientOptions.apiEndpoint}\n`);
    
    const client = new DocumentProcessorServiceClient(clientOptions);

    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log(`🎯 Processor name: ${processorName}\n`);

    console.log('🧪 Testando com PDF de exemplo...');
    
    // PDF com texto
    const testPdfWithText = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
      '4 0 obj<</Length 44>>stream\n' +
      'BT /F1 12 Tf 100 700 Td (Teste de OCR Document AI) Tj ET\n' +
      'endstream endobj\n' +
      '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
      'xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \n0000000279 00000 n \n0000000372 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n444\n%%EOF'
    );

    const request = {
      name: processorName,
      rawDocument: {
        content: testPdfWithText.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    console.log('📡 Enviando requisição...');
    const [response] = await client.processDocument(request);
    
    console.log('✅ SUCESSO! Google Document OCR está funcionando!');
    console.log(`📄 Texto extraído: "${response.document.text?.trim()}"`);
    console.log('\n🎉 Configuração finalizada e validada!');
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    console.log(`📊 Código: ${error.code}`);
    
    if (error.code === 7) {
      console.log('\n🔑 Problema de permissões:');
      console.log('1. Vá para: https://console.cloud.google.com/iam-admin/iam');
      console.log('2. Adicione role "Document AI API User" à service account');
    } else if (error.code === 3) {
      console.log('\n💡 INVALID_ARGUMENT:');
      console.log('1. Verifique se o ID do processador está correto');
      console.log('2. Verifique se a região está correta');
    }
  }
}

testeComEndpointExplicito();
