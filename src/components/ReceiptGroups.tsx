"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '@/contexts/LanguageContext'
import { ChevronDown, ChevronRight, Store, Calendar, Euro, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ReceiptGroup = {
  receipt_id: string
  merchant_name: string
  receipt_date: string
  total: number
  subtotal: number | null
  tax: number | null
  transactions: Array<{
    id: string
    amount: number
    description: string
    transaction_date: string
    currency: string
    type: string
    category?: { name: string; color?: string; icon?: string }
    account?: { name: string; bank_name?: string }
  }>
  transaction_count: number
  total_amount: number
}

export default function ReceiptGroups() {
  const [receiptGroups, setReceiptGroups] = useState<ReceiptGroup[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      fetchReceiptGroups()
    }
  }, [user])

  const fetchReceiptGroups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/receipts/grouped-transactions')
      
      if (!response.ok) {
        throw new Error('Failed to fetch receipt groups')
      }
      
      const result = await response.json()
      if (result.success) {
        setReceiptGroups(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      console.error('Error fetching receipt groups:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (receiptId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(receiptId)) {
      newExpanded.delete(receiptId)
    } else {
      newExpanded.add(receiptId)
    }
    setExpandedGroups(newExpanded)
  }

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="w-full">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Erro ao carregar agrupamentos: {error}</p>
            <Button onClick={fetchReceiptGroups} className="mt-2" variant="outline">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (receiptGroups.length === 0) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">Nenhum agrupamento de recibo encontrado</p>
            <p className="text-sm text-gray-400 mt-2">
              Faça upload de recibos para ver os agrupamentos aqui
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Receipt className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Agrupamentos de Recibos</h2>
        <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
          {receiptGroups.length}
        </span>
      </div>

      {receiptGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.receipt_id)
        
        return (
          <Card key={group.receipt_id} className="w-full">
            <CardHeader className="pb-3">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleGroup(group.receipt_id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                  )}
                  <Store className="h-5 w-5 text-blue-500" />
                  <div>
                    <CardTitle className="text-lg">
                      {group.merchant_name || 'Estabelecimento'}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(group.receipt_date)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Euro className="h-4 w-4" />
                        {formatCurrency(Math.abs(group.total_amount))}
                      </div>
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                        {group.transaction_count} {group.transaction_count === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-red-600">
                    {formatCurrency(Math.abs(group.total_amount))}
                  </div>
                  <div className="text-sm text-gray-500">
                    Total do recibo
                  </div>
                </div>
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="pt-0">
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-gray-700">Detalhes das transações:</h4>
                  <div className="space-y-2">
                    {group.transactions.map((transaction) => (
                      <div 
                        key={transaction.id} 
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {transaction.description}
                          </div>
                          <div className="text-sm text-gray-500 flex gap-4">
                            {transaction.category && (
                              <span className="flex items-center gap-1">
                                <span 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: transaction.category.color || '#6B7280' }}
                                ></span>
                                {transaction.category.name}
                              </span>
                            )}
                            {transaction.account && (
                              <span>
                                {transaction.account.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-red-600">
                            {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(transaction.transaction_date)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
