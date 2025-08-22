"use client"

import { Banknote, Bot, Goal, LineChart, FileText, Receipt, Shield, ArrowRight, ArrowLeftRight, Camera, Upload, Calendar } from 'lucide-react'
import { LoginCTA } from '@/components/LoginCTA'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

export default function HomePage() {
  const { t, language } = useLanguage()

  const title = language === 'pt' ? 'Como usar a plataforma' : 'How to use the platform'
  const subtitle = language === 'pt'
    ? 'Siga os passos abaixo para começar e tirar o máximo proveito do FinanceAI.'
    : 'Follow the steps below to get started and make the most of FinanceAI.'

  const steps = [
    {
      icon: Banknote,
      title: language === 'pt' ? '1) Crie suas contas' : '1) Create your accounts',
      desc: language === 'pt'
        ? 'Vá até Contas e adicione contas (corrente, poupança, cartão). Você pode ocultar saldos com o “olhinho”.'
        : 'Go to Accounts and add accounts (checking, savings, credit card). You can hide balances with the eye icon.'
    },
    {
      icon: FileText,
      title: language === 'pt' ? '2) Importe documentos (PDF/Imagem)' : '2) Import documents (PDF/Image)',
      desc: language === 'pt'
        ? 'Use Importar PDF para enviar extratos, faturas ou recibos. Detectamos automaticamente o tipo e extraímos transações/itens.'
        : 'Use Import PDF to upload statements, invoices, or receipts. We auto-detect the type and extract transactions/items.'
    },
    {
      icon: LineChart,
      title: language === 'pt' ? '3) Revise e confirme' : '3) Review and confirm',
      desc: language === 'pt'
        ? 'Confira as transações sugeridas, ajuste categorias e associe à conta correta antes de salvar.'
        : 'Review suggested transactions, adjust categories, and link to the right account before saving.'
    },
    {
      icon: Goal,
      title: language === 'pt' ? '4) Acompanhe no Dashboard e defina metas' : '4) Track on the Dashboard and set goals',
      desc: language === 'pt'
        ? 'Veja saldos, fluxo de caixa, gastos por categoria e configure objetivos financeiros.'
        : 'See balances, cash flow, expenses by category, and set financial goals.'
    }
  ]

  const features = [
    {
      icon: Bot,
      title: language === 'pt' ? 'Assistente IA' : 'AI Assistant',
      desc: language === 'pt'
        ? 'Faça perguntas em linguagem natural e obtenha insights das suas finanças.'
        : 'Ask questions in natural language and get insights from your finances.'
    },
    {
      icon: Receipt,
      title: language === 'pt' ? 'Recibos inteligentes' : 'Smart receipts',
      desc: language === 'pt'
        ? 'Extração avançada de itens com código e imposto, inclusive tabela dinâmica quando disponível.'
        : 'Advanced item extraction with code and tax, including dynamic tables when available.'
    },
    {
      icon: Shield,
      title: language === 'pt' ? 'Segurança e privacidade' : 'Security & privacy',
      desc: language === 'pt'
        ? 'Autenticação segura e regras de acesso por usuário nos seus dados.'
        : 'Secure auth and user-level access rules on your data.'
    }
  ]

  const ctas = [
    {
      href: '/accounts',
      label: language === 'pt' ? 'Ir para Contas' : 'Go to Accounts'
    },
    {
      href: '/pdf-import',
      label: language === 'pt' ? 'Importar PDF' : 'Import PDF'
    },
    {
      href: '/dashboard',
      label: language === 'pt' ? 'Abrir Dashboard' : 'Open Dashboard'
    },
    {
      href: '/transactions/add',
      label: language === 'pt' ? 'Adicionar Transação (manual)' : 'Add Transaction (manual)'
    }
  ]

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <header className="text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-gray-600">{subtitle}</p>
      </header>

      {/* Steps */}
      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((s, idx) => (
          <div key={idx} className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2 text-primary">
              <s.icon size={20} />
              <h2 className="text-base font-medium">{s.title}</h2>
            </div>
            <p className="mt-2 text-gray-600 text-sm">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="grid gap-4 sm:grid-cols-3">
        {features.map((f, idx) => (
          <div key={idx} className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2 text-primary">
              <f.icon size={20} />
              <h3 className="text-base font-medium">{f.title}</h3>
            </div>
            <p className="mt-2 text-gray-600 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Transactions & Structure explanation */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center gap-2 text-primary">
          <ArrowLeftRight size={20} />
          <h2 className="text-base font-medium">
            {language === 'pt' ? 'Transações: o que são e como adicionar' : 'Transactions: what they are and how to add'}
          </h2>
        </div>
        <div className="mt-3 space-y-3 text-sm text-gray-700">
          <p>
            {language === 'pt'
              ? 'Transações são os lançamentos financeiros (entradas, saídas e transferências) vinculados a uma conta. Elas alimentam o Dashboard, o fluxo de caixa e os gráficos por categoria.'
              : 'Transactions are financial postings (income, expenses, and transfers) linked to an account. They power the Dashboard, cash flow, and category charts.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-primary">
                <Upload size={18} />
                <strong className="text-sm">
                  {language === 'pt' ? 'PDF (extrato/fatura)' : 'PDF (statement/invoice)'}
                </strong>
              </div>
              <p className="mt-1 text-gray-600">
                {language === 'pt'
                  ? 'Envie um PDF em Importar PDF. A plataforma detecta o tipo e extrai as transações automaticamente.'
                  : 'Upload a PDF in Import PDF. The platform detects the type and extracts transactions automatically.'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-primary">
                <Camera size={18} />
                <strong className="text-sm">
                  {language === 'pt' ? 'Foto (recibos)' : 'Photo (receipts)'}
                </strong>
              </div>
              <p className="mt-1 text-gray-600">
                {language === 'pt'
                  ? 'Use a câmara para digitalizar recibos; os itens e totais podem virar transações associadas.'
                  : 'Use the camera to scan receipts; items and totals can become linked transactions.'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-primary">
                <ArrowRight size={18} />
                <strong className="text-sm">
                  {language === 'pt' ? 'Manual' : 'Manual'}
                </strong>
              </div>
              <p className="mt-1 text-gray-600">
                {language === 'pt'
                  ? 'Adicione manualmente em Transações > Adicionar, útil para lançamentos pontuais.'
                  : 'Add manually in Transactions > Add, useful for one-off entries.'}
              </p>
            </div>
          </div>
          <p className="text-gray-700">
            {language === 'pt'
              ? 'Tipos: Entrada (receita), Saída (despesa) e Transferência (entre contas). Diferenciar entradas e saídas permite análises precisas de fluxo de caixa e metas de poupança.'
              : 'Types: Income, Expense, and Transfer (between accounts). Distinguishing income and expenses enables accurate cash flow analysis and savings goals.'}
          </p>
        </div>
      </div>

      {/* Fixed costs explanation */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center gap-2 text-primary">
          <Calendar size={20} />
          <h2 className="text-base font-medium">
            {language === 'pt' ? 'Custos Fixos: por que cadastrar' : 'Fixed Costs: why add them'}
          </h2>
        </div>
        <div className="mt-3 text-sm text-gray-700 space-y-2">
          <p>
            {language === 'pt'
              ? 'Custos fixos são despesas recorrentes (ex.: renda, assinaturas). Ao cadastrá-los, o sistema projeta o impacto mensal/annual e ajuda no planeamento do seu orçamento.'
              : 'Fixed costs are recurring expenses (e.g., rent, subscriptions). Adding them lets the system project monthly/annual impact and help with budget planning.'}
          </p>
          <p>
            {language === 'pt'
              ? 'Isso complementa as transações variáveis do dia a dia, dando uma visão completa entre entradas (salário, rendimentos) e saídas (fixas + variáveis).'
              : 'This complements day-to-day variable transactions, giving a complete view between income and outflows (fixed + variable).'}
          </p>
        </div>
      </div>

      {/* Quick CTAs */}
      <div className="flex flex-wrap gap-3">
        {ctas.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            <span>{c.label}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        ))}
      </div>

      {/* Login CTA for guests */}
      <LoginCTA />
    </section>
  )
}
