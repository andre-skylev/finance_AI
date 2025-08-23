#!/usr/bin/env node

// Teste do fluxo completo: Google Document AI + OpenAI
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testCompleteFlow() {
  console.log('🔄 Testando fluxo completo: Document AI → OpenAI...\n');

  try {
    // Verificar se o PDF existe
    const pdfPath = './teste-fatura.pdf';
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Arquivo teste-fatura.pdf não encontrado');
      return;
    }

    console.log('📄 Carregando PDF...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`   Tamanho: ${pdfBuffer.length} bytes`);

    // Preparar FormData
    const formData = new FormData();
    formData.append('file', pdfBuffer, {
      filename: 'teste-fatura.pdf',
      contentType: 'application/pdf'
    });
    formData.append('debug', 'true');
    formData.append('useOpenAI', 'true');

    console.log('\n📡 Enviando para API...');
    const response = await fetch('http://localhost:3000/api/pdf-upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer test-token' // Para bypass do auth
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('\n✅ RESPOSTA DA API:');
    console.log(JSON.stringify(result, null, 2));

    // Analisar resultados
    if (result.success) {
      console.log('\n🎉 FLUXO COMPLETO FUNCIONANDO!');
      console.log(`📊 Método de parsing: ${result.bankInfo?.parsingMethod}`);
      console.log(`🏪 Banco/Estabelecimento: ${result.bankInfo?.detectedBank}`);
      console.log(`📄 Tipo de documento: ${result.bankInfo?.documentType}`);
      console.log(`💳 Transações encontradas: ${result.bankInfo?.transactionsFound}`);
      
      if (result.data && result.data.length > 0) {
        console.log('\n💰 TRANSAÇÕES:');
        result.data.slice(0, 3).forEach((t, i) => {
          console.log(`   ${i+1}. ${t.description} - €${Math.abs(t.amount)}`);
        });
        if (result.data.length > 3) {
          console.log(`   ... e mais ${result.data.length - 3} transações`);
        }
      }

      if (result.debug) {
        console.log('\n🔍 DEBUG INFO:');
        console.log(`   Configuração: ${JSON.stringify(result.debug.config)}`);
      }
    } else {
      console.log('❌ Falha no processamento:', result.error);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testCompleteFlow();
