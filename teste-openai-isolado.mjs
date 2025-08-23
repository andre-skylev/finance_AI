import OpenAI from 'openai';
import { config } from 'dotenv';

// Carregar variáveis de ambiente
config({ path: '.env.local' });

// Função de teste isolada do OpenAI
async function testOpenAIFunction() {
    console.log('🧪 Testando função OpenAI isoladamente...\n');
    
    // Simular texto OCR fragmentado típico
    const sampleOCRText = `CONTINENTE
Rua da Liberdade, 123
1000-000 Lisboa
NIF: 123456789

Data: 15/12/2024
Hora: 14:30

LEITE UHT
2,99
PÃES
0,89
BANANA KG
1,25
IVA 6%
0,31
Total: 5,44 €

Cartão MB
Terminal: 1234
Obrigado pela visita!`;

    try {
        // Testar a OpenAI diretamente
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Analisa este texto OCR de um documento financeiro português e extrai as informações em formato JSON estruturado.

TEXTO OCR:
${sampleOCRText}

Retorna APENAS um JSON válido com esta estrutura:
{
  "document_type": "receipt|invoice|bank_statement|credit_card",
  "confidence_score": 0.0-1.0,
  "transactions": [{
    "description": "string",
    "amount": number,
    "date": "YYYY-MM-DD",
    "category": "string"
  }],
  "receipts": [{
    "store": "string",
    "total": number,
    "date": "YYYY-MM-DD",
    "items": [{
      "description": "string",
      "price": number
    }]
  }],
  "parsing_notes": "string"
}`;

        console.log('📤 Enviando para OpenAI...');
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 2000,
        });

        const responseText = completion.choices[0].message.content.trim();
        console.log('📥 Resposta da OpenAI:');
        console.log(responseText);
        
        // Limpar markdown se presente
        let cleanedResponse = responseText;
        if (responseText.startsWith('```json')) {
            cleanedResponse = responseText.replace(/```json\n?/, '').replace(/\n?```$/, '');
        } else if (responseText.startsWith('```')) {
            cleanedResponse = responseText.replace(/```\n?/, '').replace(/\n?```$/, '');
        }
        
        // Tentar fazer parse do JSON
        try {
            const parsedResult = JSON.parse(cleanedResponse);
            console.log('\n✅ JSON válido! Dados extraídos:');
            console.log('📋 Tipo de documento:', parsedResult.document_type);
            console.log('🎯 Confiança:', parsedResult.confidence_score);
            
            if (parsedResult.receipts && parsedResult.receipts.length > 0) {
                console.log('\n🧾 RECIBOS:');
                parsedResult.receipts.forEach((receipt, i) => {
                    console.log(`   ${i + 1}. Loja: ${receipt.store}`);
                    console.log(`      Total: €${receipt.total}`);
                    console.log(`      Data: ${receipt.date}`);
                    if (receipt.items) {
                        console.log(`      Items (${receipt.items.length}):`);
                        receipt.items.forEach(item => {
                            console.log(`        - ${item.description}: €${item.price}`);
                        });
                    }
                });
            }
            
            if (parsedResult.transactions && parsedResult.transactions.length > 0) {
                console.log('\n💰 TRANSAÇÕES:');
                parsedResult.transactions.forEach((transaction, i) => {
                    console.log(`   ${i + 1}. ${transaction.description} - €${transaction.amount}`);
                });
            }
            
            if (parsedResult.parsing_notes) {
                console.log('\n📝 Notas:', parsedResult.parsing_notes);
            }
            
        } catch (jsonError) {
            console.error('❌ Erro ao fazer parse do JSON:', jsonError.message);
            console.log('🔍 Resposta recebida não é JSON válido');
        }
        
    } catch (error) {
        console.error('❌ Erro ao chamar OpenAI:', error.message);
        if (error.code === 'insufficient_quota') {
            console.log('💡 Quota da OpenAI esgotada. Verifique o saldo da conta.');
        } else if (error.code === 'invalid_api_key') {
            console.log('💡 Chave da API inválida. Verifique a configuração.');
        }
    }
}

// Executar teste
testOpenAIFunction();
