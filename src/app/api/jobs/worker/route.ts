import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import path from 'path'
import { getGoogleCredentials } from '@/lib/google-auth'

export const maxDuration = 60

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: parseInt(process.env.OPENAI_TIMEOUT_MS || '20000', 10),
})

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  // Pegar um job em fila
  const { data: job, error } = await supabase
    .from('document_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (error || !job) {
    return NextResponse.json({ processed: 0 })
  }
  // Marcar como processing
  await supabase.from('document_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id)

  try {
    const buffer = Buffer.from(job.file_base64, 'base64')

    // 1) Google OCR
    const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai')
    // Prefer base64 credentials; fallback to GOOGLE_APPLICATION_CREDENTIALS path; otherwise ADC
    let credentials: any | null = null
    try { credentials = getGoogleCredentials() } catch (_) { credentials = null }
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    const resolvedCredentialsPath = credentialsPath?.startsWith('./')
      ? path.resolve(process.cwd(), credentialsPath)
      : credentialsPath
    const location = process.env.GOOGLE_CLOUD_REGION || process.env.GOOGLE_CLOUD_LOCATION || 'us'
    const clientOptions: any = {
      apiEndpoint: `${location}-documentai.googleapis.com`,
    }
    if (credentials) {
      clientOptions.credentials = {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      }
    } else if (resolvedCredentialsPath) {
      clientOptions.keyFilename = resolvedCredentialsPath
    }
    const client = new DocumentProcessorServiceClient(clientOptions)
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID
    if (!projectId || !processorId) throw new Error('Credenciais do Google Cloud não configuradas')
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`
    const [result] = await client.processDocument({
      name,
      rawDocument: { content: buffer.toString('base64'), mimeType: 'application/pdf' },
      skipHumanReview: true,
    })
    const text = result.document?.text || ''
    if (!text) throw new Error('OCR vazio')

    // 2) Detectar se é fatura de cartão
    const isCreditCard = /Extrato de Conta-Cartão|Cartão de Crédito|PREST\./i.test(text)

    // 3) Reestruturar texto (mesmo método simplificado)
    const processLargeDocument = (t: string, credit: boolean): string => {
      if (t.length <= 12000) return t
      if (credit) {
        const sec: string[] = []
        const header = t.match(/^[\s\S]*?(?=Cartão n\.º|Detalhe dos movimentos)/i)
        if (header) sec.push(header[1] || header[0])
        const cards = [...t.matchAll(/Cartão n\.º [^\n]*[\s\S]*?(?=Cartão n\.º|Total do Cartão[\s\S]*?(?=Transações rede|$))/gi)]
        cards.forEach((m, i) => sec.push(`\n\n=== CARTÃO ${i + 1} ===\n${m[0]}`))
        const presta = t.match(/Pagamento a prestações[\s\S]*$/i)
        if (presta) sec.push(`\n\n=== PRESTAÇÕES ===\n${presta[0]}`)
        return sec.join('') || t
      }
      return t
    }
    const processedText = processLargeDocument(text, isCreditCard)

    // 4) Extração (chunked) – somente transações e tipo de documento
    let transactions: any[] = []
    if (isCreditCard) {
      const sections = processedText.match(/=== CARTÃO \d+ ===[\s\S]*?(?=(=== CARTÃO \d+ ===|=== PRESTAÇÕES ===|$))/g) || [processedText]
      const start = Date.now()
      const budgetMs = parseInt(process.env.OPENAI_TOTAL_BUDGET_MS || '45000', 10)
      for (let i = 0; i < sections.length; i++) {
        if (Date.now() - start > budgetMs) break
        try {
          const resp = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Retorne APENAS JSON válido: {"transactions": [...]} com datas YYYY-MM-DD, valores positivos para compras, REF.ª mantida na descrição se existir, prestações usam apenas o valor da prestação.' },
              { role: 'user', content: sections[i] }
            ],
            temperature: 0.1,
            max_tokens: 1800,
            response_format: { type: 'json_object' },
          })
          const content = resp.choices[0]?.message?.content?.trim() || '{}'
          const obj = JSON.parse(content)
          if (Array.isArray(obj.transactions)) transactions.push(...obj.transactions)
        } catch (_) {}
      }
    } else {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Retorne APENAS JSON válido: {"transactions": [...]} com datas YYYY-MM-DD, crédito/débito.' },
          { role: 'user', content: processedText }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      })
      const content = resp.choices[0]?.message?.content?.trim() || '{}'
      const obj = JSON.parse(content)
      if (Array.isArray(obj.transactions)) transactions = obj.transactions
    }

    const resultPayload = {
      document_type: isCreditCard ? 'credit_card_statement' : 'bank_statement',
      transactions,
      detected_bank: /novo\s*banco/i.test(text) ? 'Novo Banco' : undefined,
      is_credit_card: isCreditCard,
    }

    await supabase
      .from('document_jobs')
      .update({ status: 'completed', result: resultPayload, finished_at: new Date().toISOString() })
      .eq('id', job.id)

    return NextResponse.json({ processed: 1, job_id: job.id })
  } catch (e: any) {
    await supabase
      .from('document_jobs')
      .update({ status: 'failed', error: e.message || 'Erro', finished_at: new Date().toISOString() })
      .eq('id', job.id)
    return NextResponse.json({ processed: 0, job_id: job.id })
  }
}
