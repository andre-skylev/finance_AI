#!/usr/bin/env node

// Teste exato igual ao código da API
require('dotenv').config({ path: '.env.local' });

async function testeExato() {
  console.log('🔍 Teste exato da API de PDF upload\n');
  
  try {
    // Mesma lógica da API
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    // Configurar cliente exatamente como na API
    const client = new DocumentProcessorServiceClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

    console.log(`📋 Configuração:`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Location: ${location}`);
    console.log(`   Processor ID: ${processorId}`);
    console.log(`   Credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}\n`);

    if (!projectId || !processorId) {
      throw new Error('Credenciais do Google Cloud não configuradas');
    }

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log(`🎯 Processor name: ${name}\n`);

    console.log('🧪 Processando PDF de teste...');

    // PDF mínimo válido
    const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n196\n%%EOF');

    const request = {
      name,
      rawDocument: {
        content: testPdf.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    const [response] = await client.processDocument(request);
    
    console.log('✅ SUCESSO! Document AI processou o PDF!');
    console.log(`📄 Texto extraído: "${response.document.text || 'Nenhum texto (normal para PDF de teste)'}"`);
    console.log(`📊 Páginas processadas: ${response.document.pages?.length || 0}`);
    console.log('\n🎉 Google Cloud Document AI está funcionando perfeitamente!');
    console.log('💰 A cobrança será aplicada somente para PDFs reais processados.');
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    console.log(`📊 Código do erro: ${error.code}`);
    
    if (error.message.includes('INVALID_ARGUMENT')) {
      console.log('\n💡 Possíveis causas do INVALID_ARGUMENT:');
      console.log('1. Processador não existe na região especificada');
      console.log('2. Processador existe mas em região diferente');
      console.log('3. ID do processador incorreto');
      console.log('4. Projeto incorreto');
      console.log('\n🔧 Verifique no Google Cloud Console:');
      console.log('https://console.cloud.google.com/ai/document-ai/processors');
    }
  }
}

testeExato();
