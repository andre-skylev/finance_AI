import { createClient } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    const supabase = await createClient()

    const { 
      data: { session }, 
    } = await supabase.auth.getSession()
    const user = session?.user

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's financial data to build the context
    const [transactionsRes, goalsRes, accountsRes] = await Promise.all([
      supabase.from('transactions').select('description, amount, currency, type, transaction_date').eq('user_id', user.id).limit(50),
      supabase.from('goals').select('name, target_amount, current_amount, currency').eq('user_id', user.id),
      supabase.from('accounts').select('name, bank_name, balance, currency').eq('user_id', user.id),
    ])

    const financialContext = `
      Here is the user's financial data:

      Transactions (last 50):
      ${transactionsRes.data?.map((t: any) => `- ${t.transaction_date}: ${t.description} (${t.type}): ${t.amount} ${t.currency}`).join('\n') || 'No transactions found.'}

      Financial Goals:
      ${goalsRes.data?.map((g: any) => `- ${g.name}: ${g.current_amount}/${g.target_amount} ${g.currency}`).join('\n') || 'No goals set.'}

      Accounts:
      ${accountsRes.data?.map((a: any) => `- ${a.name} (${a.bank_name}): ${a.balance} ${a.currency}`).join('\n') || 'No accounts linked.'}
    `

    const systemPrompt = `
      You are a helpful and friendly financial assistant for a user of the FinanceAI app.
      Your name is Manus.
      You are an expert in personal finance, especially for users living in Portugal and Brazil.
      You should be professional, but also encouraging and empathetic.
      You have access to the user's financial data, which will be provided below.
      Use this data to answer the user's questions and provide personalized advice.
      Always respond in the language the user is writing in.
      Keep your answers concise and easy to understand.
      Here is the user's financial data:
      ${financialContext}
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
          { role: 'system', content: systemPrompt },
          ...messages
      ],
    })

    const message = response.choices[0]?.message?.content || 'Desculpe, não consegui processar sua solicitação.'
    
    return NextResponse.json({ message })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}