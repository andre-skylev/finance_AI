"use client"

import { useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PDFUploader from '@/components/PDFUploader'
import KnownBanks from '@/components/KnownBanks'
import { FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

export default function PDFImportPage() {
  const { t } = useLanguage()
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSuccess = () => {
    // Trigger refresh of any data that might have changed
    setRefreshKey(prev => prev + 1)
  }

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
                Voltar para Transações
              </Link>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
              <FileText className="h-6 w-6 mr-3" />
              Import de Extratos PDF
            </h1>
            <p className="text-gray-600">
              Carregue extratos bancários ou faturas de cartão em PDF para importar transações automaticamente
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Como funciona:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. Selecione um arquivo PDF do seu extrato bancário ou fatura de cartão</li>
            <li>2. O sistema irá extrair automaticamente o texto e identificar as transações</li>
            <li>3. Revise os dados extraídos e selecione a conta para associar</li>
            <li>4. Confirme para adicionar todas as transações ao seu banco de dados</li>
          </ul>
        </div>

        {/* PDF Uploader Component */}
        <PDFUploader onSuccess={handleSuccess} key={refreshKey} />

        {/* Known Banks Component */}
        <KnownBanks />

        {/* Supported Banks */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Bancos e Cartões Suportados</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 border border-gray-200 rounded-lg">
              <div className="w-12 h-12 bg-red-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                <span className="text-red-600 font-bold text-xs">CGD</span>
              </div>
              <p className="text-xs text-gray-600">Caixa Geral</p>
            </div>
            <div className="text-center p-3 border border-gray-200 rounded-lg">
              <div className="w-12 h-12 bg-orange-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                <span className="text-orange-600 font-bold text-xs">BCP</span>
              </div>
              <p className="text-xs text-gray-600">Millennium</p>
            </div>
            <div className="text-center p-3 border border-gray-200 rounded-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xs">NU</span>
              </div>
              <p className="text-xs text-gray-600">Nubank</p>
            </div>
            <div className="text-center p-3 border border-gray-200 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xs">ITU</span>
              </div>
              <p className="text-xs text-gray-600">Itaú</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            O sistema usa IA para reconhecer padrões de diferentes instituições financeiras. 
            Mesmo bancos não listados podem funcionar se o PDF contiver texto legível.
          </p>
        </div>

        {/* Tips */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Dicas para melhor resultado:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Use PDFs originais dos bancos (não fotografias ou scans de baixa qualidade)</li>
            <li>• Certifique-se de que o PDF contém texto selecionável</li>
            <li>• Extratos mais simples funcionam melhor que documentos muito complexos</li>
            <li>• Revise sempre os dados extraídos antes de confirmar</li>
          </ul>
        </div>
      </div>
    </ProtectedRoute>
  )
}
