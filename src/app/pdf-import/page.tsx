"use client"

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PDFUploader from '@/components/PDFUploader'
import { FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PDFImportPage() {
  const { t } = useLanguage()
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastImport, setLastImport] = useState<any>(null)
  const [creatingCard, setCreatingCard] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleSuccess = () => {
    setRefreshKey(prev => prev + 1)
  }

  useEffect(() => {
    const handler = (e: any) => {
      setLastImport(e.detail)
    }
    window.addEventListener('pdf-import:success', handler as any)
    return () => window.removeEventListener('pdf-import:success', handler as any)
  }, [])

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Link
                href="/transactions"
                className="inline-flex items-center text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t('pdfImport.backToTransactions')}
              </Link>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
              <FileText className="h-6 w-6 mr-3" />
              {t('pdfImport.title')}
            </h1>
            <p className="text-gray-600">
              {t('pdfImport.subtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Uploader and guidance */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">{t('pdfImport.howItWorks')}</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>1. {t('pdfImport.step1')}</li>
                <li>2. {t('pdfImport.step2')}</li>
                <li>3. {t('pdfImport.step3')}</li>
                <li>4. {t('pdfImport.step4')}</li>
              </ul>
            </div>

            <PDFUploader onSuccess={handleSuccess} key={refreshKey} />

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">{t('pdfImport.tipsTitle')}</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• {t('pdfImport.tip1')}</li>
                <li>• {t('pdfImport.tip2')}</li>
                <li>• {t('pdfImport.tip3')}</li>
                <li>• {t('pdfImport.tip4')}</li>
              </ul>
            </div>
          </div>

          {/* Right: Card recognition */}
          <div className="space-y-6">
            {/* Card recognition */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">{t('pdfImport.cardRecognition')}</h3>
              <p className="text-sm text-gray-600 mb-4">{t('pdfImport.cardRecognitionHint')}</p>
              {lastImport?.data?.cardCandidate ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">{t('card.holder')}</span>
                      <div className="font-medium">{lastImport.data.cardCandidate.cardHolderName || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('card.last4')}</span>
                      <div className="font-medium">{lastImport.data.cardCandidate.lastFourDigits || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('card.type')}</span>
                      <div className="font-medium">{lastImport.data.cardCandidate.cardType || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('card.currency')}</span>
                      <div className="font-medium">{lastImport.data.cardCandidate.currency || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('card.limit')}</span>
                      <div className="font-medium">{typeof lastImport.data.cardCandidate.cardLimit === 'number' ? lastImport.data.cardCandidate.cardLimit : '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('card.available')}</span>
                      <div className="font-medium">{typeof lastImport.data.cardCandidate.availableLimit === 'number' ? lastImport.data.cardCandidate.availableLimit : '-'}</div>
                    </div>
                  </div>
                  <button
                    disabled={creatingCard}
                    className={`w-full mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg text-white ${creatingCard ? 'bg-primary/60 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}
                    onClick={async () => {
                      if (!lastImport?.data?.cardCandidate) return
                      try {
                        setCreatingCard(true)
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) throw new Error('Not authenticated')
                        const cand = lastImport.data.cardCandidate
                        const institution = lastImport.data.institution || ''
                        const nameParts: string[] = []
                        if (institution) nameParts.push(institution)
                        if (cand.lastFourDigits) nameParts.push(`•••• ${cand.lastFourDigits}`)
                        const card_name = nameParts.join(' ')
                        const insertData: any = {
                          user_id: user.id,
                          card_name,
                          bank_name: institution || cand.cardHolderName || 'Bank',
                          card_brand: cand.cardType || null,
                          last_four_digits: cand.lastFourDigits || null,
                          card_type: 'credit',
                          credit_limit: typeof cand.cardLimit === 'number' ? cand.cardLimit : null,
                          currency: cand.currency || 'EUR',
                          current_balance: 0,
                          notes: 'Created from PDF import'
                        }
                        const { error } = await supabase.from('credit_cards').insert([insertData])
                        if (error) throw error
                        alert(t('messages.successCreated'))
                        router.push('/credit-cards')
                      } catch (e: any) {
                        alert(t('messages.errorCreating') + (e?.message || ''))
                      } finally {
                        setCreatingCard(false)
                      }
                    }}
                  >
                    {creatingCard ? t('common.loading') : t('pdfImport.addCard')}
                  </button>
                </div>
              ) : (
        <div className="text-sm text-gray-600">{t('pdfImport.noCardDetected')}</div>
              )}
            </div>

            {/* Known banks removed by request */}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
