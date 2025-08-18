"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { ArrowLeft, Save, Upload, FileText, CreditCard, Landmark, Zap, Brain, Shield } from 'lucide-react'
import Link from 'next/link'
import { UploadStatus } from './components/UploadStatus'
import { ReviewTransactions } from './components/ReviewTransactions'

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

export default function ImportPage() {
  const { user } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<PageStep>('upload')
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadEvents, setUploadEvents] = useState<StatusEvent[]>([])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [extractedData, setExtractedData] = useState<{
    transactions: Transaction[]
    accountInfo: AccountInfo
    cardInfo?: CardInfo | null
    creditCardsInfo?: any[] // Informações dos cartões dependentes
    installmentDetails?: Record<string, any> // Detalhes dos parcelamentos
    detectedBank: string
    documentType?: string
    isCreditCard?: boolean
    suggestedAction?: string
    autoCreatedAccount?: any
  } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchCategories()
    fetchAccounts()
  }, [])

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*')
    setCategories(data || [])
  }

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').eq('is_active', true)
    setAccounts(data || [])
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setStep('progress')
    setUploadProgress(0)
    setUploadEvents([])
    setError('')

    const events: StatusEvent[] = [
      { message: 'Carregando arquivo PDF...', progress: 20 },
      { message: 'Extraindo texto com OCR inteligente...', progress: 40 },
      { message: 'Detectando tipo de documento...', progress: 60 },
      { message: 'Analisando transações com IA...', progress: 80 },
      { message: 'Categorizando compras automaticamente...', progress: 90 },
    ]

    let currentEvent = 0
    const interval = setInterval(() => {
      if (currentEvent < events.length) {
        setUploadEvents(prev => [...prev, events[currentEvent]])
        setUploadProgress(events[currentEvent].progress)
        currentEvent++
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
        creditCardsInfo: result.credit_cards_info || [],
        installmentDetails: result.installment_details || {},
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
          installment_number: tx.installment_number || 1, // Usar o valor correto do parsing
          description: tx.description || tx.merchant,
          pattern_matched: tx.pattern_matched,
          confidence_score: tx.confidence,
          tan_rate: tx.tan_rate, // Taxa de juro do parcelamento
          original_amount: tx.original_amount // Valor original antes do parcelamento
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
            creditCardsInfo={extractedData.creditCardsInfo}
            installmentDetails={extractedData.installmentDetails}
            detectedBank={extractedData.detectedBank}
            documentType={extractedData.documentType || 'bank_statement'}
            isCreditCard={extractedData.isCreditCard}
            autoCreatedAccount={extractedData.autoCreatedAccount}
            onSave={handleSaveReviewedTransactions}
            onCancel={handleCancelReview}
            isSaving={isSaving}
          />
        )
      default:
        return (
          <div className="w-full max-w-3xl mx-auto">
            {/* Header minimal */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900">Importar documento</h1>
              <p className="text-sm text-gray-500 mt-1">Envie extratos bancários ou faturas de cartão no formato PDF.</p>
            </div>

            {/* Upload Area minimal */}
            <div className="rounded-lg border border-dashed border-gray-300 bg-white">
              <div className="p-8 text-center">
                <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-4">Arraste e solte um PDF aqui ou selecione do seu computador.</p>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4 mr-2 text-gray-600" />
                  Selecionar PDF
                </button>

                {error && (
                  <p className="mt-4 text-sm text-red-600">{error}</p>
                )}

                <div className="mt-6 text-xs text-gray-500">
                  <p>Suporte para bancos PT e BR • Processamento com IA • Dados protegidos</p>
                </div>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {step === 'upload' && (
            <div className="mb-6">
              <Link 
                href="/dashboard" 
                className="inline-flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao dashboard
              </Link>
            </div>
          )}
          
          {renderContent()}
        </div>
      </div>
    </ProtectedRoute>
  )
}
