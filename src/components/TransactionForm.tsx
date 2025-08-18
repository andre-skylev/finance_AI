"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTransactions, useAccounts, useCategories } from '@/hooks/useFinanceData'
import { useLanguage } from '@/contexts/LanguageContext'
import { Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface TransactionFormProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function TransactionForm({ isOpen, onOpenChange }: TransactionFormProps) {
  const { t } = useLanguage()
  const { createTransaction } = useTransactions()
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  
  const [formData, setFormData] = useState({
    account_id: '',
    category_id: '',
    amount: '',
    currency: 'EUR' as 'EUR' | 'BRL',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'expense' as 'income' | 'expense' | 'transfer'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createTransaction({
        ...formData,
        amount: parseFloat(formData.amount),
        category_id: formData.category_id || undefined
      })
      onOpenChange(false)
      setFormData({
        account_id: '',
        category_id: '',
        amount: '',
        currency: 'EUR',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'expense'
      })
    } catch (error) {
      console.error('Erro ao criar transação:', error)
    }
  }

  const filteredCategories = categories.filter((cat: any) => cat.type === formData.type)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="expense">💸 Despesa</option>
                <option value="income">💰 Receita</option>
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
          
          <div className="space-y-2">
            <Label htmlFor="account_id">Conta</Label>
            <select
              id="account_id"
              value={formData.account_id}
              onChange={(e) => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="">Selecione uma conta</option>
              {accounts.map((account: any) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category_id">Categoria</Label>
            <select
              id="category_id"
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Selecione uma categoria</option>
              {filteredCategories.map((category: any) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>
          
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
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as any }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="EUR">EUR (€)</option>
                <option value="BRL">BRL (R$)</option>
              </select>
            </div>
          </div>
          
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
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {formData.type === 'income' ? (
                <ArrowUpRight className="h-4 w-4 mr-2" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-2" />
              )}
              Adicionar Transação
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AddTransactionButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Nova Transação
      </Button>
      <TransactionForm isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}
