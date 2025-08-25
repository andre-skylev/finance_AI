"use client"

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTransactions, useAccounts, useCategories } from '@/hooks/useFinanceData'
import { useLanguage } from '@/contexts/LanguageContext'
import { Plus, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, Trash2, CreditCard, Banknote } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface TransactionItem {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number // Tax percentage for this item
  taxAmount: number // Calculated tax amount
  total: number // Total including tax
}

interface TransactionFormProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function TransactionForm({ isOpen, onOpenChange, onCreated }: TransactionFormProps) {
  const { createTransaction } = useTransactions()
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const { t, language } = useLanguage() as any
  const supabase = createClient()
  
  const [showDetails, setShowDetails] = useState(false)
  const [items, setItems] = useState<TransactionItem[]>([])
  const [subtotal, setSubtotal] = useState('')
  const [generalTaxRate, setGeneralTaxRate] = useState('') // General tax rate in percentage
  const [useItemTax, setUseItemTax] = useState(false) // Toggle for per-item tax
  const [step, setStep] = useState<'target'|'details'>('target')
  const [targetType, setTargetType] = useState<'account' | 'credit_card'>('account')
  const [search, setSearch] = useState('')
  const [creditCards, setCreditCards] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    account_id: '',
    category_id: '',
    amount: '',
    currency: 'EUR' as 'EUR' | 'BRL' | 'USD',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'expense' as 'income' | 'expense' | 'transfer'
  })

  useEffect(() => {
    if (isOpen) {
      // Reset to step 1 when opening
      setStep('target')
      setSearch('')
      setShowDetails(false)
      setTargetType('account')
      // lazily load cards
      ;(async () => {
        try {
          const { data, error } = await supabase
            .from('credit_cards')
            .select('id, card_name, bank_name, currency')
            .order('bank_name', { ascending: true })
          if (!error) setCreditCards(data || [])
        } catch {}
      })()
    }
  }, [isOpen])

  const calculateTotal = () => {
    if (items.length > 0) {
      // If we have items, the total is already calculated including tax
      return items.reduce((sum, item) => sum + item.total, 0)
    }
    
    const subtotalAmount = parseFloat(subtotal) || 0
    
    if (subtotalAmount > 0) {
      const taxRate = parseFloat(generalTaxRate) || 0
      const taxAmount = (subtotalAmount * taxRate) / 100
      return subtotalAmount + taxAmount
    }
    
    return parseFloat(formData.amount) || 0
  }

  const handleAddItem = () => {
    const defaultTaxRate = parseFloat(generalTaxRate) || 0
    setItems([...items, {
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: defaultTaxRate,
      taxAmount: 0,
      total: 0
    }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof TransactionItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Recalculate totals for the item
    if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
      const item = newItems[index]
      const subtotal = item.quantity * item.unitPrice
      item.taxAmount = (subtotal * item.taxRate) / 100
      item.total = subtotal + item.taxAmount
    }
    
    setItems(newItems)
    
    // Update subtotal (without tax)
    const newSubtotal = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    setSubtotal(newSubtotal.toString())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const finalAmount = calculateTotal()
      
      // Branch by target type
      if (targetType === 'account') {
        const transactionData: any = {
          ...formData,
          amount: finalAmount,
          category_id: formData.category_id || undefined
        }
        // Add metadata if we have detailed information
        if (showDetails && (items.length > 0 || subtotal || generalTaxRate)) {
          const taxAmount = items.length > 0 
            ? items.reduce((sum, item) => sum + item.taxAmount, 0)
            : (parseFloat(subtotal) || 0) * (parseFloat(generalTaxRate) || 0) / 100
          
          transactionData.metadata = {
            items: items.length > 0 ? items : undefined,
            subtotal: parseFloat(subtotal) || undefined,
            taxRate: parseFloat(generalTaxRate) || undefined,
            taxAmount: taxAmount || undefined,
            hasDetails: true
          }
        }
        await createTransaction(transactionData)
    } else {
        // credit card path
        const cardId = formData.account_id.startsWith('cc:') ? formData.account_id.split(':')[1] : formData.account_id
        const isPayment = formData.type === 'income'
        const payload = {
          credit_card_id: cardId,
          transaction_date: formData.transaction_date,
          description: formData.description,
          amount: finalAmount,
          currency: formData.currency,
          transaction_type: isPayment ? 'payment' : 'purchase',
          installments: 1,
      installment_number: 1,
      category_id: !isPayment ? (formData.category_id || null) : null
        }
        const res = await fetch('/api/credit-card-transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to create credit card transaction')
        }
      }
      onOpenChange(false)
      if (onCreated) onCreated()
      
      // Reset form
  setFormData({
        account_id: '',
        category_id: '',
        amount: '',
        currency: 'EUR',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'expense'
      })
      setItems([])
      setSubtotal('')
      setGeneralTaxRate('')
      setUseItemTax(false)
      setShowDetails(false)
  setTargetType('account')
  setStep('target')
    } catch (error) {
      console.error('Erro ao criar transação:', error)
    }
  }

  const filteredCategories = categories.filter((cat: any) => cat.type === formData.type)

  // Step 1: choose target account or credit card
  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a: any) => `${a.name} ${a.bank_name || ''}`.toLowerCase().includes(q))
  }, [search, accounts])

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return creditCards
    return creditCards.filter((c: any) => `${c.card_name} ${c.bank_name || ''}`.toLowerCase().includes(q))
  }, [search, creditCards])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Transação</DialogTitle>
        </DialogHeader>
        {step === 'target' ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Onde ocorreu a transação? Selecione a origem.</p>

              {/* Tabs for target type */}
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setTargetType('account')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${targetType === 'account' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                >
                  <Banknote className="h-4 w-4" /> Conta
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('credit_card')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${targetType === 'credit_card' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                >
                  <CreditCard className="h-4 w-4" /> Cartão
                </button>
              </div>

              {(targetType === 'account' ? accounts.length === 0 : creditCards.length === 0) ? (
                <div className="rounded-md border p-4 text-sm">
                  <div className="mb-2">{targetType === 'account' ? 'Nenhuma conta encontrada.' : 'Nenhum cartão encontrado.'}</div>
                  <Link href={targetType === 'account' ? '/accounts' : '/credit-cards'} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-gray-50">
                    {targetType === 'account' ? 'Criar conta' : 'Criar cartão'}
                  </Link>
                </div>
              ) : (
                <>
                  <Input
                    placeholder={targetType === 'account' ? 'Pesquisar conta...' : 'Pesquisar cartão...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-3"
                  />
                  {targetType === 'account' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredAccounts.map((a: any) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => { setFormData(prev => ({ ...prev, account_id: a.id, currency: (a.currency as any) || 'EUR' })); setStep('details') }}
                          className="text-left rounded-md border p-3 hover:bg-gray-50"
                        >
                          <div className="text-sm text-gray-600">{a.bank_name || 'Conta'}</div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-gray-500 mt-1">Moeda: {a.currency}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredCards.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setFormData(prev => ({ ...prev, account_id: `cc:${c.id}`, currency: (c.currency as any) || 'EUR' })); setStep('details') }}
                          className="text-left rounded-md border p-3 hover:bg-gray-50"
                        >
                          <div className="text-sm text-gray-600">{c.bank_name || 'Cartão'}</div>
                          <div className="font-medium">{c.card_name}</div>
                          <div className="text-xs text-gray-500 mt-1">Moeda: {c.currency}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Chosen target summary */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="text-sm">
              <div className="text-gray-600">{targetType === 'account' ? 'Conta selecionada' : 'Cartão selecionado'}</div>
              <div className="font-medium">{(() => {
                if (targetType === 'account') {
                  const a = accounts.find((x: any) => x.id === formData.account_id)
                  return a ? `${a.name}${a.bank_name ? ' — ' + a.bank_name : ''} (${a.currency})` : formData.account_id
                }
                const cardId = formData.account_id?.startsWith('cc:') ? formData.account_id.split(':')[1] : null
                const c = creditCards.find((x: any) => x.id === cardId)
                return c ? `${c.card_name}${c.bank_name ? ' — ' + c.bank_name : ''} (${c.currency})` : formData.account_id
              })()}</div>
            </div>
            <Button type="button" variant="outline" onClick={() => setStep('target')}>Trocar</Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {targetType === 'account' ? (
                  <>
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </>
                ) : (
                  <>
                    {/* map to purchase/payment later */}
                    <option value="expense">Compra</option>
                    <option value="income">Pagamento</option>
                  </>
                )}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="transaction_date">Data</Label>
              <Input
                id="transaction_date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData(prev => ({ ...prev, transaction_date: e.target.value }))}
                required
              />
            </div>
          </div>
          
          {targetType === 'account' && (
            <div className="space-y-2">
              <Label htmlFor="category_id">Categoria</Label>
              <select
                id="category_id"
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione uma categoria</option>
                {filteredCategories.map((category: any) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {targetType === 'credit_card' && formData.type === 'expense' && (
            <div className="space-y-2">
              <Label htmlFor="cc_category_id">Categoria</Label>
              <select
                id="cc_category_id"
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione uma categoria</option>
                {filteredCategories.map((category: any) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva a transação..."
              required
            />
          </div>

          {/* Toggle for detailed view */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showDetails ? 'Ocultar detalhes' : 'Adicionar detalhes (itens, impostos)'}
          </button>

          {showDetails ? (
            <div className="space-y-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
              {/* Items Section */}
              <div className="space-y-3">
        <div className="flex items-center justify-between">
                  <Label>Itens</Label>
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    size="sm"
          variant="outline"
          className="border-primary text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar Item
                  </Button>
                </div>
                
                {items.map((item, index) => (
                  <div key={index} className="space-y-2 p-3 bg-white rounded-lg border">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Input
                          placeholder="Descrição do item"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qtd"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          step="1"
                          min="0"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Preço Unit."
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="IVA %"
                          value={item.taxRate}
                          onChange={(e) => handleItemChange(index, 'taxRate', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          max="100"
                          className={useItemTax ? "" : "bg-gray-100"}
                          readOnly={!useItemTax}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Subtotal: {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: formData.currency, minimumFractionDigits: 2 }).format(item.quantity * item.unitPrice)}</span>
                      <span>IVA: {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: formData.currency, minimumFractionDigits: 2 }).format(item.taxAmount)}</span>
                      <span className="font-medium">Total: {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: formData.currency, minimumFractionDigits: 2 }).format(item.total)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tax Options */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <Label>Configuração de IVA</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={useItemTax}
                      onChange={(e) => setUseItemTax(e.target.checked)}
                      className="rounded"
                    />
                    IVA individual por item
                  </label>
                </div>
                
                {!useItemTax && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="generalTax">Taxa IVA Geral (%)</Label>
                      <Input
                        id="generalTax"
                        type="number"
                        step="0.01"
                        value={generalTaxRate}
                        onChange={(e) => {
                          setGeneralTaxRate(e.target.value)
                          // Update all items with new tax rate
                          const newRate = parseFloat(e.target.value) || 0
                          setItems(items.map(item => ({
                            ...item,
                            taxRate: newRate,
                            taxAmount: (item.quantity * item.unitPrice * newRate) / 100,
                            total: (item.quantity * item.unitPrice) + ((item.quantity * item.unitPrice * newRate) / 100)
                          })))
                        }}
                        placeholder="23"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                )}
                
                {/* Subtotal for manual entry */}
                {items.length === 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="subtotal">Subtotal (sem IVA)</Label>
                    <Input
                      id="subtotal"
                      type="number"
                      step="0.01"
                      value={subtotal}
                      onChange={(e) => setSubtotal(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              {/* Calculated Total */}
              <div className="p-3 sm:p-4 bg-white rounded-lg border">
                <div className="space-y-2">
                  {items.length > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: formData.currency, minimumFractionDigits: 2 }).format(items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total IVA:</span>
                        <span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: formData.currency, minimumFractionDigits: 2 }).format(items.reduce((sum, item) => sum + item.taxAmount, 0))}</span>
                      </div>
                      <div className="border-t pt-2"></div>
                    </>
                  )}
                  {items.length === 0 && subtotal && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: formData.currency, minimumFractionDigits: 2 }).format(parseFloat(subtotal))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>IVA ({generalTaxRate || 0}%):</span>
                        <span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: formData.currency, minimumFractionDigits: 2 }).format(((parseFloat(subtotal) * (parseFloat(generalTaxRate) || 0)) / 100))}</span>
                      </div>
                      <div className="border-t pt-2"></div>
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Final:</span>
                    <span className="text-lg font-bold">
                      {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: formData.currency, minimumFractionDigits: 2 }).format(calculateTotal())}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="currency">Moeda</Label>
        {targetType === 'account' ? (
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as any }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
          <option value="EUR">EUR (€)</option>
          <option value="BRL">BRL (R$)</option>
          <option value="USD">USD ($)</option>
                  </select>
                ) : (
                  <div className="h-10 flex items-center px-3 rounded-md border bg-gray-50 text-sm">{formData.currency}</div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {targetType === 'account' ? (
                formData.type === 'income' ? (
                <ArrowUpRight className="h-4 w-4 mr-2" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-2" />
                )
              ) : (
                formData.type === 'income' ? (
                  // income used as Payment here
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-2" />
                )
              )}
              Adicionar Transação
            </Button>
          </div>
  </form>
  )}
      </DialogContent>
    </Dialog>
  )
}

export function AddTransactionButton({ onCreated }: { onCreated?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Nova Transação
      </Button>
      <TransactionForm isOpen={isOpen} onOpenChange={setIsOpen} onCreated={onCreated} />
    </>
  )
}