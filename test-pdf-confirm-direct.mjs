// Teste direto do endpoint PDF confirm
import fetch from 'node-fetch';

async function testPDFConfirm() {
  const testData = {
    transactions: [
      {
        amount: -25.50,
        description: "PINGO DOCE TESTE",
        suggestedCategory: "Supermercado",
        date: "2025-08-23"
      }
    ],
    target: "acc:1", // Substitua pelo ID de uma conta real
    receipts: []
  };

  console.log('Enviando dados de teste:', JSON.stringify(testData, null, 2));

  try {
    const response = await fetch('http://localhost:3001/api/pdf-confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Você precisará adicionar o token de autenticação aqui
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Resposta:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Erro na requisição:', error);
  }
}

testPDFConfirm();
