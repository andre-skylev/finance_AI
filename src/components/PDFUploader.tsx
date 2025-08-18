import React, { useState } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react'

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
}

interface Account {
  id: string
  name: string
  type: string
}

interface PDFUploaderProps {
  onSuccess?: () => void
}

export default function PDFUploader({ onSuccess }: PDFUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Apenas arquivos PDF são aceitos')
        return
      }
      setFile(selectedFile)
      setError('')
      setExtractedData(null)
      setSuccess('')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

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
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Import de Extratos PDF
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar arquivo PDF
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
            />
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">{file.name}</span>
              </div>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Analisar PDF
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <XCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        )}
      </div>

      {/* Extracted Data Section */}
      {extractedData && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Dados Extraídos</h3>

          <div className="space-y-4">
            {/* Document Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">
                  Tipo de Documento
                </label>
                <p className="text-sm font-medium">
                  {extractedData.documentType === 'bank_statement' ? 'Extrato Bancário' : 'Fatura Cartão'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">
                  Instituição
                </label>
                <p className="text-sm font-medium">{extractedData.institution}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">
                  Período
                </label>
                <p className="text-sm font-medium">
                  {formatDate(extractedData.period.start)} - {formatDate(extractedData.period.end)}
                </p>
              </div>
            </div>

            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecionar Conta para Associar
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              >
                <option value="">Selecione uma conta...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Transactions Table */}
            <div>
              <h4 className="text-md font-medium mb-3">
                Transações Encontradas ({extractedData.transactions.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3">Data</th>
                      <th className="text-left py-2 px-3">Descrição</th>
                      <th className="text-right py-2 px-3">Valor</th>
                      <th className="text-left py-2 px-3">Categoria Sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.transactions.map((transaction, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 px-3">{formatDate(transaction.date)}</td>
                        <td className="py-2 px-3">{transaction.description}</td>
                        <td className={`py-2 px-3 text-right font-medium ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
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
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar e Adicionar Transações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
