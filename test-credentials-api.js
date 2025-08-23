#!/usr/bin/env node

// Teste específico para validar credenciais base64 na API
require('dotenv').config({ path: '.env.local' });
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

async function testCredentialsAPI() {
  console.log('🔐 Testando credenciais base64 na API...\n');

  try {
    // Verificar se as credenciais base64 estão configuradas
    const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!credentialsBase64) {
      console.log('❌ GOOGLE_CREDENTIALS_BASE64 não configurado');
      return;
    }

    // Decodificar para verificar se é válido
    const credentials = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString());
    console.log('✅ Credenciais base64 válidas');
    console.log(`   Email: ${credentials.client_email}`);
    console.log(`   Project ID: ${credentials.project_id}`);
    
    // Verificar outras configurações
    console.log(`   GOOGLE_CLOUD_PROJECT_ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
    console.log(`   GOOGLE_CLOUD_LOCATION: ${process.env.GOOGLE_CLOUD_LOCATION}`);
    console.log(`   GOOGLE_DOCUMENT_AI_PROCESSOR_ID: ${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`);

    // Testar API com PDF pequeno
    console.log('\n📄 Criando PDF de teste...');
    const testPdf = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
      '4 0 obj<</Length 44>>stream\n' +
      'BT /F1 12 Tf 100 700 Td (Teste API Document AI) Tj ET\n' +
      'endstream endobj\n' +
      '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
      'xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \n0000000279 00000 n \n0000000372 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n444\n%%EOF'
    );

    const formData = new FormData();
    formData.append('file', testPdf, {
      filename: 'test-api.pdf',
      contentType: 'application/pdf'
    });
    formData.append('debug', 'true');
    formData.append('useOpenAI', 'true');

    console.log('📡 Enviando para API...');
    const response = await fetch('http://localhost:3000/api/pdf-upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('\n✅ RESPOSTA DA API:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Método: ${result.bankInfo?.parsingMethod}`);
      console.log(`   Sucesso: ${result.success}`);
      
      if (result.bankInfo?.parsingMethod === 'openai') {
        console.log('\n🎉 DOCUMENT AI + OPENAI FUNCIONANDO!');
      } else if (result.bankInfo?.parsingMethod?.includes('fallback')) {
        console.log('\n⚠️  FALLBACK ATIVADO - Document AI pode ter falhado');
      }

      if (result.debug) {
        console.log('\n🔍 Debug Info:', JSON.stringify(result.debug, null, 2));
      }
    } else {
      console.log('\n❌ ERRO NA API:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Erro: ${JSON.stringify(result, null, 2)}`);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testCredentialsAPI();
