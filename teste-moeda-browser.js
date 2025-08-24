/**
 * Script de Teste Rápido - Verificação de Moeda na Criação de Contas
 * Para ser executado no DevTools do navegador
 */

console.log('🧪 TESTE SISTEMA DE MOEDAS - Criação de Conta BRL');

// Função para testar criação de conta
async function testarCriacaoConta() {
  const dadosConta = {
    name: 'Conta Teste Real',
    bank_name: 'Banco do Brasil',
    account_type: 'checking',
    currency: 'BRL',
    balance: 1500
  };

  console.log('📤 Enviando dados para /api/accounts:');
  console.log(JSON.stringify(dadosConta, null, 2));

  try {
    const response = await fetch('/api/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dadosConta)
    });

    const resultado = await response.json();
    
    console.log('📥 Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(resultado, null, 2));

    if (resultado.account) {
      console.log('✅ Conta criada com sucesso!');
      console.log('🔍 Verificação da moeda:');
      console.log('  Moeda enviada:', dadosConta.currency);
      console.log('  Moeda salva:', resultado.account.currency);
      
      if (resultado.account.currency === 'BRL') {
        console.log('🎉 SUCESSO: Moeda BRL foi salva corretamente!');
      } else {
        console.log('❌ PROBLEMA: Moeda deveria ser BRL mas foi salva como:', resultado.account.currency);
      }
      
      // Testar formatação
      console.log('🎨 Teste de formatação:');
      const valor = resultado.account.balance;
      console.log(`  Valor salvo: ${valor}`);
      
      // Simular formatação EUR vs BRL
      const formatEUR = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(valor);
      const formatBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
      
      console.log(`  Formato EUR: ${formatEUR}`);
      console.log(`  Formato BRL: ${formatBRL}`);
      
      if (resultado.account.currency === 'BRL') {
        console.log(`  ✅ Deveria usar: ${formatBRL}`);
      } else {
        console.log(`  ⚠️  Usando: ${formatEUR}`);
      }
      
    } else {
      console.log('❌ Erro na criação:', resultado.error);
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
}

// Executar teste
testarCriacaoConta();

console.log('📋 Como usar este teste:');
console.log('1. Abra o DevTools (F12)');
console.log('2. Va para a aba Console');
console.log('3. Cole este código e pressione Enter');
console.log('4. Verifique se a moeda BRL é salva corretamente');
console.log('5. Depois acesse /accounts para ver se exibe corretamente');
