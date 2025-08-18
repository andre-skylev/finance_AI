#!/usr/bin/env node

// Teste completo do sistema melhorado de cartões dependentes
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

// Simular as funções melhoradas do sistema
const extractCreditCardsInfo = (text) => {
  const cards = [];
  
  console.log('🔍 Analisando cartões no texto...');
  console.log(`Texto total: ${text.length} caracteres`);
  
  // Buscar números de cartão únicos
  const cardNumberRegex = /(\d{4}\*{6,8}\d{4})/g;
  const cardNumbers = [...new Set([...text.matchAll(cardNumberRegex)].map(m => m[1]))];
  console.log(`📱 Números de cartão encontrados:`, cardNumbers);
  
  // Buscar possíveis portadores (nomes em maiúsculas)
  const nameRegex = /^([A-Z]{2,}(?:\s+[A-Z]{2,})+)$/gm;
  const possibleNames = [...text.matchAll(nameRegex)]
    .map(m => m[1].trim())
    .filter(name => 
      name.length > 5 && 
      !name.includes('BANCO') && 
      !name.includes('NOVO') &&
      !name.includes('AMAZON') &&
      !name.includes('WORTEN') &&
      !name.includes('RADIO') &&
      !name.includes('PEDRO') &&
      name.split(' ').length >= 2
    )
    .slice(0, 5);
    
  console.log(`👤 Possíveis portadores encontrados:`, possibleNames);
  
  // Buscar limite compartilhado
  const sharedLimitMatch = /Limite\s*de\s*Cr[ée]dito\s*da\s*Conta[^\d]*?([\d\.,]+)/i.exec(text);
  const sharedLimit = sharedLimitMatch ? parseFloat(sharedLimitMatch[1].replace(/\./g, '').replace(/,/, '.')) : undefined;
  console.log(`💰 Limite compartilhado:`, sharedLimit);
  
  // Buscar tabela específica de cartões
  const cardTableRegex = /N\.º cartão\s+Cartão\s+Nome([\s\S]*?)(?=\n\n|\nData|$)/i;
  const cardTableMatch = cardTableRegex.exec(text);
  
  if (cardTableMatch) {
    console.log(`📋 Tabela de cartões encontrada:`);
    const tableContent = cardTableMatch[1];
    
    // Padrão para extrair linhas da tabela: número + nome
    const cardLineRegex = /(\d{12}\*{6}\d{4})\s+[A-Z\s\d]+\s+([A-Z\s]+)(?=\n|$)/g;
    let cardLineMatch;
    
    while ((cardLineMatch = cardLineRegex.exec(tableContent)) !== null) {
      const cardNumber = cardLineMatch[1];
      const holderName = cardLineMatch[2].trim();
      
      console.log(`✅ Cartão detectado: ${cardNumber} - ${holderName}`);
      
      cards.push({
        bank: 'Novo Banco',
        cardNumber,
        cardHolder: holderName,
        isDependent: cards.length > 0, // Primeiro é titular, demais são dependentes
        sharedLimit
      });
    }
  }
  
  // Se não encontrou na tabela, usar método anterior
  if (cards.length === 0) {
    console.log(`⚠️ Tabela não encontrada, usando método de fallback...`);
    
    cardNumbers.forEach((cardNumber, index) => {
      const isDependent = index > 0;
      cards.push({
        bank: 'Novo Banco',
        cardNumber,
        cardHolder: possibleNames[index] || possibleNames[0] || 'Portador não identificado',
        isDependent,
        sharedLimit
      });
    });
  }
  
  return cards;
};

async function testarSistemaCompleto() {
  try {
    console.log('🧪 TESTE COMPLETO DO SISTEMA DE CARTÕES DEPENDENTES\n');
    
    // Ler a análise OCR salva anteriormente
    const analise = JSON.parse(fs.readFileSync('./analise-fatura-ocr.json', 'utf8'));
    const text = analise.textoCompleto;
    
    console.log('1️⃣ EXTRAÇÃO DE CARTÕES:');
    const creditCardsInfo = extractCreditCardsInfo(text);
    
    console.log('\n📊 RESULTADO FINAL - CARTÕES DETECTADOS:');
    creditCardsInfo.forEach((card, index) => {
      console.log(`Cartão ${index + 1}:`);
      console.log(`  Banco: ${card.bank}`);
      console.log(`  Número: ${card.cardNumber}`);
      console.log(`  Portador: ${card.cardHolder}`);
      console.log(`  É Dependente: ${card.isDependent ? 'Sim' : 'Não (Titular)'}`);
      console.log(`  Limite Compartilhado: €${card.sharedLimit?.toLocaleString() || 'N/A'}`);
      console.log('');
    });
    
    // Simular o payload que seria enviado para a API
    const payload = {
      credit_cards_info: creditCardsInfo,
      expected_cards: creditCardsInfo.length,
      titular_name: creditCardsInfo.find(c => !c.isDependent)?.cardHolder || 'N/A',
      dependent_names: creditCardsInfo.filter(c => c.isDependent).map(c => c.cardHolder)
    };
    
    console.log('2️⃣ PAYLOAD PARA API:');
    console.log(JSON.stringify(payload, null, 2));
    
    // Salvar resultado do teste
    fs.writeFileSync('./teste-sistema-completo.json', JSON.stringify({
      creditCardsInfo,
      payload,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log('\n✅ Teste completo! Resultado salvo em teste-sistema-completo.json');
    
    // Verificar se agora está corrigido
    const hasMultipleHolders = new Set(creditCardsInfo.map(c => c.cardHolder)).size > 1;
    const hasCorrectDependentFlag = creditCardsInfo.some(c => c.isDependent);
    
    console.log('\n🔍 VERIFICAÇÃO:');
    console.log(`✅ Múltiplos portadores detectados: ${hasMultipleHolders ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Cartões dependentes identificados: ${hasCorrectDependentFlag ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Total de cartões: ${creditCardsInfo.length}`);
    
    if (hasMultipleHolders && hasCorrectDependentFlag && creditCardsInfo.length > 1) {
      console.log('\n🎉 SUCESSO! O sistema agora detecta corretamente cartões dependentes com portadores diferentes!');
    } else {
      console.log('\n⚠️ Ainda há problemas na detecção. Verifique o resultado acima.');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testarSistemaCompleto();
