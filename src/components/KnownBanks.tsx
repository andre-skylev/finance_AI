import React, { useState, useEffect } from 'react'
import { Building2, MapPin, DollarSign, TrendingUp, Star } from 'lucide-react'

interface BankPattern {
  institution_name: string
  country: string
  currency: string
  confidence_level: string
  usage_count: number
}

interface KnownBanksProps {
  onBankSelect?: (bank: BankPattern) => void
}

export default function KnownBanks({ onBankSelect }: KnownBanksProps) {
  const [bankPatterns, setBankPatterns] = useState<BankPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [patternsByRegion, setPatternsByRegion] = useState<Record<string, BankPattern[]>>({})

  useEffect(() => {
    fetchBankPatterns()
  }, [])

  const fetchBankPatterns = async () => {
    try {
      const response = await fetch('/api/bank-patterns')
      const data = await response.json()
      setBankPatterns(data.patterns || [])
      setPatternsByRegion(data.patternsByRegion || {})
    } catch (error) {
      console.error('Erro ao carregar padrões de bancos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <Star className="h-3 w-3" />
      case 'medium': return <TrendingUp className="h-3 w-3" />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (bankPatterns.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Building2 className="h-5 w-5 mr-2" />
          Bancos Conhecidos
        </h3>
        <p className="text-gray-500 text-center py-8">
          Nenhum banco identificado ainda. Faça upload do primeiro extrato para começar!
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Building2 className="h-5 w-5 mr-2" />
          Bancos Conhecidos ({bankPatterns.length})
        </h3>
        <div className="text-sm text-gray-500">
          Sistema aprendeu com extratos anteriores
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(patternsByRegion).map(([region, banks]) => (
          <div key={region}>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              {region === 'Unknown' ? 'Região não identificada' : region}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {banks.map((bank, index) => (
                <div
                  key={`${bank.institution_name}-${index}`}
                  className={`p-3 border border-gray-200 rounded-lg hover:border-primary/50 transition-colors ${
                    onBankSelect ? 'cursor-pointer hover:bg-gray-50' : ''
                  }`}
                  onClick={() => onBankSelect?.(bank)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-gray-900 text-sm leading-tight">
                      {bank.institution_name}
                    </h5>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(bank.confidence_level)}`}>
                      {getConfidenceIcon(bank.confidence_level)}
                      <span className="ml-1">{bank.confidence_level}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center">
                      <DollarSign className="h-3 w-3 mr-1" />
                      {bank.currency || 'N/A'}
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {bank.usage_count} uso{bank.usage_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>💡 Dica:</strong> Quanto mais extratos você processar, mais inteligente o sistema fica 
          para reconhecer bancos automaticamente. Os padrões são compartilhados para beneficiar todos os usuários.
        </p>
      </div>
    </div>
  )
}
