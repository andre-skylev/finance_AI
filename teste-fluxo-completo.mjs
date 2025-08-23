import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { config } from 'dotenv';
import fs from 'fs';
import OpenAI from 'openai';

// Carregar variáveis de ambiente
config({ path: '.env.local' });

async function testCompleteFlow() {
    console.log('🧪 Testando fluxo completo: Document AI → OpenAI...\n');
    
    try {
        // 1. Extrair texto com Document AI
        console.log('📄 Extraindo texto com Document AI...');
        const ocrText = await extractTextWithDocumentAI();
        
        if (!ocrText) {
            console.log('❌ Falha ao extrair texto do Document AI');
            return;
        }
        
        console.log('✅ Texto extraído com sucesso!');
        console.log('📝 Primeiros 300 caracteres:', ocrText.substring(0, 300));
        console.log('📏 Tamanho total:', ocrText.length, 'caracteres\n');
        
        // 2. Processar com OpenAI
        console.log('🤖 Processando com OpenAI...');
        const aiResult = await processWithOpenAI(ocrText);
        
        if (!aiResult) {
            console.log('❌ Falha no processamento OpenAI');
            return;
        }
        
        // 3. Mostrar resultados
        displayResults(aiResult);
        
    } catch (error) {
        console.error('❌ Erro no teste completo:', error.message);
    }
}

async function extractTextWithDocumentAI() {
    try {
        // Configurar credenciais
        const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
        if (!credentialsBase64) {
            throw new Error('GOOGLE_CREDENTIALS_BASE64 não encontrado');
        }
        
        const credentials = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString());
        
        // Inicializar cliente
        const client = new DocumentProcessorServiceClient({
            credentials,
            apiEndpoint: 'eu-documentai.googleapis.com',
        });
        
        // Ler arquivo PDF
        const pdfPath = '/Users/andrecruz/CODES/finance_AI/teste-fatura.pdf';
        if (!fs.existsSync(pdfPath)) {
            throw new Error('Arquivo teste-fatura.pdf não encontrado');
        }
        
        const pdfBuffer = fs.readFileSync(pdfPath);
        
        // Processar documento
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const location = 'eu';
        const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
        
        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
        
        const request = {
            name,
            rawDocument: {
                content: pdfBuffer,
                mimeType: 'application/pdf',
            },
        };
        
        const [result] = await client.processDocument(request);
        return result.document?.text || '';
        
    } catch (error) {
        console.error('Erro no Document AI:', error.message);
        return null;
    }
}

async function processWithOpenAI(ocrText) {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `
Analisa este texto extraído via OCR de um documento financeiro português (fatura, recibo, extrato bancário ou cartão de crédito) e organiza a informação em JSON estruturado.

TEXTO OCR:
${ocrText}

Por favor, retorna APENAS um JSON válido com esta estrutura:

{
  "documentType": "receipt|invoice|bank_statement|credit_card",
  "establishment": {
    "name": "nome da loja/banco",
    "nif": "número se encontrado",
    "address": "morada se encontrado"
  },
  "date": "YYYY-MM-DD",
  "totalAmount": 0.00,
  "currency": "EUR",
  "items": [
    {
      "description": "nome do produto/transação",
      "quantity": 1,
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "category": "categoria sugerida"
    }
  ],
  "summary": {
    "itemCount": 0,
    "subtotal": 0.00,
    "tax": 0.00,
    "total": 0.00
  },
  "metadata": {
    "confidence": "high|medium|low",
    "notes": "observações sobre a qualidade do OCR ou parsing"
  }
}

INSTRUÇÕES:
- Se for fatura/recibo: extrai produtos, preços, quantidades
- Se for extrato bancário: extrai transações com datas, descrições, valores
- Se for cartão de crédito: extrai movimentos do cartão
- Valores em formato português (vírgula decimal): 12,50 = 12.50
- Categorias sugeridas: Alimentação, Transporte, Saúde, Vestuário, etc.
- Se não conseguires identificar algo, usa null ou ""
- Confidence "high" se texto claro, "medium" se alguma incerteza, "low" se muito fragmentado

Retorna APENAS o JSON, sem explicações.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "És um especialista em análise de documentos financeiros portugueses. Respondes sempre com JSON válido."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.1,
            max_tokens: 2000
        });

        const aiResponse = response.choices[0]?.message?.content?.trim();
        
        if (!aiResponse) {
            throw new Error('Resposta vazia da OpenAI');
        }
        
        // Limpar markdown se presente
        let cleanedResponse = aiResponse;
        if (aiResponse.startsWith('```json')) {
            cleanedResponse = aiResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
        } else if (aiResponse.startsWith('```')) {
            cleanedResponse = aiResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
        }
        
        return JSON.parse(cleanedResponse);
        
    } catch (error) {
        console.error('Erro no OpenAI:', error.message);
        return null;
    }
}

function displayResults(result) {
    console.log('✅ Resultados do OpenAI:\n');
    
    console.log('📋 INFORMAÇÕES BÁSICAS:');
    console.log(`   Tipo de documento: ${result.documentType}`);
    console.log(`   Estabelecimento: ${result.establishment?.name || 'N/A'}`);
    console.log(`   Data: ${result.date || 'N/A'}`);
    console.log(`   Total: €${result.totalAmount || 0}`);
    console.log(`   Confiança: ${result.metadata?.confidence || 'N/A'}`);
    
    if (result.establishment?.nif) {
        console.log(`   NIF: ${result.establishment.nif}`);
    }
    
    if (result.establishment?.address) {
        console.log(`   Morada: ${result.establishment.address}`);
    }
    
    if (result.items && result.items.length > 0) {
        console.log(`\n🛒 ITEMS/TRANSAÇÕES (${result.items.length}):`);
        result.items.forEach((item, i) => {
            console.log(`   ${i + 1}. ${item.description}`);
            console.log(`      Quantidade: ${item.quantity || 1}`);
            console.log(`      Preço unitário: €${item.unitPrice || 0}`);
            console.log(`      Total: €${item.totalPrice || 0}`);
            if (item.category) {
                console.log(`      Categoria: ${item.category}`);
            }
            console.log('');
        });
    }
    
    if (result.summary) {
        console.log('📊 RESUMO:');
        console.log(`   Número de items: ${result.summary.itemCount || 0}`);
        console.log(`   Subtotal: €${result.summary.subtotal || 0}`);
        console.log(`   IVA/Taxa: €${result.summary.tax || 0}`);
        console.log(`   Total: €${result.summary.total || 0}`);
    }
    
    if (result.metadata?.notes) {
        console.log(`\n📝 Notas: ${result.metadata.notes}`);
    }
}

// Executar teste
testCompleteFlow();
