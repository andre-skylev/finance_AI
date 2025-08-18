"use client"

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '@/contexts/LanguageContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CreditCard, CalendarDays, TrendingUp, DollarSign, Clock } from 'lucide-react'

interface Installment {
  id: string
  credit_card_id: string
  credit_card_name: string
  merchant_name: string
  transaction_date: string
  total_amount: number
  installment_number: number
  total_installments: number
  amount: number
  currency: string
  tan_rate?: number
  original_amount?: number
  description?: string
}

interface InstallmentGroup {
  reference_id: string
  merchant_name: string
  original_amount: number
  total_installments: number
  paid_installments: number
  remaining_amount: number
  tan_rate?: number
  installments: Installment[]
  credit_card_name: string
  next_payment_date?: string
}

export default function InstallmentsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = createClient()
  const [installmentGroups, setInstallmentGroups] = useState<InstallmentGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  useEffect(() => {
    if (user) {
      fetchInstallments()
    }
  }, [user])

  const fetchInstallments = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .select(`
          *,
          credit_cards!inner(
            id,
            card_name,
            bank_name
          )
        `)
        .eq('user_id', user?.id)
        .gt('installments', 1)
        .order('transaction_date', { ascending: false })

      if (error) throw error

      // Agrupar por merchant + original_amount (mesmo parcelamento)
      const groups: Record<string, InstallmentGroup> = {}
      
      data?.forEach((transaction: any) => {
        const groupKey = `${transaction.merchant_name}_${transaction.original_amount || transaction.amount * transaction.installments}`
        
        if (!groups[groupKey]) {
          groups[groupKey] = {
            reference_id: groupKey,
            merchant_name: transaction.merchant_name,
            original_amount: transaction.original_amount || transaction.amount * transaction.installments,
            total_installments: transaction.installments,
            paid_installments: 0,
            remaining_amount: 0,
            tan_rate: transaction.tan_rate,
            installments: [],
            credit_card_name: `${transaction.credit_cards.bank_name} ${transaction.credit_cards.card_name}`,
          }
        }
        
        groups[groupKey].installments.push({
          id: transaction.id,
          credit_card_id: transaction.credit_card_id,
          credit_card_name: `${transaction.credit_cards.bank_name} ${transaction.credit_cards.card_name}`,
          merchant_name: transaction.merchant_name,
          transaction_date: transaction.transaction_date,
          total_amount: transaction.original_amount || transaction.amount * transaction.installments,
          installment_number: transaction.installment_number,
          total_installments: transaction.installments,
          amount: transaction.amount,
          currency: transaction.currency,
          tan_rate: transaction.tan_rate,
          original_amount: transaction.original_amount,
          description: transaction.description
        })
      })

      // Calcular estatísticas para cada grupo
      Object.values(groups).forEach(group => {
        group.installments.sort((a, b) => a.installment_number - b.installment_number)
        group.paid_installments = group.installments.length
        group.remaining_amount = group.original_amount - (group.paid_installments * (group.installments[0]?.amount || 0))
        
        // Estimar próxima data de pagamento
        const lastPayment = group.installments[group.installments.length - 1]
        if (lastPayment && group.paid_installments < group.total_installments) {
          const lastDate = new Date(lastPayment.transaction_date)
          lastDate.setMonth(lastDate.getMonth() + 1)
          group.next_payment_date = lastDate.toISOString().split('T')[0]
        }
      })

      setInstallmentGroups(Object.values(groups))
    } catch (error) {
      console.error('Erro ao buscar parcelamentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredGroups = () => {
    switch (filter) {
      case 'active':
        return installmentGroups.filter(group => group.paid_installments < group.total_installments)
      case 'completed':
        return installmentGroups.filter(group => group.paid_installments >= group.total_installments)
      default:
        return installmentGroups
    }
  }

  const getTotalStats = () => {
    const active = installmentGroups.filter(g => g.paid_installments < g.total_installments)
    const totalRemaining = active.reduce((sum, g) => sum + g.remaining_amount, 0)
    const totalActive = active.length
    
    return { totalActive, totalRemaining }
  }

  const { totalActive, totalRemaining } = getTotalStats()

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando parcelamentos...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Parcelamentos</h1>
            <p className="text-gray-600">Gerencie suas compras parceladas</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Parcelamentos Ativos</p>
                  <p className="text-2xl font-bold text-gray-900">{totalActive}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Restante</p>
                  <p className="text-2xl font-bold text-gray-900">€{totalRemaining.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Grupos</p>
                  <p className="text-2xl font-bold text-gray-900">{installmentGroups.length}</p>
                </div>
                <CreditCard className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'active', label: 'Ativos' },
            { key: 'completed', label: 'Concluídos' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Installment Groups */}
        <div className="space-y-4">
          {getFilteredGroups().map((group) => {
            const progress = (group.paid_installments / group.total_installments) * 100
            const isCompleted = group.paid_installments >= group.total_installments
            
            return (
              <Card key={group.reference_id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{group.merchant_name}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {group.credit_card_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        €{group.original_amount.toFixed(2)}
                      </p>
                      {group.tan_rate && (
                        <p className="text-xs text-gray-500">TAN: {group.tan_rate}%</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Progress */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">
                          Progresso: {group.paid_installments}/{group.total_installments} prestações
                        </span>
                        <Badge variant={isCompleted ? "default" : "secondary"}>
                          {isCompleted ? 'Concluído' : 'Em andamento'}
                        </Badge>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* Payment Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Valor por prestação</p>
                        <p className="font-semibold">
                          €{group.installments[0]?.amount.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      {!isCompleted && (
                        <>
                          <div>
                            <p className="text-gray-600">Valor restante</p>
                            <p className="font-semibold text-red-600">
                              €{group.remaining_amount.toFixed(2)}
                            </p>
                          </div>
                          {group.next_payment_date && (
                            <div>
                              <p className="text-gray-600">Próximo pagamento</p>
                              <p className="font-semibold">
                                {new Date(group.next_payment_date).toLocaleDateString('pt-PT')}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Installment List */}
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-primary hover:text-primary-dark">
                        Ver detalhes das prestações
                      </summary>
                      <div className="mt-3 space-y-2">
                        {group.installments.map((installment) => (
                          <div key={installment.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                            <div>
                              <span className="text-sm font-medium">
                                Prestação {installment.installment_number}/{installment.total_installments}
                              </span>
                              <p className="text-xs text-gray-600">
                                {new Date(installment.transaction_date).toLocaleDateString('pt-PT')}
                              </p>
                            </div>
                            <span className="font-semibold">
                              €{installment.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {getFilteredGroups().length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Nenhum parcelamento encontrado
              </h3>
              <p className="text-gray-500">
                {filter === 'active' 
                  ? 'Não há parcelamentos ativos no momento.'
                  : filter === 'completed'
                  ? 'Não há parcelamentos concluídos.'
                  : 'Importe uma fatura de cartão de crédito para ver os parcelamentos.'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  )
}
