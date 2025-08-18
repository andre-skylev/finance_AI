import Link from 'next/link'

export default function AuthCodeError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Erro na Autenticação
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ocorreu um erro durante o processo de autenticação com Google.
          </p>
        </div>
        
        <div className="mt-8">
          <Link
            href="/login"
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Tentar novamente
          </Link>
        </div>
      </div>
    </div>
  )
}
