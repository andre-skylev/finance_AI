#!/usr/bin/env node

// Teste da solução inteligente de cartões
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function testarSolucaoInteligente() {
  try {
    console.log('🧠 TESTE DA SOLUÇÃO INTELIGENTE DE CARTÕES\n');
    
    // Ler o texto da fatura
    const analise = JSON.parse(fs.readFileSync('./analise-fatura-ocr.json', 'utf8'));
    const text = analise.textoCompleto;
    
    // Simular o que a IA deveria ver
    const relevantSection = text.substring(0, Math.min(3000, text.length));
    const cardNumbers = ['0342******9766', '0342******8752'];
    
    console.log('📋 SECÇÃO RELEVANTE PARA IA:');
    console.log('=' + '='.repeat(50));
    console.log(relevantSection);
    console.log('=' + '='.repeat(50));
    
    console.log('\n🎯 NÚMEROS DE CARTÃO:', cardNumbers);
    
    // O que a IA deveria extrair:
    console.log('\n🤖 O QUE A IA DEVERIA IDENTIFICAR:');
    
    // Buscar manualmente na secção relevante
    const lines = relevantSection.split('\n');
    
    // Encontrar a linha com "N.º cartão" e as seguintes
    let foundTable = false;
    let cardTableStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('N.º cartão') && lines[i].includes('Nome')) {
        foundTable = true;
        cardTableStart = i;
        console.log(`✅ Tabela encontrada na linha ${i}: "${lines[i]}"`);
        break;
      }
    }
    
    if (foundTable) {
      console.log('\n📊 LINHAS DA TABELA:');
      for (let i = cardTableStart; i < Math.min(cardTableStart + 10, lines.length); i++) {
        const line = lines[i].trim();
        if (line.length > 0) {
          console.log(`${i}: "${line}"`);
          
          // Verificar se contém número de cartão
          for (const cardNum of cardNumbers) {
            if (line.includes(cardNum.replace(/\*/g, '').slice(-4))) {
              console.log(`   → Contém cartão: ${cardNum}`);
            }
          }
        }
      }
    }
    
    // Extrair nomes que aparecem próximos dos cartões
    console.log('\n👤 NOMES ENCONTRADOS NO DOCUMENTO:');
    const nameRegex = /\b([A-Z]{2,}(?:\s+[A-Z]{1,3})*(?:\s+[A-Z]{2,})+)\b/g;
    const names = [...text.matchAll(nameRegex)]
      .map(m => m[1].trim())
      .filter(name => {
        const words = name.split(/\s+/);
        return words.length >= 2 && 
               words.length <= 5 && 
               !name.includes('BANCO') &&
               !name.includes('NOVO') &&
               !name.includes('EXTRATO') &&
               !name.includes('CARTÃO') &&
               !name.includes('CAMPUS') &&
               !name.includes('AVENIDA') &&
               words.every(word => word.length >= 2);
      });
    
    const uniqueNames = [...new Set(names)];
    uniqueNames.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    console.log('\n🎯 MAPEAMENTO ESPERADO:');
    console.log('Cartão 9766 → ANDRE DA CRUZ DE SOUZA (titular)');
    console.log('Cartão 8752 → LUANA COSTA L CRUZ (dependente)');
    
    console.log('\n💡 PROMPT SUGERIDO PARA IA:');
    console.log(`
Analisa este extrato e correlaciona cada cartão ao seu portador:

Cartões: ${cardNumbers.join(', ')}

Texto relevante:
${relevantSection.substring(0, 1000)}...

Procura por uma tabela ou lista que mostre:
- Números de cartão (terminados em 9766 e 8752)
- Nomes dos portadores correspondentes

Responde apenas JSON:
[
  {"cardNumber": "0342******9766", "holderName": "NOME_EXATO"},
  {"cardNumber": "0342******8752", "holderName": "NOME_EXATO"}
]
`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testarSolucaoInteligente();
