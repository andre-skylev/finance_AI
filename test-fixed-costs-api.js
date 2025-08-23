// Teste rápido da API de custos fixos
const testFixedCostsAPI = async () => {
  try {
    console.log('🧪 Testando API de custos fixos...')
    
    // Teste do endpoint de dashboard com fixed-costs
    const response = await fetch('/api/dashboard?type=fixed-costs', {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    console.log('📡 Status da resposta:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Dados recebidos:', JSON.stringify(data, null, 2))
      
      if (data.dashboard) {
        console.log('📊 Dashboard summary:')
        console.log(`   - Total estimado: ${data.dashboard.totalEstimated}`)
        console.log(`   - Total real: ${data.dashboard.totalActual}`)
        console.log(`   - Pagos: ${data.dashboard.paidCount}`)
        console.log(`   - Pendentes: ${data.dashboard.pendingCount}`)
        console.log(`   - Atrasados: ${data.dashboard.overdueCount}`)
        console.log(`   - Por tipo:`, Object.keys(data.dashboard.byType))
      }
      
      if (data.costs && data.costs.length > 0) {
        console.log(`💰 ${data.costs.length} custos fixos encontrados`)
        data.costs.forEach(cost => {
          console.log(`   - ${cost.name}: €${cost.estimated} (${cost.status})`)
        })
      } else {
        console.log('ℹ️ Nenhum custo fixo encontrado (normal se não houver dados ainda)')
      }
    } else {
      const errorText = await response.text()
      console.error('❌ Erro na resposta:', errorText)
    }
  } catch (error) {
    console.error('❌ Erro ao testar API:', error)
  }
}

// Execute o teste se não estiver em produção
if (typeof window !== 'undefined') {
  testFixedCostsAPI()
} else {
  console.log('📝 Script de teste criado. Execute no navegador para testar a API.')
}
