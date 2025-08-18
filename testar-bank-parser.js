#!/usr/bin/env node

// Teste específico para Bank Statement Parser
require('dotenv').config({ path: '.env.local' });

async function testarBankStatementParser() {
  console.log('🏦 Testando Bank Statement Parser...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    
    console.log(`📋 Configuração:`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Location: ${location}`);
    console.log(`   Processor ID: ${processorId}`);
    console.log(`   Processor Type: Bank Statement Parser\n`);
    
    const client = new DocumentProcessorServiceClient({
      projectId: projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log(`🎯 Processor name: ${processorName}\n`);

    console.log('🧪 Testando com PDF mínimo...');

    // PDF mínimo válido
    const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n196\n%%EOF');

    const request = {
      name: processorName,
      rawDocument: {
        content: testPdf.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    console.log('📡 Enviando requisição...');
    const [response] = await client.processDocument(request);
    
    console.log('✅ SUCESSO! Bank Statement Parser está funcionando!');
    console.log(`📄 Texto extraído: "${response.document.text || 'Nenhum texto (normal para PDF vazio)'}"`);
    console.log(`📊 Páginas processadas: ${response.document.pages?.length || 0}`);
    
    // Verificar se há entidades extraídas (específico para Bank Statement)
    if (response.document.entities && response.document.entities.length > 0) {
      console.log(`💰 Entidades bancárias encontradas: ${response.document.entities.length}`);
      response.document.entities.forEach(entity => {
        console.log(`   - ${entity.type}: ${entity.mentionText}`);
      });
    } else {
      console.log('ℹ️  Nenhuma entidade bancária encontrada (normal para PDF de teste)');
    }
    
    console.log('\n🎉 Google Cloud Bank Statement Parser configurado com sucesso!');
    console.log('💰 Pronto para processar extratos bancários reais!');
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    console.log(`📊 Código: ${error.code}`);
    
    if (error.code === 3) {
      console.log('\n💡 INVALID_ARGUMENT pode indicar:');
      console.log('1. PDF inválido ou corrompido');
      console.log('2. Formato não suportado pelo Bank Statement Parser');
      console.log('3. Configuração incorreta');
    } else if (error.code === 7) {
      console.log('\n💡 PERMISSION_DENIED indica:');
      console.log('1. Service account sem permissões adequadas');
      console.log('2. API não habilitada');
    }
  }
}

testarBankStatementParser();
