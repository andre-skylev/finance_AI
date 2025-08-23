/**
 * Debug test to understand why the specific parser is failing
 */

const fs = require('fs')

console.log('🔍 DEBUGGING - Por que o parser específico falha?')
console.log('=' .repeat(60))

// Let's test the detection logic step by step
console.log('\n1️⃣ Verificando padrões de detecção...')

// Test some common receipt patterns
const testTexts = [
  // Continente variations
  'CONTINENTE MODELO\nRua das Compras\nDATA: 21/08/2025\nBANANA 1,25 €\nTOTAL 5,50 €',
  'continente hipermercados\nfatura simplificada\nproduto a 2,50\ntotal: 10,00',
  'MODELO CONTINENTE S.A.\nNIF: 123456789\nleite 0,89\ntotal 3,45',
  
  // Other stores
  'LIDL PORTUGAL\ndata 21/08/2025\ntomate 2,99\ntotal 15,30',
  'PINGO DOCE\nobrigado pela visita\npão 1,20\ntotal 8,75',
  'WORTEN\neletrodomésticos\ntelevisão 299,99\ntotal 299,99',
  
  // Non-store text (should not match)
  'NOVO BANCO\nCARTÃO DE CRÉDITO\nEXTRATO DE MOVIMENTOS\n01/12/2023 CONTINENTE -25,67'
]

// Test detection patterns manually
const STORE_PATTERNS_TEST = {
  CONTINENTE: [/continente/i, /modelo\s*continente/i],
  LIDL: [/lidl/i],
  PINGO_DOCE: [/pingo\s*doce/i],
  WORTEN: [/worten/i],
  NOVO_BANCO: [/novo\s*banco/i, /novobanco/i]
}

testTexts.forEach((text, index) => {
  console.log(`\nTeste ${index + 1}:`)
  console.log(`Texto: "${text.substring(0, 50)}..."`)
  
  let detected = 'NENHUM'
  for (const [name, patterns] of Object.entries(STORE_PATTERNS_TEST)) {
    for (const pattern of patterns) {
      if (pattern.test(text.toLowerCase())) {
        detected = name
        break
      }
    }
    if (detected !== 'NENHUM') break
  }
  
  console.log(`Detectado: ${detected}`)
})

console.log('\n2️⃣ Testando lógica de decisão banco vs loja...')

// Test the decision logic
function testDecisionLogic(text) {
  const hasBankKeywords = /novo\s*banco|cgd|millennium|cart[aã]o\s*de\s*cr[ée]dito|extrato/i.test(text)
  const hasStoreKeywords = /continente|lidl|pingo\s*doce|worten|total|€/i.test(text)
  
  console.log(`Palavras-chave de banco: ${hasBankKeywords}`)
  console.log(`Palavras-chave de loja: ${hasStoreKeywords}`)
  
  if (hasBankKeywords) {
    return 'Deveria detectar BANCO'
  } else if (hasStoreKeywords) {
    return 'Deveria detectar LOJA'
  } else {
    return 'Nenhum padrão detectado'
  }
}

console.log('\nTeste com extrato bancário (deve detectar banco):')
const bankText = 'NOVO BANCO\nCARTÃO DE CRÉDITO\nEXTRATO DE MOVIMENTOS\n01/12/2023 CONTINENTE -25,67'
console.log(testDecisionLogic(bankText))

console.log('\nTeste com recibo de loja (deve detectar loja):')
const storeText = 'CONTINENTE MODELO\nDATA: 21/08/2025\nBANANA 1,25 €\nTOTAL 5,50 €'
console.log(testDecisionLogic(storeText))

console.log('\n3️⃣ Possíveis problemas identificados...')

console.log('\n❓ POSSÍVEIS CAUSAS DO PROBLEMA:')
console.log('1. O texto OCR extraído pode estar diferente do esperado')
console.log('2. Os padrões podem não estar cobrindo todas as variações')
console.log('3. Pode haver erro na lógica de detecção')
console.log('4. Problemas de encoding ou caracteres especiais')

console.log('\n🔧 SOLUÇÕES PARA TESTAR:')
console.log('1. Adicionar logs detalhados do texto OCR extraído')
console.log('2. Tornar os padrões mais flexíveis')
console.log('3. Adicionar fallback para texto parcialmente reconhecido')
console.log('4. Melhorar normalização de texto')

console.log('\n📝 PRÓXIMO PASSO:')
console.log('Vou adicionar logs mais detalhados para ver exatamente')
console.log('que texto o Document AI está extraindo do seu documento.')
console.log('Isso nos permitirá ajustar os padrões adequadamente.')
