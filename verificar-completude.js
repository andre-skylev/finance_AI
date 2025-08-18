#!/usr/bin/env node

// Verificar completude da leitura de transações
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

function contarTransacoes() {
  try {
    console.log('📊 ANÁLISE DE COMPLETUDE DAS TRANSAÇÕES\n');
    
    // Ler o texto da fatura
    const analise = JSON.parse(fs.readFileSync('./analise-fatura-ocr.json', 'utf8'));
    const text = analise.textoCompleto;
    
    console.log(`📄 Tamanho total do documento: ${text.length} caracteres`);
    console.log(`📄 Tamanho enviado para IA: ${text.length > 15000 ? '15000' : text.length} caracteres`);
    
    // Contar transações por cartão manualmente
    const transactionPatterns = [
      // Cartão 9766
      /Cartão n\.º 460342\*{6}9766[\s\S]*?(?=Cartão n\.º|Total do Cartão|$)/gi,
      // Cartão 8752  
      /Cartão n\.º 460342\*{6}8752[\s\S]*?(?=Cartão n\.º|Total do Cartão|$)/gi
    ];
    
    let totalTransactions = 0;
    
    transactionPatterns.forEach((pattern, index) => {
      const cardNumber = index === 0 ? '9766' : '8752';
      const matches = [...text.matchAll(pattern)];
      
      if (matches.length > 0) {
        const cardSection = matches[0][0];
        console.log(`\n💳 CARTÃO ${cardNumber}:`);
        console.log(`Secção: ${cardSection.length} caracteres`);
        
        // Contar linhas que parecem transações (data + descrição + valor)
        const transactionLines = cardSection.split('\n').filter(line => {
          const trimmedLine = line.trim();
          // Formato: DD.MM.YYYY + descrição + valor
          return /^\d{2}\.\d{2}\.\d{4}/.test(trimmedLine) && 
                 !trimmedLine.includes('Cartão n.º') &&
                 !trimmedLine.includes('Sub-total') &&
                 !trimmedLine.includes('Total do Cartão');
        });
        
        console.log(`📈 Transações encontradas: ${transactionLines.length}`);
        totalTransactions += transactionLines.length;
        
        // Mostrar algumas transações de exemplo
        console.log('Exemplos:');
        transactionLines.slice(0, 3).forEach((line, i) => {
          console.log(`${i + 1}. ${line.trim().substring(0, 80)}...`);
        });
        
        if (transactionLines.length > 3) {
          console.log(`... e mais ${transactionLines.length - 3} transações`);
        }
      }
    });
    
    console.log(`\n🎯 TOTAL GERAL: ${totalTransactions} transações encontradas no documento`);
    
    // Verificar se há mais transações nas seções de MULTIBANCO
    const multibancoMatches = text.match(/Transações rede MULTIBANCO[\s\S]*?(?=Sub-total|$)/gi);
    if (multibancoMatches) {
      console.log(`\n💰 TRANSAÇÕES MULTIBANCO:`);
      multibancoMatches.forEach((section, index) => {
        const lines = section.split('\n').filter(line => {
          const trimmed = line.trim();
          return /^\d{2}\.\d{2}\.\d{4}/.test(trimmed) && 
                 !trimmed.includes('Sub-total');
        });
        console.log(`Secção ${index + 1}: ${lines.length} transações`);
        totalTransactions += lines.length;
      });
    }
    
    // Verificar seções de prestações
    const prestationSections = text.match(/Pagamento a prestações[\s\S]*?(?=Extrato de conta-cartão|$)/gi);
    if (prestationSections) {
      console.log(`\n📋 SEÇÕES DE PRESTAÇÕES:`);
      prestationSections.forEach((section, index) => {
        console.log(`Secção ${index + 1}: ${section.length} caracteres`);
        // Contar referências de prestações
        const prestRefs = [...section.matchAll(/Ref\.ª?:\s*(\d+)/gi)];
        console.log(`Referencias de prestações: ${prestRefs.length}`);
      });
    }
    
    console.log(`\n✅ ESTIMATIVA FINAL: ~${totalTransactions} transações no documento completo`);
    
    // Verificar se a estratégia de truncamento pode perder dados
    if (text.length > 15000) {
      const firstPart = text.substring(0, 10000);
      const lastPart = text.substring(text.length - 5000);
      const middlePart = text.substring(10000, text.length - 5000);
      
      console.log(`\n⚠️ DOCUMENTO GRANDE DETECTADO:`);
      console.log(`Primeira parte (enviada): ${firstPart.length} chars`);
      console.log(`Parte média (omitida): ${middlePart.length} chars`);
      console.log(`Última parte (enviada): ${lastPart.length} chars`);
      
      // Verificar se há transações na parte omitida
      const middleTransactions = middlePart.split('\n').filter(line => 
        /^\d{2}\.\d{2}\.\d{4}/.test(line.trim())
      ).length;
      
      if (middleTransactions > 0) {
        console.log(`🚨 ATENÇÃO: ${middleTransactions} transações podem estar sendo perdidas na parte omitida!`);
      } else {
        console.log(`✅ Parte omitida não contém transações importantes`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

contarTransacoes();
