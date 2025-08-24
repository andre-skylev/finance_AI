"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Camera, RotateCcw, X, Zap } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCurrency } from '@/hooks/useCurrency'

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
  transactions?: Transaction[]
  receipts?: Array<{
    merchant?: string
    date?: string
    subtotal?: number
    tax?: number
    total?: number
  table?: { headers: string[]; rows: string[][]; columnSemantics?: { description?: number; quantity?: number; unitPrice?: number; total?: number; code?: number; tax?: number } }
  items: Array<{ code?: string; description: string; quantity?: number; unitPrice?: number; total?: number; taxRate?: number; taxAmount?: number }>
  }>
}

interface Account {
  id: string
  name: string
  type: string
}

interface CreditCardOption {
  id: string
  bank_name: string
  card_name: string
  last_four_digits?: string
  card_type: 'credit' | 'debit'
  is_active?: boolean
}

interface PDFUploaderProps {
  onSuccess?: () => void
  defaultDocumentType?: 'bank_statement' | 'credit_card' | 'receipt'
  preselectedAccountId?: string
  forcedTarget?: string // e.g., 'acc:<id>' | 'cc:<id>' | 'rec'
}

export default function PDFUploader({ onSuccess, preselectedAccountId, forcedTarget }: PDFUploaderProps) {
  const { t, language } = useLanguage()
  const { formatAmount } = useCurrency()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [creditCards, setCreditCards] = useState<CreditCardOption[]>([])
  const [selectedTarget, setSelectedTarget] = useState<string>('') // e.g., acc:123 or cc:456
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  
  // Estados para edição de transações
  const [editableTransactions, setEditableTransactions] = useState<Transaction[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number>(-1)
  
  // Estados para progresso do upload
  const [uploadProgress, setUploadProgress] = useState(0)
  const [progressSteps, setProgressSteps] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState('')
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null)
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string>('')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [hasTorchSupport, setHasTorchSupport] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  // Document type is auto-detected server-side; no selection UI

  // Inicializar transações editáveis quando extractedData muda
  useEffect(() => {
    if (extractedData?.transactions) {
      setEditableTransactions([...extractedData.transactions])
    }
  }, [extractedData])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Preselect destination from URL query (account_id or credit_card_id) or prop; allow forced target
  useEffect(() => {
    if (forcedTarget) {
      setSelectedTarget(forcedTarget)
      return
    }
    try {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      const acc = sp?.get('account_id')
      const cc = sp?.get('credit_card_id')
      if (!selectedTarget) {
        if (cc) setSelectedTarget(`cc:${cc}`)
        else if (acc) setSelectedTarget(`acc:${acc}`)
        else if (preselectedAccountId) setSelectedTarget(`acc:${preselectedAccountId}`)
      }
    } catch {}
  }, [preselectedAccountId, selectedTarget, forcedTarget])

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
        setError(t('pdfUploader.errors.fileTypeNotSupported'))
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
    setSuccess('')
    setUploadProgress(0)
    setProgressSteps([])
    setCurrentStep('')
    setEstimatedTimeRemaining(null)
    setProcessingStartTime(null)

    try {
      // Passo 1: Preparando upload
      updateProgress(t('pdfUploader.progress.preparing'), 5)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const formData = new FormData()
      formData.append('file', file)
      // Enable server-side auto-detection
      formData.append('auto', '1')
      
      // Passo 2: Enviando arquivo
      updateProgress(t('pdfUploader.progress.uploading'), 15)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Passo 3: Iniciando processamento
      updateProgress(t('pdfUploader.progress.processing'), 25)
      setProcessingStartTime(Date.now())

      const startTime = Date.now()
      
      // Simular progresso durante o processamento real
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const estimatedTotal = 60000 // 60 segundos estimados
        const serverProgress = Math.min(90, 25 + (elapsed / estimatedTotal) * 65) // 25% a 90%
        updateProgress(t('pdfUploader.progress.processing'), Math.floor(serverProgress))
      }, 2000)

      const response = await fetch('/api/pdf-upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('pdfUploader.errors.processingFailed'))
      }

      // Passo 4: Analisando dados
      updateProgress(t('pdfUploader.progress.analyzing'), 95)
      await new Promise(resolve => setTimeout(resolve, 1000))

      setExtractedData(result.data)
      setAccounts(result.accounts)
      setCreditCards(result.creditCards || [])
      
      // Passo 5: Concluído
      updateProgress(t('pdfUploader.progress.completed'), 100)
      setSuccess(result.message)

      // Notify listeners (pdf-import page) with full result for card recognition UI
      try {
        window.dispatchEvent(new CustomEvent('pdf-import:success', { detail: result }))
      } catch {}
    } catch (err: any) {
      setError(err.message || t('pdfUploader.errors.processingFailed'))
      setUploadProgress(0)
      setCurrentStep('')
    } finally {
      setTimeout(() => {
        setIsUploading(false)
        if (!error) {
          setUploadProgress(0)
          setCurrentStep('')
          setProgressSteps([])
        }
      }, 2000) // Keep progress visible for 2 seconds after completion
    }
  }

  const handleConfirm = async () => {
    const target = forcedTarget || selectedTarget
    if (!extractedData || !target) {
      setError(t('pdfUploader.errors.selectTargetRequired'))
      return
    }

    setIsConfirming(true)
    setError('')

    try {
      console.log('PDF Confirm - Enviando dados:', {
        transactions: editableTransactions || [],
        target,
        receipts: extractedData.receipts || [],
      })

      const response = await fetch('/api/pdf-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: editableTransactions || [],
          target, // acc:ID | cc:ID | rec
          receipts: extractedData.receipts || [],
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('pdfUploader.errors.errorSavingTransactions'))
      }

      setSuccess(result.message)
      setExtractedData(null)
      setFile(null)
  if (!forcedTarget) setSelectedTarget('')
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || t('pdfUploader.errors.errorConfirmingTransactions'))
    } finally {
      setIsConfirming(false)
    }
  }

  // Funções para edição de transações
  const startEditing = (index: number) => {
    setEditingIndex(index)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setEditingIndex(-1)
    setIsEditing(false)
    // Restaurar valores originais
    if (extractedData?.transactions) {
      setEditableTransactions([...extractedData.transactions])
    }
  }

  const saveEdit = (index: number, updatedTransaction: Transaction) => {
    const newTransactions = [...editableTransactions]
    newTransactions[index] = updatedTransaction
    setEditableTransactions(newTransactions)
    setEditingIndex(-1)
    setIsEditing(false)
  }

  const addNewTransaction = () => {
    const newTransaction: Transaction = {
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: 0,
      suggestedCategory: '',
    }
    setEditableTransactions([...editableTransactions, newTransaction])
    setEditingIndex(editableTransactions.length)
    setIsEditing(true)
  }

  const deleteTransaction = (index: number) => {
    const newTransactions = editableTransactions.filter((_, i) => i !== index)
    setEditableTransactions(newTransactions)
  }

  // Função para obter todas as categorias incluindo subcategorias
  const getAllCategories = () => {
    const mainCategories = [
      t('categories.defaults.alimentacao'),
      t('categories.defaults.supermercado'), 
      t('categories.defaults.transporte'),
      t('categories.defaults.habitacao'),
      t('categories.defaults.servicosPublicos'),
      t('categories.defaults.saude'),
      t('categories.defaults.educacao'),
      t('categories.defaults.lazer'),
      t('categories.defaults.viagens'),
      t('categories.defaults.compras'),
      t('categories.defaults.assinaturas'),
      t('categories.defaults.impostos'),
      t('categories.defaults.taxas'),
      t('categories.defaults.seguros'),
      t('categories.defaults.pets'),
      t('categories.defaults.presentes'),
      t('categories.defaults.doacoes'),
      t('categories.defaults.investimentos'),
      t('categories.defaults.outros'),
      t('categories.defaults.salario'),
      t('categories.defaults.freelance'),
      t('categories.defaults.reembolsos')
    ]

    const subcategories = [
      // Subcategorias de Supermercado
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.cestaBasica')}`,
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.higieneELimpeza')}`,
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.superfluos')}`,
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.bebidas')}`,
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.padaria')}`,
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.acougue')}`,
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.frutasEVerduras')}`,
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.congelados')}`,
      `${t('categories.defaults.supermercado')} - ${t('categories.subcategories.supermercado.petiscos')}`,
      
      // Subcategorias de Transporte
      `${t('categories.defaults.transporte')} - ${t('categories.subcategories.transporte.combustivel')}`,
      `${t('categories.defaults.transporte')} - ${t('categories.subcategories.transporte.manutencao')}`,
      `${t('categories.defaults.transporte')} - ${t('categories.subcategories.transporte.estacionamento')}`,
      `${t('categories.defaults.transporte')} - ${t('categories.subcategories.transporte.pedagio')}`,
      `${t('categories.defaults.transporte')} - ${t('categories.subcategories.transporte.transportePublico')}`,
      
      // Subcategorias de Saúde
      `${t('categories.defaults.saude')} - ${t('categories.subcategories.saude.medicamentos')}`,
      `${t('categories.defaults.saude')} - ${t('categories.subcategories.saude.consultas')}`,
      `${t('categories.defaults.saude')} - ${t('categories.subcategories.saude.exames')}`,
      `${t('categories.defaults.saude')} - ${t('categories.subcategories.saude.seguroSaude')}`
    ]

    return [...mainCategories, ...subcategories].sort()
  }

  const calculateTotal = () => {
    return editableTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
  }

  // This function is replaced by getAllCategories() which includes hierarchical subcategories

  // Função para atualizar progresso
  const updateProgress = (step: string, progress: number) => {
    setCurrentStep(step)
    setUploadProgress(progress)
    setProgressSteps(prev => {
      if (!prev.includes(step)) {
        return [...prev, step]
      }
      return prev
    })

    // Calculate estimated time remaining during processing
    if (processingStartTime && progress > 25 && progress < 95) {
      const elapsed = Date.now() - processingStartTime
      const estimatedTotal = (elapsed / (progress - 25)) * (95 - 25) // Estimate based on processing phase
      const remaining = Math.max(0, estimatedTotal - elapsed)
      setEstimatedTimeRemaining(Math.ceil(remaining / 1000)) // Convert to seconds
    } else {
      setEstimatedTimeRemaining(null)
    }
  }

  const formatDate = (dateString: string) => {
    const loc = language === 'pt' ? 'pt-PT' : 'en-US'
    return new Date(dateString).toLocaleDateString(loc)
  }

  // Componente para editar uma transação
  const TransactionEditRow = ({ transaction, index, onSave, onCancel }: {
    transaction: Transaction
    index: number
    onSave: (updatedTransaction: Transaction) => void
    onCancel: () => void
  }) => {
    const [editForm, setEditForm] = useState(transaction)

    return (
      <tr className="bg-blue-50 border border-blue-200">
        <td className="px-4 py-2">
          <input
            type="date"
            value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <input
            type="text"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            className="w-full px-2 py-1 border rounded text-sm"
            placeholder={t('pdfUploader.table.description')}
          />
        </td>
        <td className="px-4 py-2">
          <input
            type="number"
            step="0.01"
            value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <select
            value={editForm.suggestedCategory}
            onChange={(e) => setEditForm({ ...editForm, suggestedCategory: e.target.value })}
            className="w-full px-2 py-1 border rounded text-sm bg-white"
          >
            <option value="">{t('pdfUploader.selectCategory') || 'Select category...'}</option>
            {getAllCategories().map((category: string) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2 space-x-2">
          <button
            onClick={() => onSave(editForm)}
            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
            title={t('common.save')}
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
            title={t('common.cancel')}
          >
            Cancel
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-4">
      {/* Minimalist container */}
      <div className="">

        <div className="space-y-6">
          {/* Document type selector removed; auto-detection in API */}

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
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center px-6 py-4 bg-white text-gray-900 rounded-xl hover:bg-gray-50 transition-all border border-gray-200"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('pdfUploader.chooseFile')}
              </button>
            </div>
            {/* Input para câmera */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            {/* Input para galeria */}
            <input
              ref={galleryInputRef}
              type="file"
              accept=".pdf,image/*"
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
                    className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
                  >
                    <Camera className="h-3 w-3 mr-1" />
                    {t('pdfUploader.useCamera')}
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    {t('pdfUploader.chooseFile')}
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

          {/* Progress Bar */}
          {isUploading && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {currentStep}
                  </span>
                  <div className="text-right">
                    <span className="text-sm text-gray-500">
                      {uploadProgress}%
                    </span>
                    {estimatedTimeRemaining && estimatedTimeRemaining > 5 && (
                      <div className="text-xs text-gray-400">
                        ~{estimatedTimeRemaining}s {t('pdfUploader.progress.remaining')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Steps completed */}
              {progressSteps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 mb-2">
                    {t('pdfUploader.progress.stepsCompleted')}
                  </p>
                  {progressSteps.map((step, index) => (
                    <div key={index} className="flex items-center text-xs text-gray-600">
                      <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Encouraging messages */}
              <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                {uploadProgress < 30 && (
                  <span>{t('pdfUploader.progress.tip1')}</span>
                )}
                {uploadProgress >= 30 && uploadProgress < 70 && (
                  <span>{t('pdfUploader.progress.tip2')}</span>
                )}
                {uploadProgress >= 70 && uploadProgress < 100 && (
                  <span>{t('pdfUploader.progress.tip3')}</span>
                )}
                {uploadProgress === 100 && (
                  <span>{t('pdfUploader.progress.tip4')}</span>
                )}
              </div>
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

              {/* Account/Card Selection (hidden when forcedTarget is provided) */}
              {!forcedTarget && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('pdfUploader.selectAccount')}</label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                >
                  <option value="">{t('pdfUploader.selectAccountPlaceholder')}</option>
                  {accounts.length > 0 && (
                    <optgroup label={t('pdfUploader.optgroups.accounts')}>
                      {accounts.map((account) => (
                        <option key={`acc:${account.id}`} value={`acc:${account.id}`}>
                          {account.name} ({account.type})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {creditCards.length > 0 && (
                    <optgroup label={t('pdfUploader.optgroups.creditCards')}>
                      {creditCards.map((cc) => (
                        <option key={`cc:${cc.id}`} value={`cc:${cc.id}`}>
                          {cc.bank_name} {cc.card_name}{cc.last_four_digits ? ` •••• ${cc.last_four_digits}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              )}

              {/* Transactions Table */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-md font-medium">
                    {t('pdfUploader.transactionsFound')} ({editableTransactions.length})
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={addNewTransaction}
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                      disabled={isEditing}
                    >
                      + {t('pdfUploader.addTransaction')}
                    </button>
                    <div className="px-3 py-1 bg-gray-100 rounded text-sm font-medium">
                      Total: {formatAmount(calculateTotal())}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3">{t('pdfUploader.date')}</th>
                        <th className="text-left py-2 px-3">{t('pdfUploader.description')}</th>
                        <th className="text-right py-2 px-3">{t('pdfUploader.amount')}</th>
                        <th className="text-left py-2 px-3">{t('pdfUploader.suggestedCategory')}</th>
                        <th className="text-center py-2 px-3">{t('pdfUploader.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editableTransactions.map((transaction, index) => (
                        editingIndex === index ? (
                          <TransactionEditRow
                            key={index}
                            transaction={transaction}
                            index={index}
                            onSave={(updatedTransaction) => saveEdit(index, updatedTransaction)}
                            onCancel={cancelEditing}
                          />
                        ) : (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3">{formatDate(transaction.date)}</td>
                            <td className="py-2 px-3">{transaction.description}</td>
                            <td
                              className={`py-2 px-3 text-right font-medium ${
                                transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {formatAmount(transaction.amount)}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {transaction.suggestedCategory}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center space-x-1">
                              <button
                                onClick={() => startEditing(index)}
                                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                disabled={isEditing}
                                title={t('common.edit')}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteTransaction(index)}
                                className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                disabled={isEditing}
                                title={t('common.delete')}
                              >
                                Del
                              </button>
                            </td>
                          </tr>
                        )
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
                            <span className="mr-4">{t('pdfUploader.subtotal')}: {formatAmount(r.subtotal)}</span>
                          )}
                          {typeof r.tax === 'number' && (
                            <span className="mr-4">{t('pdfUploader.tax')}: {formatAmount(r.tax)}</span>
                          )}
                          {typeof r.total === 'number' && (
                            <span className="font-semibold">{t('pdfUploader.total')}: {formatAmount(r.total)}</span>
                          )}
                        </div>
                      </div>
                      {/* Dynamic table detected from headers (raw) */}
                      {r.table && r.table.headers?.length && r.table.rows?.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                {r.table?.headers.map((h, i) => (
                                  <th key={i} className={`py-2 px-3 ${i === (r.table?.columnSemantics?.total ?? -1) ? 'text-right' : 'text-left'}`}>{h || '-'}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {r.table?.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-gray-100">
                                  {row.map((cell, ci) => (
                                    <td key={ci} className={`py-2 px-3 ${ci === (r.table?.columnSemantics?.total ?? -1) || ci === (r.table?.columnSemantics?.unitPrice ?? -1) ? 'text-right' : ''}`}>{cell || '-'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3">{t('pdfUploader.item')}</th>
                              <th className="text-left py-2 px-3">{t('pdfUploader.code')}</th>
                              <th className="text-right py-2 px-3">{t('pdfUploader.quantity')}</th>
                              <th className="text-right py-2 px-3">{t('pdfUploader.unitPrice')}</th>
                              <th className="text-right py-2 px-3">{t('pdfUploader.taxPercent')}</th>
                              <th className="text-right py-2 px-3">{t('pdfUploader.total')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.items.map((it, i) => (
                              <tr key={i} className="border-b border-gray-100">
                                <td className="py-2 px-3">{it.description}</td>
                                <td className="py-2 px-3">{it.code || '-'}</td>
                                <td className="py-2 px-3 text-right">{typeof it.quantity === 'number' ? it.quantity : '-'}</td>
                                <td className="py-2 px-3 text-right">{typeof it.unitPrice === 'number' ? formatAmount(it.unitPrice) : '-'}</td>
                                <td className="py-2 px-3 text-right">{typeof it.taxRate === 'number' ? `${it.taxRate}%` : '-'}</td>
                                <td className="py-2 px-3 text-right font-medium">{typeof it.total === 'number' ? formatAmount(it.total) : '-'}</td>
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
                  disabled={!(forcedTarget || selectedTarget) || isConfirming}
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
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/90" onClick={stopCamera} />
          <div className="relative w-full h-full bg-black md:max-w-lg md:h-auto md:mx-auto md:my-6 md:rounded-2xl md:shadow-2xl overflow-hidden">
            {/* Header */}
            <div
              className="absolute top-0 left-0 right-0 z-10 px-4 bg-gradient-to-b from-black/50 to-transparent"
              style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))', paddingBottom: 8 }}
            >
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

            {/* Camera viewport (fills screen on mobile) */}
            <div className="relative bg-black w-full h-full md:aspect-[3/4] md:h-auto flex items-center justify-center">
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

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60 text-center pointer-events-none">
                    <div className="text-xs bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                      {t('pdfUploader.positionReceipt')}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Controls */}
            <div
              className="absolute bottom-0 left-0 right-0 px-6 bg-gradient-to-t from-black/70 to-transparent"
              style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', paddingTop: 12 }}
            >
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
