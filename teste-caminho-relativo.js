#!/usr/bin/env node

// Teste com caminho relativo das credenciais
require('dotenv').config({ path: '.env.local' });
const path = require('path');

async function testeComCaminhoRelativo() {
  console.log('🔍 Testando com caminho relativo das credenciais...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    
    // Resolver caminho das credenciais
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const resolvedCredentialsPath = credentialsPath?.startsWith('./') 
      ? path.resolve(process.cwd(), credentialsPath)
      : credentialsPath;
    
    console.log(`📋 Configuração:`);
    console.log(`   Projeto: ${projectId}`);
    console.log(`   Região: ${location}`);
    console.log(`   Processador: ${processorId}`);
    console.log(`   Credenciais (original): ${credentialsPath}`);
    console.log(`   Credenciais (resolvido): ${resolvedCredentialsPath}`);
    console.log(`   Arquivo existe: ${require('fs').existsSync(resolvedCredentialsPath) ? '✅' : '❌'}\n`);
    
    const client = new DocumentProcessorServiceClient({
      projectId: projectId,
      keyFilename: resolvedCredentialsPath,
    });

    console.log('🧪 Testando processamento...');
    
    // PDF mínimo
    const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n196\n%%EOF');
    
    const request = {
      name: `projects/${projectId}/locations/${location}/processors/${processorId}`,
      rawDocument: {
        content: testPdf.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    const [response] = await client.processDocument(request);
    
    console.log('✅ SUCESSO! Document OCR funcionando com caminho relativo!');
    console.log('🎉 Configuração portável implementada com sucesso!');
    console.log('\n🚀 Benefícios do caminho relativo:');
    console.log('   ✅ Funciona em qualquer máquina');
    console.log('   ✅ Não depende do caminho absoluto');
    console.log('   ✅ Melhor para colaboração em equipe');
    console.log('   ✅ Funciona em containers e deploy');
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    
    if (error.code === 3) { // INVALID_ARGUMENT
      console.log('\n⏳ O processador pode estar sendo criado ainda.');
      console.log('💡 Aguarde 2-3 minutos e tente novamente.');
    } else if (error.code === 7) { // PERMISSION_DENIED  
      console.log('\n🔑 Problema de permissões:');
      console.log('1. Vá para: https://console.cloud.google.com/iam-admin/iam');
      console.log('2. Adicione role "Document AI API User" à service account');
    }
  }
}

testeComCaminhoRelativo();
