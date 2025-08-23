// Test script para verificar se as categorias estão sendo sugeridas corretamente

// Simular dados de transação que o OpenAI retornaria
const mockOpenAIResponse = {
  documentType: "bank_statement",
  establishment: {
    name: "Banco Millennium BCP"
  },
  date: "2024-08-23",
  totalAmount: 150.50,
  transactions: [
    {
      date: "2024-08-23",
      description: "CONTINENTE MADEIRA FUNCHAL",
      amount: -25.80,
      suggestedCategory: "Supermercado"
    },
    {
      date: "2024-08-22", 
      description: "GALP ENERGIA",
      amount: -45.00,
      suggestedCategory: "Transporte"
    },
    {
      date: "2024-08-21",
      description: "TRF SALARIO MENSAL",
      amount: 1200.00,
      suggestedCategory: "Salário"
    },
    {
      date: "2024-08-20",
      description: "McDONALD'S FUNCHAL",
      amount: -12.50,
      suggestedCategory: "Alimentação"
    }
  ]
};

// Categorias disponíveis (should match what's in the API)
const availableCategories = [
  "Alimentação", "Supermercado", "Transporte", "Habitação", "Serviços Públicos",
  "Saúde", "Educação", "Lazer", "Viagens", "Compras", "Assinaturas", "Impostos",
  "Taxas", "Seguros", "Pets", "Presentes", "Doações", "Investimentos", "Outros",
  "Salário", "Freelance", "Reembolsos", "Transferência"
];

// Verificar se todas as categorias sugeridas estão na lista
console.log('🧪 Testando categorias sugeridas...\n');

let allValid = true;

mockOpenAIResponse.transactions.forEach((transaction, index) => {
  const isValid = availableCategories.includes(transaction.suggestedCategory);
  const status = isValid ? '✅' : '❌';
  
  console.log(`${status} Transação ${index + 1}:`);
  console.log(`   Descrição: ${transaction.description}`);
  console.log(`   Categoria sugerida: ${transaction.suggestedCategory}`);
  console.log(`   Válida: ${isValid ? 'Sim' : 'Não'}\n`);
  
  if (!isValid) {
    allValid = false;
  }
});

console.log(`📊 Resultado final: ${allValid ? '✅ Todas as categorias são válidas!' : '❌ Algumas categorias são inválidas'}`);
console.log(`📋 Categorias disponíveis: ${availableCategories.join(', ')}`);
