#!/usr/bin/env node

// Script para analisar estrutura da fatura de cartão
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function analisarFatura() {
  console.log('📄 Analisando estrutura da fatura...\n');
  
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync('./teste-fatura.pdf');
    
    const pdfData = await pdfParse(buffer, {
      max: 0,
      pagerender: () => null,
      normalizeWhitespace: true,
      disableCombineTextItems: false
    });
    
    const text = pdfData.text;
    console.log(`Texto extraído: ${text.length} caracteres\n`);
    
    // 1. Procurar por cartões dependentes/adicionais
    console.log('🔍 CARTÕES DEPENDENTES/ADICIONAIS:');
    const dependentCardRegex = /(cartão\s+adicional|dependente|titular\s+adicional|portador\s+adicional)/gi;
    const dependentMatches = text.match(dependentCardRegex);
    if (dependentMatches) {
      console.log('Encontrado:', dependentMatches);
    } else {
      console.log('Não encontrado referências diretas, procurando por múltiplos cartões...\n');
    }
    
    // Procurar por múltiplos números de cartão
    const cardNumberRegex = /(\d{4}\s*\*{8,12}\s*\d{4}|\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/g;
    const cardNumbers = text.match(cardNumberRegex);
    if (cardNumbers) {
      console.log('Números de cartão encontrados:', cardNumbers);
    }
    
    // 2. Analisar estrutura de parcelamentos
    console.log('\n💳 ESTRUTURA DE PARCELAMENTOS:');
    
    // Buscar referências no topo (ex: PREST.)
    const topPrestRegex = /PREST\.?\s*([^\n]*)/gi;
    const topPrestMatches = [...text.matchAll(topPrestRegex)];
    console.log('Referências no topo:', topPrestMatches.map(m => m[0]));
    
    // Buscar detalhes no final (Pag. a Prestações)
    const prestDetailsRegex = /(Pag\.?\s*a\s*Presta[çc][õo]es.*?Ref\.?[ºª\.:]?\s*(\d{5,}))[\s\S]*?(?=\n\s*Pag\.?\s*a\s*Presta|\n\s*$)/gi;
    const prestDetails = [...text.matchAll(prestDetailsRegex)];
    console.log('\nDetalhes de prestações encontrados:', prestDetails.length);
    
    prestDetails.forEach((match, index) => {
      console.log(`\n--- Prestação ${index + 1} ---`);
      console.log('Ref:', match[2]);
      console.log('Bloco completo:\n', match[0].substring(0, 300) + '...');
      
      // Extrair merchant
      const merchantMatch = /Transa[çc][ãa]o:\s*([^\n]+)/i.exec(match[0]);
      if (merchantMatch) console.log('Merchant:', merchantMatch[1].trim());
      
      // Extrair N.º Prestação
      const instMatch = /N\.?[ºo]\s*Presta[çc][aã]o\s*\n\s*(\d{1,2})\s*\/\s*(\d{1,2})/i.exec(match[0]);
      if (instMatch) console.log(`Prestação: ${instMatch[1]}/${instMatch[2]}`);
      
      // Extrair valor
      const valueMatch = /Valor:\s*([\d\.,]+)/i.exec(match[0]);
      if (valueMatch) console.log('Valor:', valueMatch[1]);
    });
    
    // 3. Procurar por limite compartilhado
    console.log('\n💰 LIMITE COMPARTILHADO:');
    const limiteRegex = /(limite\s+disponível|limite\s+de\s+crédito|limite\s+compartilhado)/gi;
    const limiteMatches = [...text.matchAll(limiteRegex)];
    if (limiteMatches.length) {
      console.log('Referências de limite:', limiteMatches.map(m => m[0]));
    }
    
    // 4. Identificar todos os portadores
    console.log('\n👥 PORTADORES:');
    const nomeRegex = /([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})*)/g;
    const nomes = [...text.matchAll(nomeRegex)]
      .map(m => m[0])
      .filter(nome => nome.length > 5 && !nome.includes('BANCO') && !nome.includes('NOVO'))
      .slice(0, 5); // Primeiros 5 nomes mais prováveis
    
    console.log('Possíveis portadores:', nomes);
    
    // Salvar análise completa
    const analise = {
      totalCaracteres: text.length,
      cartoesDetectados: cardNumbers || [],
      prestacoes: {
        referenciasTopo: topPrestMatches.map(m => m[0]),
        detalhesFinais: prestDetails.map(match => ({
          ref: match[2],
          bloco: match[0]
        }))
      },
      possiveisPortadores: nomes,
      textoCompleto: text
    };
    
    fs.writeFileSync('./analise-fatura.json', JSON.stringify(analise, null, 2));
    console.log('\n✅ Análise salva em analise-fatura.json');
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

analisarFatura();
