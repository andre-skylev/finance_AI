const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  try {
    const form = new FormData();
    const fileBuffer = fs.readFileSync('teste-fatura.pdf');
    form.append('file', fileBuffer, 'teste-fatura.pdf');
    form.append('debug', 'true');
    
    const response = await fetch('http://localhost:3000/api/pdf-upload?test=1', {
      method: 'POST',
      body: form,
      headers: {
        'authorization': 'Bearer test-token',
        ...form.getHeaders()
      }
    });
    
    const result = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', result.substring(0, 1000));
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

testUpload();
