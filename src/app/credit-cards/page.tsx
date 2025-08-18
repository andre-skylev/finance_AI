'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, CreditCard, Edit2, Trash2, Eye, EyeOff } from 'lucide-react'

interface CreditCard {
  id: string
  card_name: string
  bank_name: string
  card_brand?: string
  last_four_digits?: string
  card_type: 'credit' | 'debit'
  credit_limit?: number
  currency: string
  closing_day?: number
  due_day?: number
  current_balance: number
  available_limit?: number
  annual_fee: number
  interest_rate?: number
  is_active: boolean
  notes?: string
  created_at: string
}

interface NewCreditCard {
  card_name: string
  bank_name: string
  card_brand?: string
  last_four_digits?: string
  card_type: 'credit' | 'debit'
  credit_limit?: number
  currency: string
  closing_day?: number
  due_day?: number
  annual_fee: number
  interest_rate?: number
  notes?: string
}

export default function CreditCardsPage() {
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [showBalances, setShowBalances] = useState(false)
  const [newCard, setNewCard] = useState<NewCreditCard>({
    card_name: '',
    bank_name: '',
    card_brand: '',
    last_four_digits: '',
    card_type: 'credit',
    credit_limit: undefined,
    currency: 'EUR',
    closing_day: undefined,
    due_day: undefined,
    annual_fee: 0,
    interest_rate: undefined,
    notes: ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchCreditCards()
  }, [])

  const fetchCreditCards = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCreditCards(data || [])
    } catch (error) {
      console.error('Erro ao carregar cartões:', error)
      alert('Erro ao carregar cartões de crédito')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const cardData = {
        ...newCard,
        user_id: user.id,
        current_balance: 0
      }

      const { error } = await supabase
        .from('credit_cards')
        .insert([cardData])

      if (error) throw error

      alert('Cartão adicionado com sucesso!')
      setIsAddDialogOpen(false)
      resetForm()
      fetchCreditCards()
    } catch (error) {
      console.error('Erro ao adicionar cartão:', error)
      alert('Erro ao adicionar cartão')
    }
  }

  const handleUpdateCard = async () => {
    if (!editingCard) return

    try {
      const { error } = await supabase
        .from('credit_cards')
        .update(newCard)
        .eq('id', editingCard.id)

      if (error) throw error

      alert('Cartão atualizado com sucesso!')
      setEditingCard(null)
      resetForm()
      fetchCreditCards()
    } catch (error) {
      console.error('Erro ao atualizar cartão:', error)
      alert('Erro ao atualizar cartão')
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Tem certeza que deseja excluir este cartão?')) return

    try {
      const { error } = await supabase
        .from('credit_cards')
        .delete()
        .eq('id', cardId)

      if (error) throw error

      alert('Cartão excluído com sucesso!')
      fetchCreditCards()
    } catch (error) {
      console.error('Erro ao excluir cartão:', error)
      alert('Erro ao excluir cartão')
    }
  }

  const resetForm = () => {
    setNewCard({
      card_name: '',
      bank_name: '',
      card_brand: '',
      last_four_digits: '',
      card_type: 'credit',
      credit_limit: undefined,
      currency: 'EUR',
      closing_day: undefined,
      due_day: undefined,
      annual_fee: 0,
      interest_rate: undefined,
      notes: ''
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const getCardBrandIcon = (brand?: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa': return '💳'
      case 'mastercard': return '💳'
      case 'american express': return '💳'
      case 'elo': return '💳'
      default: return '💳'
    }
  }

  const getUtilizationPercentage = (current: number, limit?: number) => {
    if (!limit || limit === 0) return 0
    return Math.round((current / limit) * 100)
  }

  const getUtilizationColor = (percentage: number) => {
    if (percentage < 30) return 'text-green-600'
    if (percentage < 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Cartões de Crédito</h1>
          <p className="text-gray-600">Gerencie seus cartões de crédito e débito</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBalances(!showBalances)}
            className="flex items-center gap-2"
          >
            {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showBalances ? 'Ocultar' : 'Mostrar'} Saldos
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Cartão
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Cartão</DialogTitle>
                <DialogDescription>
                  Adicione um novo cartão de crédito ou débito
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="card_name">Nome do Cartão</Label>
                  <Input
                    id="card_name"
                    value={newCard.card_name}
                    onChange={(e) => setNewCard({ ...newCard, card_name: e.target.value })}
                    placeholder="ex: Cartão Principal"
                  />
                </div>
                <div>
                  <Label htmlFor="bank_name">Banco</Label>
                  <Input
                    id="bank_name"
                    value={newCard.bank_name}
                    onChange={(e) => setNewCard({ ...newCard, bank_name: e.target.value })}
                    placeholder="ex: Millennium BCP"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="card_brand">Bandeira</Label>
                    <select
                      id="card_brand"
                      value={newCard.card_brand}
                      onChange={(e) => setNewCard({ ...newCard, card_brand: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Selecione</option>
                      <option value="visa">Visa</option>
                      <option value="mastercard">Mastercard</option>
                      <option value="american express">American Express</option>
                      <option value="elo">Elo</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="last_four_digits">Últimos 4 dígitos</Label>
                    <Input
                      id="last_four_digits"
                      value={newCard.last_four_digits}
                      onChange={(e) => setNewCard({ ...newCard, last_four_digits: e.target.value })}
                      placeholder="1234"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="card_type">Tipo</Label>
                    <select
                      id="card_type"
                      value={newCard.card_type}
                      onChange={(e) => setNewCard({ ...newCard, card_type: e.target.value as 'credit' | 'debit' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="credit">Crédito</option>
                      <option value="debit">Débito</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="currency">Moeda</Label>
                    <select
                      id="currency"
                      value={newCard.currency}
                      onChange={(e) => setNewCard({ ...newCard, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="EUR">EUR</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                </div>
                {newCard.card_type === 'credit' && (
                  <>
                    <div>
                      <Label htmlFor="credit_limit">Limite de Crédito</Label>
                      <Input
                        id="credit_limit"
                        type="number"
                        value={newCard.credit_limit || ''}
                        onChange={(e) => setNewCard({ ...newCard, credit_limit: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="5000"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="closing_day">Dia Fechamento</Label>
                        <Input
                          id="closing_day"
                          type="number"
                          min="1"
                          max="31"
                          value={newCard.closing_day || ''}
                          onChange={(e) => setNewCard({ ...newCard, closing_day: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="15"
                        />
                      </div>
                      <div>
                        <Label htmlFor="due_day">Dia Vencimento</Label>
                        <Input
                          id="due_day"
                          type="number"
                          min="1"
                          max="31"
                          value={newCard.due_day || ''}
                          onChange={(e) => setNewCard({ ...newCard, due_day: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="25"
                        />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={newCard.notes}
                    onChange={(e) => setNewCard({ ...newCard, notes: e.target.value })}
                    placeholder="Observações adicionais"
                  />
                </div>
                <Button onClick={editingCard ? handleUpdateCard : handleAddCard} className="w-full">
                  {editingCard ? 'Atualizar' : 'Adicionar'} Cartão
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {creditCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum cartão cadastrado
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Adicione seus cartões de crédito e débito para ter controle total das suas finanças
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Primeiro Cartão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {creditCards.map((card) => (
            <Card key={card.id} className={`relative ${!card.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCardBrandIcon(card.card_brand)}</span>
                    <div>
                      <CardTitle className="text-lg">{card.card_name}</CardTitle>
                      <CardDescription className="text-sm">
                        {card.bank_name} • {card.card_brand?.toUpperCase()}
                        {card.last_four_digits && ` •••• ${card.last_four_digits}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCard(card)
                        setNewCard({
                          card_name: card.card_name,
                          bank_name: card.bank_name,
                          card_brand: card.card_brand,
                          last_four_digits: card.last_four_digits,
                          card_type: card.card_type,
                          credit_limit: card.credit_limit,
                          currency: card.currency,
                          closing_day: card.closing_day,
                          due_day: card.due_day,
                          annual_fee: card.annual_fee,
                          interest_rate: card.interest_rate,
                          notes: card.notes
                        })
                        setIsAddDialogOpen(true)
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCard(card.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {card.card_type === 'credit' && (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Limite de Crédito</span>
                        <span className="font-medium">
                          {showBalances && card.credit_limit 
                            ? formatCurrency(card.credit_limit, card.currency)
                            : '••••••'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Saldo Atual</span>
                        <span className="font-medium">
                          {showBalances 
                            ? formatCurrency(card.current_balance, card.currency)
                            : '••••••'
                          }
                        </span>
                      </div>
                      {card.credit_limit && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Utilização</span>
                            <span className={`font-medium ${getUtilizationColor(getUtilizationPercentage(card.current_balance, card.credit_limit))}`}>
                              {showBalances ? `${getUtilizationPercentage(card.current_balance, card.credit_limit)}%` : '•••'}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                getUtilizationPercentage(card.current_balance, card.credit_limit) < 30 
                                  ? 'bg-green-500' 
                                  : getUtilizationPercentage(card.current_balance, card.credit_limit) < 70 
                                  ? 'bg-yellow-500' 
                                  : 'bg-red-500'
                              }`}
                              style={{ 
                                width: showBalances 
                                  ? `${getUtilizationPercentage(card.current_balance, card.credit_limit)}%`
                                  : '0%'
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                    {(card.closing_day || card.due_day) && (
                      <div className="pt-2 border-t">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {card.closing_day && (
                            <div>
                              <span className="text-gray-600">Fecha dia:</span>
                              <div className="font-medium">{card.closing_day}</div>
                            </div>
                          )}
                          {card.due_day && (
                            <div>
                              <span className="text-gray-600">Vence dia:</span>
                              <div className="font-medium">{card.due_day}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {card.card_type === 'debit' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Tipo</span>
                      <span className="font-medium">Cartão de Débito</span>
                    </div>
                  </div>
                )}
                
                {!card.is_active && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-red-600 font-medium">Cartão Inativo</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
