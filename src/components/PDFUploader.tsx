"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Camera, RotateCcw, X, Zap } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface Transaction {
  date: string
  description: string
  amount: number
  suggestedCategory: string
}

interface ExtractedData {
  documentType: string
  institution: string
  period: {
    start: string
    end: string
  }
  transactions: Transaction[]
  receipts?: Array<{
    merchant?: string
    date?: string
    subtotal?: number
    tax?: number
    total?: number
    items: Array<{ description: string; quantity?: number; unitPrice?: number; total?: number }>
  }>
}

interface Account {
  id: string
  name: string
  type: string
}

interface PDFUploaderProps {
  onSuccess?: () => void
  defaultDocumentType?: 'bank_statement' | 'credit_card' | 'receipt'
}

export default function PDFUploader({ onSuccess, defaultDocumentType }: PDFUploaderProps) {
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [documentType, setDocumentType] = useState<'bank_statement' | 'credit_card' | 'receipt'>(defaultDocumentType || 'bank_statement')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string>('')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [hasTorchSupport, setHasTorchSupport] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  // No advanced options UI; processors are selected server-side based on documentType

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function compressImageIfNeeded(original: File): Promise<File> {
    // Only compress images; PDFs are left untouched
    if (!/^image\//.test(original.type)) return original
    // Heuristic: skip compression for small images
    if (original.size < 400 * 1024) return original
    const bitmap = await createImageBitmap(original).catch(() => null as any)
    if (!bitmap) return original
    const maxDim = 2000
    let { width, height } = bitmap
    const scale = Math.min(1, maxDim / Math.max(width, height))
    width = Math.round(width * scale)
    height = Math.round(height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, width, height)
    const quality = 0.85
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return original
    return new File([blob], original.name.replace(/\.(png|jpg|jpeg)$/i, '.jpg'), { type: 'image/jpeg' })
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    setError('')
    setExtractedData(null)
    setSuccess('')
    const process = async () => {
      let f = selectedFile
      // Allow images & pdf; compress images
      if (selectedFile.type.startsWith('image/')) {
        try { f = await compressImageIfNeeded(selectedFile) } catch {}
      } else if (selectedFile.type !== 'application/pdf') {
        setError(t('pdfUploader.errors.unsupportedFormat'))
        return
      }
      setFile(f)
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f)
        setPreviewUrl(url)
      } else {
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
      }
    }
    process()
  }

  const openCamera = async () => {
    setError('')
    setCameraError('')
    setIsCameraLoading(true)
    setIsTorchOn(false)
    setHasTorchSupport(false)
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(t('pdfUploader.errors.cameraNotSupported'))
      }

      // Stop any existing stream first
      stopCamera()
      
      // Open modal first
      setIsCameraOpen(true)
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))

      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      
      // Check for torch support
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {} as any
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : {} as any
        
        // Check if torch is supported (usually on mobile devices with rear camera)
        if ('torch' in capabilities || 'torch' in settings) {
          setHasTorchSupport(true)
        }
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e: any) {
      const errorMsg = e.name === 'NotAllowedError' 
        ? t('pdfUploader.errors.cameraAccessDenied')
        : e.name === 'NotFoundError'
        ? t('pdfUploader.errors.noCameraFound')
        : t('pdfUploader.errors.cameraAccessFailed')
      setCameraError(errorMsg)
      setError(errorMsg)
    } finally {
      setIsCameraLoading(false)
    }
  }

  const stopCamera = () => {
    try {
      const mediaStream = streamRef.current || videoRef.current?.srcObject as MediaStream | null
      mediaStream?.getTracks().forEach(track => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
      streamRef.current = null
    } catch {}
    setIsCameraOpen(false)
    setCameraError('')
    setIsTorchOn(false)
    setHasTorchSupport(false)
  }

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newFacingMode)
    if (isCameraOpen) {
      await openCamera()
    }
  }

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorchSupport) return
    
    try {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (!videoTrack) return
      
      const newTorchState = !isTorchOn
      
      // Apply torch constraint
      await videoTrack.applyConstraints({
        advanced: [{ torch: newTorchState } as any]
      })
      
      setIsTorchOn(newTorchState)
    } catch (e) {
      console.error('Failed to toggle torch:', e)
    }
  }

  const takePhoto = async () => {
    const video = videoRef.current
    if (!video) return

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) return

    // Create canvas to capture the photo
    const canvas = canvasRef.current || document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    
    // Draw the video frame to canvas
    ctx.drawImage(video, 0, 0, width, height)
    
    // Convert to blob with high quality
    const blob: Blob | null = await new Promise(resolve => 
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    )
    
    if (!blob) return

    const photoFile = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' })
    
    // Apply compression if needed
    const finalFile = await compressImageIfNeeded(photoFile)
    
    // Update state and preview
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(finalFile)
    setExtractedData(null)
    setSuccess('')
    const url = URL.createObjectURL(finalFile)
    setPreviewUrl(url)
    
    stopCamera()
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setError('')

    try {
  const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', documentType)
  const response = await fetch('/api/pdf-upload', {
        method: 'POST',
        body: formData,
      })

  const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar PDF')
      }

  setExtractedData(result.data)
      setAccounts(result.accounts)
      setSuccess(result.message)

      // Notify listeners (pdf-import page) with full result for card recognition UI
      try {
        window.dispatchEvent(new CustomEvent('pdf-import:success', { detail: result }))
      } catch {}
    } catch (err: any) {
      setError(err.message || 'Erro ao processar arquivo')
    } finally {
      setIsUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!extractedData || !selectedAccountId) {
      setError('Selecione uma conta para prosseguir')
      return
    }

    setIsConfirming(true)
    setError('')

    try {
      const response = await fetch('/api/pdf-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: extractedData.transactions,
          accountId: selectedAccountId,
          receipts: extractedData.receipts || [],
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar transações')
      }

      setSuccess(result.message)
      setExtractedData(null)
      setFile(null)
      setSelectedAccountId('')
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao confirmar transações')
    } finally {
      setIsConfirming(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT')
  }

  return (
    <div className="space-y-4">
      {/* Minimalist container */}
      <div className="">

        <div className="space-y-6">
          {/* Document Type Selection - Minimalist */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{t('pdfUploader.documentType')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { value: 'bank_statement', label: t('pdfUploader.bankStatement') },
                { value: 'credit_card', label: t('pdfUploader.creditCard') },
                { value: 'receipt', label: t('pdfUploader.receipt') }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setDocumentType(type.value as any)}
                  className={`py-3 px-4 rounded-xl border transition-all text-sm font-medium ${
                    documentType === type.value
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 hover:border-gray-400 bg-white text-gray-700'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Capture / Upload - Minimalist */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={openCamera}
                disabled={isCameraLoading}
                className="flex items-center justify-center px-6 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isCameraLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('pdfUploader.startingCamera')}
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    {t('pdfUploader.useCamera')}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center px-6 py-4 bg-white text-gray-900 rounded-xl hover:bg-gray-50 transition-all border border-gray-200"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('pdfUploader.chooseFile')}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            {previewUrl && (
              <div className="mt-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('pdfUploader.preview')}</span>
                  <button
                    type="button"
                    onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setFile(null); setExtractedData(null); }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full max-h-64 object-contain rounded-lg" 
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('pdfUploader.replace')}
                  </button>
                  <button
                    type="button"
                    onClick={openCamera}
                    className="flex-1 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {t('pdfUploader.retake')}
                  </button>
                </div>
              </div>
            )}
          </div>          {file && (
            <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
              <div className="flex items-center">
                <FileText className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-700">{file.name}</span>
              </div>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('pdfUploader.processing')}
                  </>
                ) : (
                  <>{t('pdfUploader.analyze')}</>
                )}
              </button>
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center text-gray-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{success}</span>
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center text-gray-700">
              <XCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {extractedData && (
            <div className="mt-6 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">{t('pdfUploader.type')}</label>
                  <p className="text-sm font-medium">{extractedData.documentType || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">{t('pdfUploader.institution')}</label>
                  <p className="text-sm font-medium">{extractedData.institution || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">{t('pdfUploader.period')}</label>
                  <p className="text-sm font-medium">
                    {extractedData?.period?.start ? formatDate(extractedData.period.start) : '-'}
                    {' '}-{' '}
                    {extractedData?.period?.end ? formatDate(extractedData.period.end) : '-'}
                  </p>
                </div>
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('pdfUploader.selectAccount')}</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                >
                  <option value="">{t('pdfUploader.selectAccountPlaceholder')}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transactions Table */}
              <div>
                <h4 className="text-md font-medium mb-3">{t('pdfUploader.transactionsFound')} ({extractedData.transactions.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3">{t('pdfUploader.date')}</th>
                        <th className="text-left py-2 px-3">{t('pdfUploader.description')}</th>
                        <th className="text-right py-2 px-3">{t('pdfUploader.amount')}</th>
                        <th className="text-left py-2 px-3">{t('pdfUploader.suggestedCategory')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedData.transactions.map((transaction, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-2 px-3">{formatDate(transaction.date)}</td>
                          <td className="py-2 px-3">{transaction.description}</td>
                          <td
                            className={`py-2 px-3 text-right font-medium ${
                              transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {transaction.suggestedCategory}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Receipt Items */}
              {extractedData.receipts && extractedData.receipts.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium mb-3">{t('pdfUploader.receiptItems')}</h4>
                  {extractedData.receipts.map((r, idx) => (
                    <div key={idx} className="mb-5 border border-gray-200 rounded-lg">
                      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">{r.merchant || t('pdfUploader.receipt')}</span>
                          {r.date ? <span className="ml-2 text-gray-500">{formatDate(r.date)}</span> : null}
                        </div>
                        <div className="text-sm text-gray-700">
                          {typeof r.subtotal === 'number' && (
                            <span className="mr-4">{t('pdfUploader.subtotal')}: {formatCurrency(r.subtotal)}</span>
                          )}
                          {typeof r.tax === 'number' && (
                            <span className="mr-4">{t('pdfUploader.tax')}: {formatCurrency(r.tax)}</span>
                          )}
                          {typeof r.total === 'number' && (
                            <span className="font-semibold">{t('pdfUploader.total')}: {formatCurrency(r.total)}</span>
                          )}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3">{t('pdfUploader.item')}</th>
                              <th className="text-right py-2 px-3">{t('pdfUploader.quantity')}</th>
                              <th className="text-right py-2 px-3">{t('pdfUploader.unitPrice')}</th>
                              <th className="text-right py-2 px-3">{t('pdfUploader.total')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.items.map((it, i) => (
                              <tr key={i} className="border-b border-gray-100">
                                <td className="py-2 px-3">{it.description}</td>
                                <td className="py-2 px-3 text-right">{typeof it.quantity === 'number' ? it.quantity : '-'}</td>
                                <td className="py-2 px-3 text-right">{typeof it.unitPrice === 'number' ? formatCurrency(it.unitPrice) : '-'}</td>
                                <td className="py-2 px-3 text-right font-medium">{typeof it.total === 'number' ? formatCurrency(it.total) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirm Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleConfirm}
                  disabled={!selectedAccountId || isConfirming}
                  className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('pdfUploader.saving')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('pdfUploader.confirmAndAdd')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90" onClick={stopCamera} />
          <div className="relative bg-black rounded-2xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex items-center justify-between text-white">
                <h4 className="font-medium">{t('pdfUploader.scanReceipt')}</h4>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Camera viewport */}
            <div className="relative bg-black aspect-[3/4] flex items-center justify-center">
              {cameraError ? (
                <div className="text-center text-white p-6">
                  <Camera className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{cameraError}</p>
                  <button
                    onClick={openCamera}
                    className="mt-3 px-4 py-2 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
                  >
                    {t('pdfUploader.tryAgain')}
                  </button>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover" 
                    playsInline 
                    muted 
                    autoPlay
                  />
                  
                  {/* Minimalist overlay guides */}
                  <div className="absolute inset-8 border border-white/20 rounded-xl pointer-events-none">
                    <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-white rounded-tl"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-white rounded-tr"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-white rounded-bl"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-white rounded-br"></div>
                  </div>

                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white/60 text-center pointer-events-none">
                    <div className="text-xs bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                      {t('pdfUploader.positionReceipt')}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
              <div className="flex items-center justify-between text-white">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                  {hasTorchSupport && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-3 rounded-full transition-all backdrop-blur-sm ${
                        isTorchOn 
                          ? 'bg-yellow-500/30 hover:bg-yellow-500/40 text-yellow-300' 
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                      title={isTorchOn ? t('pdfUploader.flashlightOff') : t('pdfUploader.flashlightOn')}
                    >
                      <Zap className="h-5 w-5" fill={isTorchOn ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={takePhoto}
                  disabled={!!cameraError}
                  className="w-16 h-16 rounded-full bg-white hover:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <div className="w-full h-full rounded-full bg-white"></div>
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
