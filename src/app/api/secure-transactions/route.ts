import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import FinancialSecurityService from '@/lib/financial-security'

// Exemplo de API endpoint seguro para transações
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Autenticação
    const authHeader = request.headers.get('authorization')
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '') || ''
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verificar atividade suspeita
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    
    const suspiciousCheck = FinancialSecurityService.detectSuspiciousActivity({
      userId: user.id,
      ip: clientIP,
      userAgent: request.headers.get('user-agent') || '',
      operation: 'view_transactions',
      timestamp: new Date()
    })

    if (suspiciousCheck.isSuspicious) {
      // Log da atividade suspeita
      await supabase.from('audit_log').insert({
        user_id: user.id,
        table_name: 'transactions',
        operation: 'SUSPICIOUS_ACCESS',
        ip_address: clientIP,
        user_agent: request.headers.get('user-agent'),
        sensitive_operation: true,
        additional_data: { reasons: suspiciousCheck.reasons }
      })

      return NextResponse.json({ 
        error: 'Access temporarily restricted',
        reasons: suspiciousCheck.reasons 
      }, { status: 403 })
    }

    // 3. Rate limiting
    const rateLimitOk = FinancialSecurityService.checkRateLimit(user.id, 'view_transactions')
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // 4. Buscar configurações de segurança do usuário
    const { data: securitySettings } = await supabase
      .from('user_security_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 5. Buscar transações com base no nível de segurança
    let transactions
    if (securitySettings?.encryption_enabled) {
      // Buscar dados criptografados
      const { data: encryptedTransactions } = await supabase
  .from('bank_account_transactions')
        .select(`
          id,
          amount_encrypted,
          amount_hash,
          currency,
          description,
          transaction_date,
          transaction_type,
          sensitive_data_encrypted,
          categories(name, color),
          accounts(name, bank_name)
        `)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(50)

      // Descriptografar valores para o usuário autenticado
      const userKey = FinancialSecurityService.deriveUserKey(user.id, user.email)
      
      transactions = encryptedTransactions?.map(tx => ({
        ...tx,
        amount: tx.sensitive_data_encrypted && tx.amount_encrypted
          ? FinancialSecurityService.decryptFinancialValue(tx.amount_encrypted, userKey)
          : (Number((tx as any).amount) || 0),
        is_encrypted: tx.sensitive_data_encrypted
      }))
    } else {
      // Buscar dados não criptografados
      const { data: plainTransactions } = await supabase
  .from('bank_account_transactions')
        .select(`
          id,
          amount,
          currency,
          description,
          transaction_date,
          transaction_type,
          categories(name, color),
          accounts(name, bank_name)
        `)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(50)

      transactions = plainTransactions?.map(tx => ({
        ...tx,
        is_encrypted: false
      }))
    }

    // 6. Aplicar mascaramento se necessário
    const maskedTransactions = transactions?.map(tx => ({
      ...tx,
      amount_display: securitySettings?.data_masking_enabled 
        ? FinancialSecurityService.maskFinancialValue(tx.amount, true)
        : Number(tx.amount).toFixed(2),
      account_display: Array.isArray(tx.accounts) && tx.accounts[0]?.name 
        ? FinancialSecurityService.maskAccountNumber(tx.accounts[0].name)
        : null
    }))

    // 7. Log da operação
    await supabase.from('audit_log').insert({
      user_id: user.id,
      table_name: 'transactions',
      operation: 'SELECT',
      ip_address: clientIP,
      user_agent: request.headers.get('user-agent'),
      sensitive_operation: true,
      additional_data: { 
        records_accessed: maskedTransactions?.length || 0,
        encryption_enabled: securitySettings?.encryption_enabled
      }
    })

    // 8. Sanitizar dados para resposta
    const sanitizedResponse = {
      transactions: maskedTransactions,
      security_info: {
        encryption_enabled: securitySettings?.encryption_enabled || false,
        masking_enabled: securitySettings?.data_masking_enabled || true,
        security_level: securitySettings?.security_level || 1
      },
      meta: {
        total_records: maskedTransactions?.length || 0,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(sanitizedResponse)

  } catch (error) {
    console.error('Secure transactions API error:', 
      FinancialSecurityService.sanitizeForLogs(error)
    )
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// API para ativar criptografia de dados existentes
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const authHeader = request.headers.get('authorization')
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '') || ''
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, user_password } = await request.json()
  const clientIP = request.headers.get('x-forwarded-for') || 
           request.headers.get('x-real-ip') || 
           'unknown'

    if (action === 'enable_encryption') {
      // Validar força da senha
      const passwordValidation = FinancialSecurityService.validatePasswordStrength(user_password)
      if (!passwordValidation.isValid) {
        return NextResponse.json({
          error: 'Password too weak',
          requirements: passwordValidation.requirements
        }, { status: 400 })
      }

      // Derivar chave do usuário
      const userKey = FinancialSecurityService.deriveUserKey(user.id, user_password)

      // Migrar dados para formato criptografado
      const { data: migrationResult, error: migrationError } = await supabase
        .rpc('migrate_to_encrypted_storage', {
          p_user_id: user.id,
          p_user_key: userKey.toString('hex')
        })

      if (migrationError) {
        console.error('Migration error:', migrationError)
        return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
      }

      // Log da ativação de criptografia
      await supabase.from('audit_log').insert({
        user_id: user.id,
        table_name: 'user_security_settings',
        operation: 'ENABLE_ENCRYPTION',
        ip_address: clientIP,
        user_agent: request.headers.get('user-agent'),
        sensitive_operation: true,
        additional_data: { migration_result: migrationResult }
      })

      return NextResponse.json({
        success: true,
        message: 'Encryption enabled successfully',
        migration_result: migrationResult
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Security settings error:', 
      FinancialSecurityService.sanitizeForLogs(error)
    )
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
