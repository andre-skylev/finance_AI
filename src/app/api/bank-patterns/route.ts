import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Por enquanto, retornar bancos conhecidos estaticamente até implementar as tabelas
    const staticBankPatterns = [
      {
        institution_name: "Caixa Geral de Depósitos",
        country: "Portugal", 
        currency: "EUR",
        confidence_level: "high",
        usage_count: 10,
        date_formats: ["DD/MM/YYYY"],
        category_mappings: {}
      },
      {
        institution_name: "Millennium BCP",
        country: "Portugal",
        currency: "EUR", 
        confidence_level: "high",
        usage_count: 8,
        date_formats: ["DD/MM/YYYY"],
        category_mappings: {}
      },
      {
        institution_name: "Nubank",
        country: "Brasil",
        currency: "BRL",
        confidence_level: "high",
        usage_count: 12,
        date_formats: ["DD/MM/YYYY"],
        category_mappings: {}
      },
      {
        institution_name: "Itaú",
        country: "Brasil", 
        currency: "BRL",
        confidence_level: "high",
        usage_count: 9,
        date_formats: ["DD/MM/YYYY"],
        category_mappings: {}
      },
      {
        institution_name: "Santander",
        country: "Portugal",
        currency: "EUR",
        confidence_level: "medium",
        usage_count: 5,
        date_formats: ["DD/MM/YYYY"],
        category_mappings: {}
      }
    ];

    // Tentar buscar padrões do banco se as tabelas existirem
    try {
      const supabase = await createClient()
      const { data: bankPatterns } = await supabase
        .from('bank_patterns')
        .select('institution_name, country, currency, confidence_level, usage_count, date_formats, category_mappings')
        .gt('usage_count', 0)
        .order('usage_count', { ascending: false })

      if (bankPatterns && bankPatterns.length > 0) {
        // Combinar dados estáticos com dados do banco
        const combinedPatterns = [...staticBankPatterns, ...bankPatterns]
        const uniquePatterns = combinedPatterns.filter((pattern, index, self) => 
          index === self.findIndex(p => p.institution_name === pattern.institution_name)
        )
        
        const patternsByRegion = uniquePatterns.reduce((acc: any, pattern: any) => {
          const region = pattern.country || 'Unknown'
          if (!acc[region]) acc[region] = []
          acc[region].push(pattern)
          return acc
        }, {})

        return NextResponse.json({
          patterns: uniquePatterns,
          patternsByRegion,
          totalBanks: uniquePatterns.length
        })
      }
    } catch (dbError) {
      console.log('Tabelas de banco ainda não criadas, usando dados estáticos')
    }

    // Organizar padrões estáticos por país/região
    const patternsByRegion = staticBankPatterns.reduce((acc: any, pattern: any) => {
      const region = pattern.country || 'Unknown'
      if (!acc[region]) acc[region] = []
      acc[region].push(pattern)
      return acc
    }, {})

    return NextResponse.json({
      patterns: staticBankPatterns,
      patternsByRegion,
      totalBanks: staticBankPatterns.length
    })

  } catch (error) {
    console.error('Erro ao processar padrões de bancos:', error)
    return NextResponse.json({ patterns: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const {
      institutionName,
      country,
      currency,
      documentPatterns,
      confidence = 'medium'
    } = await request.json()

    if (!institutionName) {
      return NextResponse.json({ error: 'Nome da instituição é obrigatório' }, { status: 400 })
    }

    // Por enquanto, apenas log no console até implementar as tabelas
    console.log('Novo banco identificado:', {
      institutionName,
      country,
      currency,
      confidence,
      documentPatterns
    })

    // Tentar salvar no banco se as tabelas existirem
    try {
      const { data: existingPattern } = await supabase
        .from('bank_patterns')
        .select('id, usage_count')
        .ilike('institution_name', institutionName)
        .single()

      let patternId
      if (existingPattern) {
        // Atualizar padrão existente
        const { data, error: updateError } = await supabase
          .from('bank_patterns')
          .update({
            last_seen: new Date().toISOString(),
            usage_count: existingPattern.usage_count + 1,
            country: country || undefined,
            currency: currency || undefined,
            document_patterns: documentPatterns || undefined,
            confidence_level: existingPattern.usage_count > 5 ? 'high' : existingPattern.usage_count > 2 ? 'medium' : 'low'
          })
          .eq('id', existingPattern.id)
          .select('id')
          .single()

        if (updateError) throw updateError
        patternId = data.id
      } else {
        // Criar novo padrão
        const { data, error: insertError } = await supabase
          .from('bank_patterns')
          .insert({
            institution_name: institutionName,
            country,
            currency,
            document_patterns: documentPatterns,
            confidence_level: confidence,
            created_by: user.id,
            usage_count: 1
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        patternId = data.id
      }

      return NextResponse.json({
        success: true,
        patternId,
        message: 'Padrão de banco salvo com sucesso'
      })

    } catch (dbError) {
      console.log('Tabelas ainda não criadas, padrão salvo apenas em log')
      return NextResponse.json({
        success: true,
        patternId: 'temp-' + Date.now(),
        message: 'Padrão de banco registrado (modo desenvolvimento)'
      })
    }

  } catch (error) {
    console.error('Erro ao processar requisição:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
