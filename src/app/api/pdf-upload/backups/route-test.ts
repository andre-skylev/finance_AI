import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    console.log('Iniciando processamento')
    
    const responseBody = {
      success: true,
      message: 'Teste básico funcionando'
    }

    return NextResponse.json(responseBody)
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    method: 'test-basic'
  })
}
