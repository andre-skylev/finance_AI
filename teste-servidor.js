// Teste simples para verificar se o servidor está funcionando
console.log('🧪 Testando se servidor está respondendo...')

const testUrl = 'http://localhost:3000/api/pdf-upload'

fetch(testUrl, { method: 'GET' })
  .then(response => {
    console.log('✅ Servidor respondendo, status:', response.status)
  })
  .catch(error => {
    console.log('❌ Servidor não está respondendo:', error.message)
  })
