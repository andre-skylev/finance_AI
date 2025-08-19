"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { ArrowLeft, Save, Upload } from 'lucide-react'
import Link from 'next/link'
import { UploadStatus } from './components/UploadStatus'
import { ReviewTransactions } from './components/ReviewTransactions'

// ... (interfaces Category, Account, StatusEvent permanecem as mesmas)

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
}

interface Account {
  id: string
  name: string
  bank_name: string
  balance: number
  currency: string
}

interface StatusEvent {
  message: string
  progress: number
}

interface Transaction {
  date: string
  description?: string
  merchant?: string
  amount: number
  type?: 'credit' | 'debit'
  category: string
  pattern_matched?: string
  confidence?: number
  installments?: number
  installment_info?: string
}

interface AccountInfo {
  bank?: string
  account_number?: string
  period?: string
  currency?: string
}

interface CardInfo {
  bank?: string
  last_four_digits?: string
  card_brand?: string
  credit_limit?: number
  statement_date?: string
  due_date?: string
  previous_balance?: number
  payments?: number
  new_purchases?: number
  interest_charges?: number
  fees?: number
  total_amount?: number
  minimum_payment?: number
}

type PageStep = 'upload' | 'progress' | 'review'

export default function AddTransactionPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  
  const [step, setStep] = useState<PageStep>('upload')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadEvents, setUploadEvents] = useState<StatusEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const [extractedData, setExtractedData] = useState<{
    transactions: Transaction[]
    accountInfo: AccountInfo
    cardInfo?: CardInfo | null
    detectedBank: string
    documentType?: string
    isCreditCard?: boolean
    suggestedAction?: string
    autoCreatedAccount?: any
  } | null>(null)

  const [formData, setFormData] = useState({
    type: 'expense' as 'expense' | 'income',
    amount: '',
    currency: 'EUR',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    category_id: '',
    account_id: '',
  })

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    // ... (código para buscar categorias e contas, sem alterações)
  }

  const fetchCategories = async () => {
    // ... (código para buscar categorias, sem alterações)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStep('progress')
    setError(null)
    setUploadEvents([])
    setUploadProgress(0)

    const events: StatusEvent[] = [
      { message: 'Iniciando upload...', progress: 10 },
      { message: 'Arquivo enviado, aguardando processamento...', progress: 25 },
      { message: 'Servidor está extraindo o texto do PDF...', progress: 50 },
      { message: 'Analisando transações com Inteligência Artificial...', progress: 75 },
      { message: 'Finalizando e organizando os dados...', progress: 90 },
    ]

    let eventIndex = 0
    const interval = setInterval(() => {
      if (eventIndex < events.length) {
        setUploadEvents(prev => [...prev, events[eventIndex]])
        setUploadProgress(events[eventIndex].progress)
        eventIndex++
      } else {
        clearInterval(interval)
      }
    }, 1500)

    const uploadFormData = new FormData()
    uploadFormData.append('file', file)

    try {
      const response = await fetch('/api/pdf-upload', {
        method: 'POST',
        body: uploadFormData,
      })

      clearInterval(interval)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Ocorreu um erro desconhecido.')
      }
      
      setUploadEvents(prev => [...prev, { message: 'Processo concluído!', progress: 100 }])
      setUploadProgress(100)
      
      setExtractedData({
        transactions: result.transactions || [],
        accountInfo: result.account_info || {},
        cardInfo: result.card_info || null,
        detectedBank: result.detected_bank || 'Não identificado',
        documentType: result.document_type || 'bank_statement',
        isCreditCard: result.is_credit_card || false,
        suggestedAction: result.suggested_action || 'import_to_account',
        autoCreatedAccount: result.auto_created_account || null
      })
      setStep('review')

    } catch (err: any) {
      clearInterval(interval)
      setError(err.message)
      setUploadProgress(100)
      setUploadEvents(prev => [...prev, { message: `Erro: ${err.message}`, progress: 100 }])
    }
  }

  const handleSaveReviewedTransactions = async () => {
    if (!extractedData || !user) return
    
    setIsSaving(true)
    try {
      // Usar o account_id da conta criada automaticamente se disponível
      const accountId = extractedData.autoCreatedAccount?.account_id || null
      
      if (extractedData.isCreditCard) {
        // Para cartões de crédito, salvar como credit_card_transactions
        const creditCardTransactions = extractedData.transactions.map((tx: any) => ({
          user_id: user.id,
          credit_card_id: accountId,
          transaction_date: tx.date,
          merchant_name: tx.merchant || tx.description,
          amount: tx.amount,
          currency: 'EUR', // Será ajustado depois
          transaction_type: 'purchase',
          installments: tx.installments || 1,
          installment_number: 1,
          description: tx.description || tx.merchant,
          pattern_matched: tx.pattern_matched,
          confidence_score: tx.confidence
        }))

        const { error: insertError } = await supabase
          .from('credit_card_transactions')
          .insert(creditCardTransactions)

        if (insertError) throw insertError
      } else {
        // Para contas bancárias, salvar como transactions normais
        const bankTransactions = extractedData.transactions.map((tx: any) => ({
          user_id: user.id,
          account_id: accountId,
          amount: tx.amount,
          currency: extractedData.accountInfo?.currency || 'EUR',
          description: tx.description,
          transaction_date: tx.date,
          type: tx.type,
          category_name_raw: tx.category,
          bank_name_raw: extractedData.detectedBank
        }))

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(bankTransactions)

        if (insertError) throw insertError
      }

      alert('Transações importadas com sucesso!')
      handleCancelReview()
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      alert(`Erro ao salvar transações: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelReview = () => {
    setStep('upload')
    setExtractedData(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    // ... (código do submit manual, sem alterações)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const renderContent = () => {
    switch (step) {
      case 'progress':
        return (
          <div className="flex h-full w-full items-center justify-center py-10">
            <UploadStatus events={uploadEvents} progress={uploadProgress} />
          </div>
        )
      case 'review':
        if (!extractedData) return null
        return (
          <ReviewTransactions
            transactions={extractedData.transactions}
            accountInfo={extractedData.accountInfo}
            cardInfo={extractedData.cardInfo || undefined}
            detectedBank={extractedData.detectedBank}
            documentType={extractedData.documentType || 'bank_statement'}
            isCreditCard={extractedData.isCreditCard}
            autoCreatedAccount={extractedData.autoCreatedAccount}
            onSave={handleSaveReviewedTransactions}
            onCancel={handleCancelReview}
            isSaving={isSaving}
          />
        )
      case 'upload':
      default:
        return (
          <>
            {/* Upload Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Importar de extrato PDF</h2>
              <p className="text-sm text-gray-500 mb-4">
                Poupe tempo importando múltiplas transações de uma só vez.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="application/pdf"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center px-4 py-3 bg-primary-light text-primary border-2 border-dashed border-primary rounded-lg hover:bg-primary-dark hover:text-white transition-all duration-300"
              >
                <Upload className="h-5 w-5 mr-3" />
                Clique para selecionar um arquivo PDF
              </button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm font-medium">OU ADICIONE MANUALMENTE</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-6">
              {/* Formulário manual aqui, sem alterações */}
            </form>
          </>
        )
    }
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center space-x-4">
          <Link 
            href="/transactions" 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Nova Transação</h1>
            <p className="text-gray-600">Adicione uma nova despesa, receita ou importe de um extrato.</p>
          </div>
        </div>
        {renderContent()}
      </div>
    </ProtectedRoute>
  )
}