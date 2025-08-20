"use client"

import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

export function LoginCTA() {
  const { user } = useAuth()
  if (user) return null
  return (
    <div className="rounded-xl border bg-white p-6 sm:col-span-2 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <LogIn size={20} />
          <h2 className="text-lg font-medium">Comece agora</h2>
        </div>
        <p className="mt-2 text-gray-600">Crie uma conta ou entre com Google para usar o app completo.</p>
      </div>
      <Link href="/login" className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90">
        Entrar
      </Link>
    </div>
  )
}
