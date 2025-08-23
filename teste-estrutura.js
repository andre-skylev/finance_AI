// Teste para diagnosticar estrutura OpenAI
console.log('🔍 Teste para diagnosticar estrutura do retorno OpenAI...')

// Simular estrutura que esperamos vs que recebemos
const expectedStructure = {
  documentType: "receipt",
  establishment: { name: "VIA Original" },
  totalAmount: 313.3,
  items: [
    { description: "SALSICHA", totalPrice: 2.77 },
    { description: "CAFE", totalPrice: 2.26 }
  ]
}

console.log('✅ Estrutura esperada:')
console.log('  - items exists:', expectedStructure.items ? 'YES' : 'NO')
console.log('  - items length:', expectedStructure.items ? expectedStructure.items.length : 'N/A')
console.log('  - items > 0:', expectedStructure.items && expectedStructure.items.length > 0 ? 'YES' : 'NO')

// Testar condição
const condition = expectedStructure && expectedStructure.items && expectedStructure.items.length > 0
console.log('🎯 Condição final:', condition)
