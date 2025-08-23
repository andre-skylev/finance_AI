// Script para verificar categorias na base de dados
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkCategories() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  
  console.log('Verificando categorias na base de dados...')
  
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .limit(20)
  
  if (error) {
    console.error('Erro ao buscar categorias:', error)
  } else {
    console.log('Categorias encontradas:', categories?.length)
    categories?.forEach(cat => {
      console.log(`- ${cat.name} (ID: ${cat.id}, User: ${cat.user_id || 'default'}, Default: ${cat.is_default})`)
    })
  }
  
  // Verificar se existe a categoria "Supermercado"
  const { data: supermarket } = await supabase
    .from('categories')
    .select('*')
    .ilike('name', '%supermercado%')
    
  console.log('\nCategorias com "supermercado":', supermarket)
}

checkCategories()
