import Link from 'next/link'
import { Banknote, Bot, Goal, LineChart } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Finance AI</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="hover:underline">Dashboard</Link>
            <Link href="/chat" className="hover:underline">Assistente IA</Link>
            <Link href="/settings" className="hover:underline">Definições</Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center gap-2 text-primary">
            <LineChart size={20} />
            <h2 className="text-lg font-medium">Dashboard Multi-Moeda</h2>
          </div>
          <p className="mt-2 text-gray-600">Visão consolidada das suas finanças em EUR e BRL.</p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center gap-2 text-primary">
            <Banknote size={20} />
            <h2 className="text-lg font-medium">Sincronização Bancária</h2>
          </div>
          <p className="mt-2 text-gray-600">Conecte contas em Portugal e Brasil via Open Banking/Finance.</p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center gap-2 text-primary">
            <Bot size={20} />
            <h2 className="text-lg font-medium">Agente IA</h2>
          </div>
          <p className="mt-2 text-gray-600">Pergunte em linguagem natural, receba insights personalizados.</p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center gap-2 text-primary">
            <Goal size={20} />
            <h2 className="text-lg font-medium">Metas Financeiras</h2>
          </div>
          <p className="mt-2 text-gray-600">Defina objetivos e acompanhe com recomendações de IA.</p>
        </div>
      </section>
    </main>
  )
}
