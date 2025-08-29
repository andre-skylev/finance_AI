'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, FileText, CreditCard, AlertCircle, CheckCircle, Info, Shield, Upload } from 'lucide-react'

interface CreditCardInfo {
  bank: string
  cardNumber: string
  cardHolder: string
  lastFourDigits: string
  isDependent?: boolean
  sharedLimit?: number
  cardBrand?: string
}

interface Transaction {
  date: string
  merchant?: string
  description: string
  amount: number
  category: string
  type?: 'debit' | 'credit'
  installments?: number
  installment_info?: string
  reference?: string
}

interface DocumentMetadata {
  type: 'credit_card_statement' | 'bank_statement'
  bank: string
  confidence: number
  hasMultipleCards: boolean
  hasInstallments: boolean
  period?: string
  currency?: string
}

interface ProcessingResult {
  success: boolean
  metadata: DocumentMetadata
  transactions: Transaction[]
  creditCards?: CreditCardInfo[]
  installments?: Record<string, any>
  errors?: string[]
  warnings?: string[]
  requiresUserConfirmation: boolean
  suggestedActions?: string[]
  processing?: {
    method: string
    timeMs: number
    textLength: number
    autoProcessed: boolean
  }
}

interface DocumentUploadConsentProps {
  file: File | null
  onClose: () => void
  onConfirm: (result: ProcessingResult, options: ImportOptions) => void
  autoProcess?: boolean
}

interface ImportOptions {
  importTransactions: boolean
  createCards: boolean
  selectedCards: string[]
  selectedTransactions: number[]
  accountId?: string
  cardId?: string
}

export default function DocumentUploadConsent({ 
  file, 
  onClose, 
  onConfirm,
  autoProcess = false 
}: DocumentUploadConsentProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'confirm'>('upload')
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    importTransactions: true,
    createCards: true,
    selectedCards: [],
    selectedTransactions: [],
  })
  const [showPrivacy, setShowPrivacy] = useState(false)

  const handleFileUpload = useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setStep('processing')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('autoProcess', String(autoProcess))
      formData.append('requireConfirmation', 'true')

      const response = await fetch('/api/pdf-upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process document')
      }

      setProcessingResult(result)
      
      // Initialize selected items
      if (result.creditCards) {
        setImportOptions(prev => ({
          ...prev,
          selectedCards: result.creditCards.map((c: CreditCardInfo) => c.cardNumber)
        }))
      }
      
      if (result.transactions) {
        setImportOptions(prev => ({
          ...prev,
          selectedTransactions: result.transactions.map((_: any, i: number) => i)
        }))
      }

      setStep('review')
    } catch (err: any) {
      setError(err.message)
      setStep('upload')
    } finally {
      setIsProcessing(false)
    }
  }, [file, autoProcess])

  useEffect(() => {
    if (file && step === 'upload') {
      handleFileUpload()
    }
  }, [file, step, handleFileUpload])

  const handleConfirm = () => {
    if (!processingResult) return
    
    setStep('confirm')
    onConfirm(processingResult, importOptions)
  }

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || 'EUR'
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: curr,
    }).format(Math.abs(amount))
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-PT')
    } catch {
      return dateStr
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            {step === 'upload' && <Upload className="w-6 h-6 text-blue-500" />}
            {step === 'processing' && <FileText className="w-6 h-6 text-blue-500 animate-pulse" />}
            {step === 'review' && <Shield className="w-6 h-6 text-green-500" />}
            {step === 'confirm' && <CheckCircle className="w-6 h-6 text-green-500" />}
            
            <h2 className="text-xl font-semibold">
              {step === 'upload' && 'Upload Document'}
              {step === 'processing' && 'Processing Document...'}
              {step === 'review' && 'Review & Confirm'}
              {step === 'confirm' && 'Import Confirmed'}
            </h2>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
                  <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Processing State */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Analyzing your document...</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">This may take a few moments</p>
            </div>
          )}

          {/* Review State */}
          {step === 'review' && processingResult && (
            <div className="space-y-6">
              {/* Document Info */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-medium mb-3">Document Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-2 font-medium">
                      {processingResult.metadata.type === 'credit_card_statement' ? 'Credit Card Statement' : 'Bank Statement'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bank:</span>
                    <span className="ml-2 font-medium">{processingResult.metadata.bank}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Confidence:</span>
                    <span className="ml-2 font-medium">{processingResult.metadata.confidence}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Currency:</span>
                    <span className="ml-2 font-medium">{processingResult.metadata.currency || 'EUR'}</span>
                  </div>
                  {processingResult.metadata.period && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Period:</span>
                      <span className="ml-2 font-medium">{processingResult.metadata.period}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Credit Cards */}
              {processingResult.creditCards && processingResult.creditCards.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Credit Cards Detected ({processingResult.creditCards.length})
                  </h3>
                  <div className="space-y-2">
                    {processingResult.creditCards.map((card, index) => (
                      <label
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/70"
                      >
                        <input
                          type="checkbox"
                          checked={importOptions.selectedCards.includes(card.cardNumber)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setImportOptions(prev => ({
                                ...prev,
                                selectedCards: [...prev.selectedCards, card.cardNumber]
                              }))
                            } else {
                              setImportOptions(prev => ({
                                ...prev,
                                selectedCards: prev.selectedCards.filter(c => c !== card.cardNumber)
                              }))
                            }
                          }}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{card.cardHolder}</span>
                            {card.isDependent && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                Dependent
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {card.cardBrand} •••• {card.lastFourDigits}
                            {card.sharedLimit && ` • Limit: ${formatCurrency(card.sharedLimit, processingResult.metadata.currency)}`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions Summary */}
              {processingResult.transactions && processingResult.transactions.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">
                    Transactions ({processingResult.transactions.length})
                  </h3>
                  
                  <div className="mb-3 flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={importOptions.importTransactions}
                        onChange={(e) => setImportOptions(prev => ({ ...prev, importTransactions: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Import all transactions</span>
                    </label>
                  </div>

                  {/* Show sample transactions */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {processingResult.transactions.slice(0, 5).map((tx, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div>
                            <div className="font-medium">{tx.merchant || tx.description}</div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {formatDate(tx.date)} • {tx.category}
                              {tx.installment_info && ` • ${tx.installment_info}`}
                            </div>
                          </div>
                          <div className={`font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                            {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount, processingResult.metadata.currency)}
                          </div>
                        </div>
                      ))}
                      {processingResult.transactions.length > 5 && (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2">
                          ... and {processingResult.transactions.length - 5} more transactions
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Notice */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Privacy & Security</p>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                      Your document is processed securely. We extract only transaction data and do not store the original document.
                    </p>
                    <button
                      onClick={() => setShowPrivacy(!showPrivacy)}
                      className="text-sm text-blue-500 hover:underline mt-2"
                    >
                      {showPrivacy ? 'Hide' : 'Learn more'}
                    </button>
                    {showPrivacy && (
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 text-sm text-blue-600 dark:text-blue-300 space-y-2">
                        <p>• Documents are processed using secure OCR technology</p>
                        <p>• Only transaction data is stored in your account</p>
                        <p>• Original PDFs are not retained after processing</p>
                        <p>• All data is encrypted in transit and at rest</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {processingResult.warnings && processingResult.warnings.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">Warnings</p>
                      <ul className="text-sm text-yellow-600 dark:text-yellow-300 mt-1 list-disc list-inside">
                        {processingResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirmation State */}
          {step === 'confirm' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Import Started</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                Your transactions are being imported in the background.
                You can close this window and continue using the app.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {processingResult?.processing && (
              <span>
                Processed in {processingResult.processing.timeMs}ms using {processingResult.processing.method}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            
            {step === 'review' && (
              <button
                onClick={handleConfirm}
                disabled={!importOptions.importTransactions && importOptions.selectedCards.length === 0}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Import
              </button>
            )}
            
            {step === 'confirm' && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}