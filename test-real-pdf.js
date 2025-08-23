#!/usr/bin/env node

// Teste usando o PDF real do projeto
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testRealPDF() {
  console.log('🔄 Testando com PDF real do projeto...\n');

  try {
    const pdfPath = './teste-fatura.pdf';
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Arquivo teste-fatura.pdf não encontrado');
      return;
    }

    console.log('📄 Carregando PDF real...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`   Tamanho: ${pdfBuffer.length} bytes`);
    console.log(`   Primeiros bytes: ${pdfBuffer.slice(0, 10).toString('hex')}`);

    // Preparar FormData
    const formData = new FormData();
    formData.append('file', pdfBuffer, {
      filename: 'teste-fatura.pdf',
      contentType: 'application/pdf'
    });
    formData.append('debug', 'true');
    formData.append('useOpenAI', 'true');

    console.log('\n📡 Enviando PDF real para API...');
    const response = await fetch('http://localhost:3000/api/pdf-upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('\n✅ RESPOSTA DA API:');
    console.log(`📊 Método de parsing: ${result.bankInfo?.parsingMethod}`);
    console.log(`🏪 Banco/Estabelecimento: ${result.bankInfo?.detectedBank}`);
    console.log(`📄 Tipo de documento: ${result.bankInfo?.documentType}`);
    console.log(`💳 Transações encontradas: ${result.bankInfo?.transactionsFound}`);

    if (result.bankInfo?.parsingMethod === 'openai') {
      console.log('\n🎉 DOCUMENT AI + OPENAI FUNCIONANDO COM PDF REAL!');
    } else if (result.bankInfo?.parsingMethod?.includes('fallback')) {
      console.log('\n⚠️  FALLBACK ATIVADO');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testRealPDF();
