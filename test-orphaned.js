// Teste simples para verificar transações órfãs
fetch('http://localhost:3000/api/dashboard?type=recent-transactions&limit=10')
  .then(res => res.json())
  .then(data => {
    console.log('Recent transactions:', data.transactions?.length || 0)
    
    if (data.transactions) {
      const orphaned = data.transactions.filter(tx => !tx.account_name)
      if (orphaned.length > 0) {
        console.log('❌ Orphaned transactions found:', orphaned.length)
        console.log('Sample orphaned transaction:', orphaned[0])
      } else {
        console.log('✅ No orphaned transactions found')
      }
    }
  })
  .catch(err => console.error('Error:', err))
