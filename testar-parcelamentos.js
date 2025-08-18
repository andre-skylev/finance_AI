#!/usr/bin/env node

// Teste direto da função de parcelamentos melhorada
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

// Simular as funções do sistema
const parsePTNumber = (s) => {
  if (!s) return undefined;
  const cleaned = s.replace(/\./g, '').replace(/,/, '.');
  const n = Number(cleaned);
  return isNaN(n) ? undefined : n;
};

// Função melhorada extraída do código
const extractInstallmentDetails = (text) => {
  const map = {};

  console.log('🔍 Analisando parcelamentos no texto completo...');
  console.log(`Texto total: ${text.length} caracteres`);

  // 1. Primeiro, encontrar todas as referências no topo
  const topRefRegex = /PREST\.\s*(\d{1,2})\s*-\s*PAG\.\s*A\s*PREST\.\s*REF\.?[ºª]?\s*(\d{5,})/gi;
  const topRefs = [...text.matchAll(topRefRegex)];
  console.log(`Encontradas ${topRefs.length} referências no topo:`, topRefs.map(r => `PREST.${r[1]} -> REF.${r[2]}`));
  
  // 2. Buscar informações de parcelamentos nos detalhes
  const detailPatterns = [
    // Padrão principal: "Prestações Ref.ª: XXXXX" seguido de informações
    /(Presta[çc][õo]es\s*Ref\.?[ºª\.:]?\s*(\d{5,}))[\s\S]*?(?=Presta[çc][õo]es\s*Ref|Novo\s*Banco|$)/gi,
    // Padrão alternativo: "Pag. a Prestações Ref.ª XXXXX"
    /(Pag\.\s*a\s*Presta[çc][õo]es\s*Ref\.?[ºª\.:]?\s*(\d{5,}))[\s\S]*?(?=Pag\.\s*a\s*Presta|Novo\s*Banco|$)/gi
  ];
  
  detailPatterns.forEach((pattern, patternIndex) => {
    let blockMatch;
    while ((blockMatch = pattern.exec(text)) !== null) {
      const ref = blockMatch[2];
      const block = blockMatch[0];
      
      console.log(`\n📋 Processando bloco ${patternIndex + 1} - REF: ${ref}`);
      console.log(`Bloco (primeiros 300 chars): ${block.substring(0, 300)}...`);
      
      const detail = { ref };

      // Buscar correlação com referência do topo
      const topRef = topRefs.find(tr => tr[2] === ref);
      if (topRef) {
        const prestNumber = parseInt(topRef[1], 10);
        detail.installmentNumber = prestNumber;
        console.log(`✅ Correlação encontrada: PREST.${prestNumber} -> REF.${ref}`);
      }

      // Buscar merchant
      const merchantPatterns = [
        /Transa[çc][ãa]o:\s*([^\n\r]+)/i,
        /Comerciante:\s*([^\n\r]+)/i,
        /Estabelecimento:\s*([^\n\r]+)/i
      ];
      
      for (const merchantPattern of merchantPatterns) {
        const match = merchantPattern.exec(block);
        if (match) {
          detail.merchant = match[1].trim();
          console.log(`🏪 Merchant: ${detail.merchant}`);
          break;
        }
      }

      // N.º Prestação: X/Y (MAIS IMPORTANTE)
      const installmentPatterns = [
        /N\.?[ºo]\s*Presta[çc][aã]o[\s\n\r]+(\d{1,2})\s*\/\s*(\d{1,2})/i,
        /N\.?[ºo]\s*Presta[çc][aã]o[:\s]*(\d{1,2})\s*\/\s*(\d{1,2})/i,
        /(\d{1,2})\s*\/\s*(\d{1,2})[\s\n\r]*(?:prestações?|parcelas?)/i,
        /(?:prestação|parcela)\s*(\d{1,2})\s*de\s*(\d{1,2})/i
      ];
      
      for (const instPattern of installmentPatterns) {
        const match = instPattern.exec(block);
        if (match) {
          let currentInst, totalInst;
          
          if (instPattern.source.includes('de')) {
            currentInst = parseInt(match[1], 10);
            totalInst = parseInt(match[2], 10);
          } else {
            currentInst = parseInt(match[1], 10);
            totalInst = parseInt(match[2], 10);
          }
          
          if (currentInst <= totalInst && totalInst >= 2 && totalInst <= 60) {
            if (!detail.installmentNumber) {
              detail.installmentNumber = currentInst;
            }
            detail.totalInstallments = totalInst;
            console.log(`💰 Parcelas: ${currentInst}/${totalInst}`);
            break;
          }
        }
      }

      // Se não encontrou o total, tentar deduzir
      if (!detail.totalInstallments && detail.installmentNumber) {
        const sameValueRefs = topRefs.filter(tr => tr[2] !== ref);
        if (sameValueRefs.length > 0) {
          const maxPrest = Math.max(...sameValueRefs.map(tr => parseInt(tr[1], 10)), detail.installmentNumber);
          if (maxPrest > detail.installmentNumber) {
            detail.totalInstallments = maxPrest;
            console.log(`🎯 Total deduzido: ${detail.totalInstallments} (baseado em outras refs)`);
          }
        }
      }

      map[ref] = detail;
      console.log(`✅ Processado REF ${ref}:`, detail);
    }
  });

  console.log(`\n📈 Resumo: ${Object.keys(map).length} parcelamentos processados`);
  return map;
};

async function testarParcelamentos() {
  try {
    // Ler a análise OCR salva anteriormente
    const analise = JSON.parse(fs.readFileSync('./analise-fatura-ocr.json', 'utf8'));
    const text = analise.textoCompleto;
    
    console.log('🧪 TESTE DA FUNÇÃO MELHORADA DE PARCELAMENTOS\n');
    
    const result = extractInstallmentDetails(text);
    
    console.log('\n📊 RESULTADO FINAL:');
    console.log(JSON.stringify(result, null, 2));
    
    // Salvar resultado do teste
    fs.writeFileSync('./teste-parcelamentos-resultado.json', JSON.stringify(result, null, 2));
    console.log('\n✅ Resultado salvo em teste-parcelamentos-resultado.json');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testarParcelamentos();
