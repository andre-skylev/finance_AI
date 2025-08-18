#!/usr/bin/env node

// Teste para Document OCR (após criar o novo processador)
require('dotenv').config({ path: '.env.local' });

async function testarDocumentOCR() {
  console.log('📄 Testando Document OCR...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    
    console.log(`📋 Configuração:`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Location: ${location}`);
    console.log(`   Processor ID: ${processorId}`);
    console.log(`   Processor Type: Document OCR\n`);
    
    const client = new DocumentProcessorServiceClient({
      projectId: projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log(`🎯 Processor name: ${processorName}\n`);

    console.log('🧪 Testando com PDF de exemplo com texto...');

    // PDF com texto real para testar OCR
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
    
    console.log('✅ SUCESSO! Document OCR está funcionando!');
    console.log(`📄 Texto extraído: "${response.document.text?.trim() || 'Nenhum texto'}"`);
    console.log(`📊 Páginas processadas: ${response.document.pages?.length || 0}`);
    
    // Informações detalhadas
    if (response.document.pages && response.document.pages.length > 0) {
      const page = response.document.pages[0];
      console.log(`📏 Dimensões da página: ${page.dimension?.width}x${page.dimension?.height}`);
      console.log(`🔤 Parágrafos encontrados: ${page.paragraphs?.length || 0}`);
      console.log(`📝 Linhas encontradas: ${page.lines?.length || 0}`);
    }
    
    console.log('\n🎉 Google Cloud Document OCR configurado com sucesso!');
    console.log('📋 Pronto para processar qualquer tipo de PDF!');
    console.log('💰 Custos otimizados com fallback gratuito via Tesseract.js');
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    console.log(`📊 Código: ${error.code}`);
    
    if (error.code === 3) {
      console.log('\n💡 INVALID_ARGUMENT pode indicar:');
      console.log('1. Processor ID incorreto (você atualizou no .env.local?)');
      console.log('2. Processador ainda sendo criado (aguarde alguns minutos)');
      console.log('3. Região incorreta');
    } else if (error.code === 5) {
      console.log('\n💡 NOT_FOUND indica:');
      console.log('1. Processor ID não existe');
      console.log('2. Processador não foi criado ainda');
      console.log('3. Região incorreta');
    } else if (error.code === 7) {
      console.log('\n💡 PERMISSION_DENIED indica:');
      console.log('1. Service account precisa de role "Document AI API User"');
      console.log('2. API Document AI não está habilitada');
    }
    
    console.log('\n🔧 Para resolver:');
    console.log('1. Vá para: https://console.cloud.google.com/ai/document-ai/processors');
    console.log('2. Crie um processador "Document OCR" na região "eu"');
    console.log('3. Copie o ID e atualize o .env.local');
  }
}

testarDocumentOCR();
