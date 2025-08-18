'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, AlertCircle, CheckCircle, CreditCard, FileSpreadsheet } from 'lucide-react'
import DocumentUploadConsent from '@/components/DocumentUploadConsent'

interface DocumentUploadZoneProps {
  onUploadComplete?: (result: any) => void
  className?: string
}

export default function DocumentUploadZone({ onUploadComplete, className = '' }: DocumentUploadZoneProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [showConsent, setShowConsent] = useState(false)
  const [uploadHistory, setUploadHistory] = useState<Array<{
    id: string
    fileName: string
    type: string
    status: 'success' | 'error'
    message: string
    timestamp: Date
  }>>([])
  const [ocrUsage, setOcrUsage] = useState<{
    dailyLimit: number
    currentUsage: number
    remaining: number
  } | null>(null)

  // Check OCR usage on mount
  useState(() => {
    fetch('/api/pdf-upload')
      .then(res => res.json())
      .then(data => {
        if (data.dailyLimit) {
          setOcrUsage(data)
        }
      })
      .catch(console.error)
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        addToHistory({
          fileName: file.name,
          type: 'error',
          status: 'error',
          message: 'Only PDF files are supported'
        })
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        addToHistory({
          fileName: file.name,
          type: 'error',
          status: 'error',
          message: 'File size must be less than 10MB'
        })
        return
      }

      setUploadedFile(file)
      setShowConsent(true)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024
  })

  const addToHistory = (entry: Omit<typeof uploadHistory[0], 'id' | 'timestamp'>) => {
    setUploadHistory(prev => [{
      ...entry,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    }, ...prev].slice(0, 5))
  }

  const handleUploadConfirm = async (result: any, options: any) => {
    if (uploadedFile) {
      addToHistory({
        fileName: uploadedFile.name,
        type: result.metadata.type,
        status: 'success',
        message: `Imported ${result.transactions.length} transactions`
      })
    }

    // Refresh OCR usage
    try {
      const res = await fetch('/api/pdf-upload')
      const data = await res.json()
      if (data.dailyLimit) {
        setOcrUsage(data)
      }
    } catch (error) {
      console.error('Failed to refresh OCR usage:', error)
    }

    setShowConsent(false)
    setUploadedFile(null)
    
    if (onUploadComplete) {
      onUploadComplete(result)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'credit_card_statement':
        return <CreditCard className="w-4 h-4" />
      case 'bank_statement':
        return <FileSpreadsheet className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  return (
    <>
      <div className={`space-y-6 ${className}`}>
        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200 
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center
              ${isDragActive ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-800'}
            `}>
              <Upload className={`w-8 h-8 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            </div>
            
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {isDragActive ? 'Drop your PDF here' : 'Upload bank statement or credit card bill'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Drag & drop or click to select • PDF only • Max 10MB
              </p>
            </div>

            {/* Supported Banks */}
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {['Novo Banco', 'Millennium BCP', 'Santander', 'CGD', 'BPI'].map(bank => (
                <span 
                  key={bank}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
                >
                  {bank}
                </span>
              ))}
              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">
                + Many more
              </span>
            </div>
          </div>
        </div>

        {/* OCR Usage Info */}
        {ocrUsage && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">OCR Processing Limit</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    For scanned documents
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {ocrUsage.remaining} / {ocrUsage.dailyLimit}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Remaining today
                </p>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(ocrUsage.remaining / ocrUsage.dailyLimit) * 100}%` }}
              />
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              💡 Tip: Use digital PDFs from your bank to avoid OCR limits
            </p>
          </div>
        )}

        {/* Upload History */}
        {uploadHistory.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Uploads</h3>
            <div className="space-y-2">
              {uploadHistory.map(entry => (
                <div 
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {entry.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div className="flex items-center gap-2">
                      {getDocumentIcon(entry.type)}
                      <div>
                        <p className="text-sm font-medium">{entry.fileName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.message}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Smart Recognition</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Automatically detects bank, cards, and transaction types
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Multiple Cards</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Handles statements with multiple cards and shared limits
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Installments</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Tracks installment payments and remaining balances
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsent && uploadedFile && (
        <DocumentUploadConsent
          file={uploadedFile}
          onClose={() => {
            setShowConsent(false)
            setUploadedFile(null)
          }}
          onConfirm={handleUploadConfirm}
          autoProcess={false}
        />
      )}
    </>
  )
}