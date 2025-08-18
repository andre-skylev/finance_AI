#!/usr/bin/env node

// Buscar o processador em todas as regiões possíveis
require('dotenv').config({ path: '.env.local' });

async function buscarProcessador() {
  console.log('🔍 Procurando processador em todas as regiões...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    
    console.log(`🎯 Procurando processador: ${processorId}`);
    console.log(`📋 No projeto: ${projectId}\n`);
    
    const client = new DocumentProcessorServiceClient({
      projectId: projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Lista de todas as regiões onde Document AI está disponível
    const regioes = [
      'us',           // Estados Unidos
      'eu',           // Europa
      'asia-northeast1', // Tóquio
      'us-central1',  // Iowa
      'us-east1',     // Carolina do Sul
      'us-west1',     // Oregon
      'us-west2',     // Los Angeles
      'europe-west1', // Bélgica
      'europe-west2', // Londres
      'europe-west3', // Frankfurt
      'asia-east1',   // Taiwan
      'asia-southeast1' // Singapura
    ];
    
    for (const regiao of regioes) {
      try {
        console.log(`🌍 Testando região: ${regiao}`);
        
        // Tentar acessar o processador diretamente
        const processorName = `projects/${projectId}/locations/${regiao}/processors/${processorId}`;
        
        // PDF mínimo para teste
        const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n196\n%%EOF');
        
        const request = {
          name: processorName,
          rawDocument: {
            content: testPdf.toString('base64'),
            mimeType: 'application/pdf',
          },
        };

        const [response] = await client.processDocument(request);
        
        // Se chegou aqui, encontrou o processador!
        console.log(`   🎉 ENCONTRADO! Processador existe na região: ${regiao}`);
        console.log(`   📄 Processou com sucesso: ${response.document.pages?.length || 0} página(s)`);
        console.log(`   🔧 Configure no .env.local: GOOGLE_CLOUD_LOCATION=${regiao}\n`);
        
        return regiao; // Retorna a região encontrada
        
      } catch (error) {
        if (error.code === 3) { // INVALID_ARGUMENT
          console.log(`   ❌ Não encontrado na região ${regiao}`);
        } else if (error.code === 7) { // PERMISSION_DENIED
          console.log(`   ⚠️  Sem permissão na região ${regiao} (mas pode existir)`);
        } else {
          console.log(`   ❌ Erro na região ${regiao}: ${error.message}`);
        }
      }
    }
    
    console.log('\n❌ Processador não encontrado em nenhuma região testada.');
    console.log('💡 Possibilidades:');
    console.log('1. ID do processador está incorreto');
    console.log('2. Processador foi deletado');
    console.log('3. Processador está em projeto diferente');
    console.log('4. Precisa criar um novo processador');
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

buscarProcessador();
