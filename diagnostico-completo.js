#!/usr/bin/env node

// Diagnóstico completo do Google Cloud Document AI
require('dotenv').config({ path: '.env.local' });

async function diagnosticar() {
  console.log('🔍 Diagnóstico completo do Google Cloud Document AI\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
    
    console.log(`📋 Configuração atual:`);
    console.log(`   Projeto: ${projectId}`);
    console.log(`   Processador: ${processorId}`);
    console.log(`   Localização: ${location}\n`);
    
    const client = new DocumentProcessorServiceClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Testar diferentes regiões
    const regioes = ['us', 'eu', 'asia-northeast1'];
    
    for (const regiao of regioes) {
      try {
        console.log(`🌍 Testando região: ${regiao}`);
        
        const [processadores] = await client.listProcessors({
          parent: `projects/${projectId}/locations/${regiao}`,
        });

        console.log(`   ✅ Região ${regiao}: ${processadores.length} processador(es) encontrado(s)`);
        
        if (processadores.length > 0) {
          processadores.forEach(proc => {
            const id = proc.name.split('/').pop();
            console.log(`      📄 ID: ${id}`);
            console.log(`          Nome: ${proc.displayName}`);
            console.log(`          Tipo: ${proc.type}`);
            console.log(`          Estado: ${proc.state}`);
            console.log(`          Caminho completo: ${proc.name}\n`);
            
            // Verificar se é o processador que estamos procurando
            if (id === processorId) {
              console.log(`      🎯 ENCONTRADO! Este é o processador configurado no .env.local`);
              console.log(`      🔧 Para usar este processador, configure:`);
              console.log(`          GOOGLE_CLOUD_LOCATION=${regiao}\n`);
            }
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Região ${regiao}: ${error.message}`);
      }
    }
    
    // Teste específico com o processador atual
    console.log('\n🧪 Teste específico com configuração atual...');
    try {
      const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
      
      // Criar um PDF mínimo para teste
      const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n196\n%%EOF');
      
      const request = {
        name: processorName,
        rawDocument: {
          content: testPdf.toString('base64'),
          mimeType: 'application/pdf',
        },
      };

      const [response] = await client.processDocument(request);
      
      console.log('✅ SUCESSO! Processador funcionando perfeitamente!');
      console.log('🎉 Google Cloud Document AI configurado corretamente!\n');
      
    } catch (error) {
      console.log(`❌ Erro no teste: ${error.message}\n`);
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

diagnosticar();
