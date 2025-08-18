#!/usr/bin/env node

// Teste final para verificar se conseguimos listar processadores
require('dotenv').config({ path: '.env.local' });

async function verificarProcessadores() {
  console.log('🔍 Verificação final de processadores existentes...\n');
  
  try {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    console.log(`📋 Projeto: ${projectId}\n`);
    
    const client = new DocumentProcessorServiceClient({
      projectId: projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Regiões mais comuns para Document AI
    const regioes = ['us', 'eu', 'asia-northeast1', 'europe-west1', 'europe-west3'];
    
    let processadoresEncontrados = [];
    
    for (const regiao of regioes) {
      try {
        console.log(`🌍 Tentando listar processadores em: ${regiao}`);
        
        const [processadores] = await client.listProcessors({
          parent: `projects/${projectId}/locations/${regiao}`,
        });

        if (processadores.length > 0) {
          console.log(`   ✅ ${processadores.length} processador(es) encontrado(s):`);
          
          processadores.forEach(proc => {
            const id = proc.name.split('/').pop();
            console.log(`      📄 ID: ${id}`);
            console.log(`         Nome: ${proc.displayName}`);
            console.log(`         Tipo: ${proc.type}`);
            console.log(`         Estado: ${proc.state}`);
            console.log(`         Região: ${regiao}\n`);
            
            processadoresEncontrados.push({
              id,
              regiao,
              nome: proc.displayName,
              tipo: proc.type
            });
          });
        } else {
          console.log(`   ℹ️  Nenhum processador em ${regiao}`);
        }
        
      } catch (error) {
        if (error.code === 7) { // PERMISSION_DENIED
          console.log(`   ⚠️  Sem permissão para listar em ${regiao}`);
        } else {
          console.log(`   ❌ Erro em ${regiao}: ${error.message}`);
        }
      }
    }
    
    if (processadoresEncontrados.length > 0) {
      console.log('\n🎯 PROCESSADORES ENCONTRADOS:');
      console.log('==========================================');
      
      processadoresEncontrados.forEach(proc => {
        console.log(`ID: ${proc.id}`);
        console.log(`Região: ${proc.regiao}`);
        console.log(`Nome: ${proc.nome}`);
        console.log(`Tipo: ${proc.tipo}`);
        console.log('---');
      });
      
      console.log('\n🔧 Para usar um destes processadores, configure no .env.local:');
      console.log(`GOOGLE_DOCUMENT_AI_PROCESSOR_ID=${processadoresEncontrados[0].id}`);
      console.log(`GOOGLE_CLOUD_LOCATION=${processadoresEncontrados[0].regiao}`);
      
    } else {
      console.log('\n❌ NENHUM PROCESSADOR ENCONTRADO');
      console.log('💡 Você precisa criar um processador:');
      console.log('1. Vá para: https://console.cloud.google.com/ai/document-ai/processors');
      console.log('2. Certifique-se de estar no projeto: finance-app-469314');
      console.log('3. Clique em "Create Processor"');
      console.log('4. Selecione "Document OCR"');
      console.log('5. Escolha a região "europe-west1" (Frankfurt)');
      console.log('6. Copie o ID do processador criado');
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

verificarProcessadores();
