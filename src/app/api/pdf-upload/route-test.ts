import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('Test POST endpoint')
  return NextResponse.json({ test: true })
}
