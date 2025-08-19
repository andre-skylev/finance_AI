"use client"

import React from 'react'
import PDFUploader from '@/components/PDFUploader'
import { Camera, Receipt } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function ReceiptsPage() {
  const { t } = useLanguage()
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-optimized Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight">
              {t('receipts.title')}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile optimized */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Upload Section - Mobile optimized card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60">
            <div className="p-6 sm:p-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-100 mb-3 sm:mb-4">
                  <Camera className="h-6 w-6 sm:h-7 sm:w-7 text-gray-600" />
                </div>
                <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                  {t('receipts.captureReceipt')}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 max-w-md mx-auto">
                  {t('receipts.subtitle')}
                </p>
              </div>
              <PDFUploader defaultDocumentType="receipt" />
            </div>
          </div>

          {/* Receipts List */}
          <ReceiptsList />
        </div>
      </div>
    </div>
  )
}

function ReceiptsList() {
  const { t } = useLanguage()
  const [loading, setLoading] = React.useState(true)
  const [receipts, setReceipts] = React.useState<any[]>([])
  const [error, setError] = React.useState<string>('')

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/receipts')
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || t('receipts.errors.loadFailed'))
        if (!cancelled) setReceipts(j.receipts || [])
      } catch (e: any) {
        if (!cancelled) setError(e.message || t('receipts.errors.unexpected'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-6 sm:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-100 rounded-lg w-32"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-50 rounded-xl"></div>
            <div className="h-16 bg-gray-50 rounded-xl"></div>
            <div className="h-16 bg-gray-50 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-6 sm:p-8">
        <div className="text-center py-4">
          <div className="text-gray-600 text-sm">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 text-sm text-gray-900 font-medium hover:text-gray-600 transition-colors"
          >
            {t('receipts.errors.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  if (!receipts?.length) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60">
        <div className="text-center py-12 sm:py-16 px-6 sm:px-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-100 mb-3 sm:mb-4">
            <Receipt className="h-6 w-6 sm:h-7 sm:w-7 text-gray-400" />
          </div>
          <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-1 sm:mb-2">
            {t('receipts.noReceipts')}
          </h3>
          <p className="text-gray-500 text-xs sm:text-sm max-w-xs mx-auto">
            {t('receipts.noReceiptsDesc')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60">
      <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-medium text-gray-900">
            {t('receipts.allReceipts')}
          </h2>
          <span className="text-xs sm:text-sm text-gray-500">
            {receipts.length} {t('receipts.total')}
          </span>
        </div>
      </div>

      {/* Mobile-optimized List View */}
      <div className="divide-y divide-gray-100">
        {receipts.map((r) => (
          <div 
            key={r.id} 
            className="px-4 sm:px-8 py-4 sm:py-5 hover:bg-gray-50/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                  <h3 className="font-medium text-gray-900 text-sm truncate">
                    {r.merchant_name || t('receipts.unknownMerchant')}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {r.receipt_date ? new Date(r.receipt_date).toLocaleDateString('pt-PT', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    }) : '—'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500">
                  {typeof r.subtotal === 'number' && (
                    <span>{t('receipts.subtotal')} {formatCurrency(r.subtotal)}</span>
                  )}
                  {typeof r.tax === 'number' && r.tax > 0 && (
                    <span>{t('receipts.tax')} {formatCurrency(r.tax)}</span>
                  )}
                </div>
              </div>
              <div className="text-right ml-4">
                <div className="text-sm sm:text-base font-semibold text-gray-900">
                  {formatCurrency(r.total)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatCurrency(v?: number) {
  if (typeof v !== 'number') return '—'
  return new Intl.NumberFormat('pt-PT', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(v)
}