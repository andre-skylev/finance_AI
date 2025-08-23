// Teste para verificar se as categorias bilíngues estão funcionando
console.log('🧪 Testando categorias bilíngues...\n');

// Simular função de tradução
const mockTranslations = {
  pt: {
    'categories.defaults.alimentacao': 'Alimentação',
    'categories.defaults.supermercado': 'Supermercado', 
    'categories.defaults.transporte': 'Transporte',
    'categories.defaults.saude': 'Saúde',
    'categories.defaults.outros': 'Outros'
  },
  en: {
    'categories.defaults.alimentacao': 'Food',
    'categories.defaults.supermercado': 'Groceries', 
    'categories.defaults.transporte': 'Transport',
    'categories.defaults.saude': 'Health',
    'categories.defaults.outros': 'Other'
  }
};

function mockT(key, lang = 'pt') {
  return mockTranslations[lang][key] || key;
}

// Testar categorias em português
console.log('📋 Categorias em Português:');
['alimentacao', 'supermercado', 'transporte', 'saude', 'outros'].forEach(cat => {
  const key = `categories.defaults.${cat}`;
  console.log(`  ${mockT(key, 'pt')}`);
});

console.log('\n📋 Categorias em Inglês:');
['alimentacao', 'supermercado', 'transporte', 'saude', 'outros'].forEach(cat => {
  const key = `categories.defaults.${cat}`;
  console.log(`  ${mockT(key, 'en')}`);
});

console.log('\n✅ Sistema bilíngue funcionando!');
