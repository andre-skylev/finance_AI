const { createClient } = require('@supabase/supabase-js')

async function debugFixedCostsError() {
  console.log('🔍 Debugando erro da tabela fixed_costs...')

  try {
    // Carregar variáveis de ambiente
    require('dotenv').config({ path: '.env.local' })
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Variáveis de ambiente não encontradas')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Verificar estrutura da tabela fixed_costs
    console.log('\n📋 1. Verificando estrutura da tabela fixed_costs...')
    
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('exec_sql', { 
        sql_query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'fixed_costs' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      })

    if (tableError) {
      console.log('❌ Erro ao verificar tabela:', tableError.message)
    } else {
      console.log('✅ Estrutura da tabela fixed_costs:')
      console.table(tableInfo)
    }

    // 2. Tentar buscar dados da fixed_costs diretamente
    console.log('\n📊 2. Tentando buscar dados da fixed_costs...')
    
    const { data: fixedCosts, error: queryError } = await supabase
      .from('fixed_costs')
      .select('*')
      .limit(1)

    if (queryError) {
      console.log('❌ Erro na query:', queryError)
    } else {
      console.log('✅ Query funcionou! Registros encontrados:', fixedCosts?.length || 0)
      if (fixedCosts && fixedCosts.length > 0) {
        console.log('📄 Exemplo de registro:', fixedCosts[0])
      }
    }

    // 3. Verificar se o problema é especificamente com a coluna 'type'
    console.log('\n🔍 3. Verificando problema específico com coluna "type"...')
    
    const { data: withType, error: typeError } = await supabase
      .from('fixed_costs')
      .select('id, name, type')
      .limit(1)

    if (typeError) {
      console.log('❌ Erro com coluna "type":', typeError.message)
      
      // Verificar se existe coluna 'cost_type' ao invés de 'type'
      const { data: withCostType, error: costTypeError } = await supabase
        .from('fixed_costs')
        .select('id, name, cost_type')
        .limit(1)

      if (costTypeError) {
        console.log('❌ Erro com coluna "cost_type":', costTypeError.message)
      } else {
        console.log('✅ Coluna "cost_type" existe e funciona!')
        console.log('💡 O problema é que você está tentando usar "type" mas a coluna é "cost_type"')
      }
    } else {
      console.log('✅ Coluna "type" funciona normalmente')
    }

    // 4. Verificar se migration 014 foi aplicada
    console.log('\n📦 4. Verificando se migration 014 foi aplicada...')
    
    const { data: migrations, error: migError } = await supabase
      .from('schema_migrations')
      .select('version')
      .order('version')

    if (migError) {
      console.log('⚠️ Não foi possível verificar migrações:', migError.message)
    } else {
      console.log('📋 Migrações aplicadas:')
      migrations?.forEach(m => console.log(`  - ${m.version}`))
      
      const has014 = migrations?.some(m => m.version.includes('014'))
      if (has014) {
        console.log('✅ Migration 014 foi aplicada')
      } else {
        console.log('❌ Migration 014 NÃO foi aplicada - isso explica o problema!')
      }
    }

    // 5. Sugerir solução
    console.log('\n💡 5. Sugestões de solução:')
    
    if (typeError?.message.includes('column "fixed_costs.type" does not exist')) {
      console.log('🔧 PROBLEMA IDENTIFICADO:')
      console.log('   - Você está tentando usar a coluna "type" que não existe')
      console.log('   - A coluna correta é "cost_type" (se migration 014 foi aplicada)')
      console.log('   - Ou não existe nenhuma coluna de tipo (se migration 014 não foi aplicada)')
      console.log('\n📋 SOLUÇÕES:')
      console.log('   1. Aplique a migration 014_fixed_costs_redesign.sql primeiro')
      console.log('   2. Ou corrija o código para não usar a coluna "type"')
      console.log('   3. Ou adicione a coluna "type" se necessário')
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message)
  }
}

// Executar debug
debugFixedCostsError()
