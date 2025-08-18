#!/usr/bin/env node

// Teste com diferentes formatos de região
require('dotenv').config({ path: '.env.local' });

async function testarRegioes() {
  console.log('🔍 Testando diferentes formatos de região...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    
    // Diferentes formatos de região para Europa
    const formatosRegiao = [
      'eu',                    // Formato simples
      'europe-west1',         // Bélgica
      'europe-west2',         // Londres
      'europe-west3',         // Frankfurt
      'europe-west4',         // Holanda
      'europe-west6',         // Zurique
      'europe-central2',      // Varsóvia
      'europe-north1',        // Finlândia
    ];
    
    console.log(`🎯 Processador: ${processorId}`);
    console.log(`📋 Projeto: ${projectId}\n`);
    
    const client = new DocumentProcessorServiceClient({
      projectId: projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // PDF de teste
    const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n196\n%%EOF');
    
    for (const regiao of formatosRegiao) {
      try {
        console.log(`🌍 Testando: ${regiao}`);
        
        const processorName = `projects/${projectId}/locations/${regiao}/processors/${processorId}`;
        console.log(`   Path: ${processorName}`);
        
        const request = {
          name: processorName,
          rawDocument: {
            content: testPdf.toString('base64'),
            mimeType: 'application/pdf',
          },
        };

        const [response] = await client.processDocument(request);
        
        console.log(`   ✅ SUCESSO! Região funcionando: ${regiao}`);
        console.log(`   📄 Páginas processadas: ${response.document.pages?.length || 0}`);
        console.log(`   🔧 Configure: GOOGLE_CLOUD_LOCATION=${regiao}\n`);
        
        // Parar no primeiro sucesso
        return regiao;
        
      } catch (error) {
        if (error.code === 5) { // NOT_FOUND
          console.log(`   ❌ Processador não encontrado em ${regiao}`);
        } else if (error.code === 3) { // INVALID_ARGUMENT
          console.log(`   ❌ Argumento inválido para ${regiao}`);
        } else if (error.code === 7) { // PERMISSION_DENIED
          console.log(`   ⚠️  Sem permissão em ${regiao}`);
        } else {
          console.log(`   ❌ Erro em ${regiao}: ${error.message}`);
        }
      }
    }
    
    console.log('\n❌ Processador não encontrado em nenhuma região europeia.');
    console.log('\n💡 O processador pode estar em:');
    console.log('1. Uma região não-europeia (us, asia, etc.)');
    console.log('2. Um projeto diferente');
    console.log('3. Pode não existir (precisa ser criado)');
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

testarRegioes();
