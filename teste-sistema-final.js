const fs = require('fs');
const FormData = require('form-data');
const { default: fetch } = require('node-fetch');

async function testCompleteSystem() {
    console.log('🧪 Testando sistema completo com OpenAI...\n');
    
    try {
        // Verificar se o arquivo existe
        const pdfPath = '/Users/andrecruz/CODES/finance_AI/teste-fatura.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ Arquivo teste-fatura.pdf não encontrado');
            return;
        }
        
        // Testar primeiro sem autenticação (para ver se é problema de auth)
        console.log('📤 Testando endpoint sem autenticação...');
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(pdfPath));
        formData.append('useOpenAI', 'true');
        formData.append('debug', 'true');
        
        const response = await fetch('http://localhost:3000/api/pdf-upload', {
            method: 'POST',
            body: formData,
            headers: {
                ...formData.getHeaders(),
                // Não incluir Authorization para testar
            }
        });
        
        console.log('📥 Status da resposta:', response.status);
        
        if (response.status === 401) {
            console.log('🔐 Endpoint requer autenticação. Tentando com um token básico...');
            
            // Tentar com token básico
            const formData2 = new FormData();
            formData2.append('file', fs.createReadStream(pdfPath));
            formData2.append('useOpenAI', 'true');
            formData2.append('debug', 'true');
            
            const response2 = await fetch('http://localhost:3000/api/pdf-upload', {
                method: 'POST',
                body: formData2,
                headers: {
                    ...formData2.getHeaders(),
                    'Authorization': 'Bearer test-token'
                }
            });
            
            console.log('📥 Status com token:', response2.status);
            
            if (response2.ok) {
                const result = await response2.json();
                displayResults(result);
            } else {
                const error = await response2.json();
                console.error('❌ Erro:', error);
            }
        } else if (response.ok) {
            const result = await response.json();
            displayResults(result);
        } else {
            const error = await response.json();
            console.error('❌ Erro:', error);
        }
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
    }
}

function displayResults(result) {
    console.log('✅ Resposta recebida com sucesso!\n');
    
    if (result.bankInfo) {
        console.log('🏦 INFORMAÇÕES DO PARSING:');
        console.log(`   Método usado: ${result.bankInfo.parsingMethod || 'Não especificado'}`);
        console.log(`   OpenAI usado: ${result.bankInfo.openAIUsed ? 'SIM' : 'NÃO'}`);
        console.log(`   Banco/Loja: ${result.bankInfo.bank || 'Não identificado'}`);
        console.log(`   Tipo: ${result.bankInfo.type || 'Não especificado'}`);
        
        if (result.bankInfo.openAIResponse) {
            console.log('\n🤖 DADOS OPENAI:');
            const ai = result.bankInfo.openAIResponse;
            console.log(`   Tipo de documento: ${ai.documentType || 'N/A'}`);
            console.log(`   Estabelecimento: ${ai.establishment?.name || 'N/A'}`);
            console.log(`   Total detectado: €${ai.totalAmount || 0}`);
            console.log(`   Confiança: ${ai.metadata?.confidence || 'N/A'}`);
            if (ai.metadata?.notes) {
                console.log(`   Notas: ${ai.metadata.notes}`);
            }
        }
        console.log('');
    }
    
    if (result.transactions && result.transactions.length > 0) {
        console.log(`💰 TRANSAÇÕES EXTRAÍDAS (${result.transactions.length}):`);
        result.transactions.slice(0, 10).forEach((t, i) => {
            console.log(`   ${i + 1}. ${t.description} - €${t.amount}`);
            if (t.date) console.log(`      Data: ${t.date}`);
        });
        if (result.transactions.length > 10) {
            console.log(`   ... e mais ${result.transactions.length - 10} transações`);
        }
        console.log('');
    }
    
    if (result.receipts && result.receipts.length > 0) {
        console.log(`🧾 RECIBOS EXTRAÍDOS (${result.receipts.length}):`);
        result.receipts.forEach((r, i) => {
            console.log(`   ${i + 1}. Loja: ${r.store || 'Não identificada'}`);
            console.log(`      Total: €${r.total}`);
            console.log(`      Data: ${r.date || 'Não identificada'}`);
            if (r.items && r.items.length > 0) {
                console.log(`      Items (${r.items.length}):`);
                r.items.slice(0, 5).forEach(item => {
                    console.log(`        - ${item.description}: €${item.price}`);
                });
                if (r.items.length > 5) {
                    console.log(`        ... e mais ${r.items.length - 5} items`);
                }
            }
            console.log('');
        });
    }
    
    if (!result.transactions?.length && !result.receipts?.length) {
        console.log('⚠️ Nenhuma transação ou recibo foi extraído');
    }
}

testCompleteSystem();
