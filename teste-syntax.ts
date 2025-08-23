export async function POST(request: any) {
  try {
    console.log('início')
    
    if (true) {
      console.log('debug block')
    }

    return { success: true }
  } catch (error: any) {
    console.error('erro:', error)
    return { error: error.message }
  }
}
