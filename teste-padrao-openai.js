const fs = require('fs');
const FormData = require('form-data');
const { default: fetch } = require('node-fetch');

async function testDefaultOpenAI() {
    console.log('🧪 Testando se OpenAI está sendo usado por padrão...\n');
    
    try {
        const pdfPath = '/Users/andrecruz/CODES/finance_AI/teste-fatura.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ Arquivo teste-fatura.pdf não encontrado');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(pdfPath));
        formData.append('test', '1'); // Ativar modo de teste
        // NÃO vamos enviar useOpenAI=true para testar se está sendo usado por padrão
        
        console.log('📤 Enviando PDF sem especificar useOpenAI...');
        
        const response = await fetch('http://localhost:3000/api/pdf-upload', {
            method: 'POST',
            body: formData,
            headers: {
                ...formData.getHeaders(),
                'Authorization': 'Bearer test-token' // Token básico para passar a autenticação
            }
        });
        
        console.log('📥 Status da resposta:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            
            console.log('✅ Resposta recebida!\n');
            
            // Verificar se OpenAI foi usado
            if (result.bankInfo && result.bankInfo.openAIUsed) {
                console.log('🎉 SUCCESS! OpenAI foi usado por padrão!');
                console.log(`   Método de parsing: ${result.bankInfo.parsingMethod}`);
                console.log(`   Banco/Loja detectada: ${result.bankInfo.bank}`);
                
                if (result.bankInfo.openAIResponse) {
                    const ai = result.bankInfo.openAIResponse;
                    console.log(`   Tipo de documento: ${ai.documentType}`);
                    console.log(`   Estabelecimento: ${ai.establishment?.name}`);
                    console.log(`   Total: €${ai.totalAmount}`);
                    console.log(`   Confiança: ${ai.metadata?.confidence}`);
                }
                
                if (result.transactions && result.transactions.length > 0) {
                    console.log(`\n💰 ${result.transactions.length} transações extraídas`);
                } else if (result.receipts && result.receipts.length > 0) {
                    console.log(`\n🧾 ${result.receipts.length} recibos extraídos`);
                }
                
            } else {
                console.log('❌ OpenAI NÃO foi usado. Sistema ainda usando regex.');
                console.log(`   Método usado: ${result.bankInfo?.parsingMethod || 'Desconhecido'}`);
            }
            
        } else {
            const error = await response.json();
            console.error('❌ Erro na resposta:', error);
        }
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
    }
}

testDefaultOpenAI();
