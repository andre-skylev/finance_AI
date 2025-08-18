#!/usr/bin/env node

// Script para analisar fatura usando Google Document AI
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function analisarFaturaComOCR() {
  console.log('📄 Analisando fatura com Google Document AI...\n');
  
  try {
    const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai');
    
    const buffer = fs.readFileSync('./teste-fatura.pdf');
    console.log(`PDF carregado: ${buffer.length} bytes`);
    
    // Configurar cliente igual ao sistema
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const resolvedCredentialsPath = credentialsPath?.startsWith('./') 
      ? path.resolve(process.cwd(), credentialsPath)
      : credentialsPath;
    
    const location = process.env.GOOGLE_CLOUD_REGION || process.env.GOOGLE_CLOUD_LOCATION || 'us';
    
    const clientOptions = {
      apiEndpoint: `${location}-documentai.googleapis.com`,
      keyFilename: resolvedCredentialsPath,
    };
    
    const client = new DocumentProcessorServiceClient(clientOptions);

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    console.log('Processando com Google Document AI...');

    const request = {
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    const [result] = await client.processDocument(request);
    const document = result.document;

    if (!document?.text) {
      throw new Error('Não foi possível extrair texto');
    }

    const text = document.text;
    console.log(`Texto extraído: ${text.length} caracteres\n`);
    
    // 1. Procurar por cartões dependentes/adicionais
    console.log('🔍 CARTÕES DEPENDENTES/ADICIONAIS:');
    
    // Buscar por múltiplos portadores/nomes
    const linhasComNomes = text.split('\n')
      .filter(linha => /^[A-Z]{2,}\s+[A-Z]{2,}/.test(linha.trim()))
      .slice(0, 10);
    
    console.log('Linhas com possíveis nomes:', linhasComNomes);
    
    // Buscar por múltiplos números de cartão
    const cardNumberRegex = /(\*{4,}\d{4}|\d{4}\s*\*{4,}\s*\d{4})/g;
    const cardNumbers = [...text.matchAll(cardNumberRegex)];
    console.log('Números de cartão encontrados:', cardNumbers.map(m => m[0]));
    
    // 2. Analisar estrutura de parcelamentos
    console.log('\n💳 ESTRUTURA DE PARCELAMENTOS:');
    
    // Buscar PREST. no topo
    const prestTopRegex = /PREST\.?\s*([^\n\r]*)/gi;
    const prestTopMatches = [...text.matchAll(prestTopRegex)];
    console.log('Referências PREST. no topo:', prestTopMatches.map(m => m[0].trim()));
    
    // Buscar todas as referências REF.ª
    const refRegex = /REF\.?[ºª]?\s*[:.]?\s*(\d{5,})/gi;
    const refMatches = [...text.matchAll(refRegex)];
    console.log('Todas as referências REF.ª:', refMatches.map(m => `${m[0]} -> ${m[1]}`));
    
    // Buscar blocos de prestações detalhados
    const prestDetailsRegex = /(Pag\.?\s*a\s*Presta[çc][õo]es[^]*?Ref\.?[ºª\.:]?\s*(\d{5,}))[^]*?(?=\n\s*Pag\.?\s*a\s*Presta|\n\s*[A-Z]{3,}|\n\s*$)/gi;
    const prestDetails = [...text.matchAll(prestDetailsRegex)];
    console.log('\nDetalhes de prestações encontrados:', prestDetails.length);
    
    prestDetails.forEach((match, index) => {
      console.log(`\n--- Prestação ${index + 1} ---`);
      console.log('Ref:', match[2]);
      const bloco = match[0];
      
      // Extrair informações específicas
      const merchantMatch = /Transa[çc][ãa]o:\s*([^\n\r]+)/i.exec(bloco);
      const instMatch = /N\.?[ºo]\s*Presta[çc][aã]o[:\s]*(\d{1,2})\s*\/\s*(\d{1,2})/i.exec(bloco);
      const valueMatch = /Valor[:\s]*([\d\.,]+)/i.exec(bloco);
      const dateMatch = /Data[^:]*:[^\d]*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i.exec(bloco);
      
      if (merchantMatch) console.log('Merchant:', merchantMatch[1].trim());
      if (instMatch) console.log(`Prestação: ${instMatch[1]}/${instMatch[2]}`);
      if (valueMatch) console.log('Valor:', valueMatch[1]);
      if (dateMatch) console.log('Data:', dateMatch[1]);
      
      console.log('Bloco (primeiros 200 chars):', bloco.substring(0, 200).replace(/\n/g, ' '));
    });
    
    // 3. Procurar por limite
    console.log('\n💰 INFORMAÇÕES DE LIMITE:');
    const limiteRegex = /(limite[^]*?€?\s*[\d\.,]+)/gi;
    const limiteMatches = [...text.matchAll(limiteRegex)];
    limiteMatches.forEach(match => {
      console.log('Limite encontrado:', match[0].replace(/\s+/g, ' ').trim());
    });
    
    // 4. Salvar análise completa
    const analise = {
      totalCaracteres: text.length,
      cartoes: {
        numeros: cardNumbers.map(m => m[0]),
        possiveisPortadores: linhasComNomes
      },
      parcelamentos: {
        prestTopo: prestTopMatches.map(m => m[0].trim()),
        referencias: refMatches.map(m => ({ texto: m[0], numero: m[1] })),
        detalhes: prestDetails.map(match => ({
          ref: match[2],
          bloco: match[0].substring(0, 500)
        }))
      },
      limites: limiteMatches.map(m => m[0].replace(/\s+/g, ' ').trim()),
      textoCompleto: text
    };
    
    fs.writeFileSync('./analise-fatura-ocr.json', JSON.stringify(analise, null, 2));
    console.log('\n✅ Análise OCR salva em analise-fatura-ocr.json');
    
  } catch (error) {
    console.error('❌ Erro na análise OCR:', error);
  }
}

analisarFaturaComOCR();
