const fs = require('fs');
const FormData = require('form-data');
const { default: fetch } = require('node-fetch');

async function testOpenAIParsing() {
    console.log('🧪 Testando parsing com OpenAI...\n');
    
    try {
        // Verificar se o arquivo existe
        const pdfPath = '/Users/andrecruz/CODES/finance_AI/teste-fatura.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ Arquivo teste-fatura.pdf não encontrado');
            return;
        }
        
        // Criar FormData
        const formData = new FormData();
        formData.append('file', fs.createReadStream(pdfPath));
        formData.append('useOpenAI', 'true'); // Forçar uso do OpenAI
        
        console.log('📤 Enviando PDF para análise com OpenAI...');
        
        // Fazer request
        const response = await fetch('http://localhost:3000/api/pdf-upload', {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('❌ Erro na resposta:', response.status, result);
            return;
        }
        
        console.log('✅ Resposta recebida!\n');
        
        // Mostrar informações do parsing
        if (result.bankInfo) {
            console.log('🏦 INFORMAÇÕES DO BANCO:');
            console.log(`   Banco: ${result.bankInfo.bank}`);
            console.log(`   Tipo: ${result.bankInfo.type}`);
            console.log(`   Parser usado: ${result.bankInfo.parsingMethod || 'Não especificado'}`);
            console.log(`   OpenAI usado: ${result.bankInfo.openAIUsed ? 'SIM' : 'NÃO'}`);
            if (result.bankInfo.confidence) {
                console.log(`   Confiança: ${result.bankInfo.confidence}`);
            }
            console.log('');
        }
        
        // Mostrar transações extraídas
        if (result.transactions && result.transactions.length > 0) {
            console.log(`💰 TRANSAÇÕES EXTRAÍDAS (${result.transactions.length}):`);
            result.transactions.slice(0, 10).forEach((t, i) => {
                console.log(`   ${i + 1}. ${t.description} - €${t.amount}`);
                if (t.date) console.log(`      Data: ${t.date}`);
                if (t.category) console.log(`      Categoria: ${t.category}`);
                console.log('');
            });
            
            if (result.transactions.length > 10) {
                console.log(`   ... e mais ${result.transactions.length - 10} transações`);
            }
        } else {
            console.log('❌ Nenhuma transação extraída');
        }
        
        // Mostrar recibos extraídos
        if (result.receipts && result.receipts.length > 0) {
            console.log(`🧾 RECIBOS EXTRAÍDOS (${result.receipts.length}):`);
            result.receipts.slice(0, 5).forEach((r, i) => {
                console.log(`   ${i + 1}. Loja: ${r.store || 'Não identificada'}`);
                console.log(`      Total: €${r.total}`);
                console.log(`      Data: ${r.date || 'Não identificada'}`);
                if (r.items && r.items.length > 0) {
                    console.log(`      Items (${r.items.length}):`);
                    r.items.slice(0, 3).forEach((item, j) => {
                        console.log(`        - ${item.description}: €${item.price}`);
                    });
                    if (r.items.length > 3) {
                        console.log(`        ... e mais ${r.items.length - 3} items`);
                    }
                }
                console.log('');
            });
        }
        
        // Mostrar informações de debug se disponível
        if (result.bankInfo && result.bankInfo.openAIResponse) {
            console.log('🤖 DETALHES OPENAI:');
            const openAIData = result.bankInfo.openAIResponse;
            if (openAIData.document_type) {
                console.log(`   Tipo de documento detectado: ${openAIData.document_type}`);
            }
            if (openAIData.confidence_score) {
                console.log(`   Score de confiança: ${openAIData.confidence_score}`);
            }
            if (openAIData.parsing_notes) {
                console.log(`   Notas: ${openAIData.parsing_notes}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Certifique-se de que o servidor está rodando com: npm run dev');
        }
    }
}

// Executar teste
testOpenAIParsing();
