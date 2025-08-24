"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAccounts } from '@/hooks/useFinanceData'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCurrency, useCurrencyInput } from '@/hooks/useCurrency'
import { type SupportedCurrency } from '@/lib/currency'
import { 
  displaySecureBalance, 
  getBalanceRangeClass, 
  getSecurityStatus,
  type SecureAccount 
} from '@/lib/secure-display'
import { Plus, Building2, CreditCard, PiggyBank, TrendingUp, Shield } from 'lucide-react'

export function AccountManager() {
  const { t } = useLanguage()
  const { accounts, loading, createAccount, updateAccount, deleteAccount } = useAccounts()
  const { formatBalance, formatInput, parse } = useCurrency()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [hideBalances, setHideBalances] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    bank_name: '',
    account_type: 'checking' as 'checking' | 'savings' | 'credit' | 'investment',
    currency: 'EUR' as SupportedCurrency,
    balance: ''
  })

  const accountTypes = [
    { value: 'checking', label: 'Conta Corrente', icon: Building2 },
    { value: 'savings', label: 'Poupança', icon: PiggyBank },
    { value: 'credit', label: 'Cartão de Crédito', icon: CreditCard },
    { value: 'investment', label: 'Investimentos', icon: TrendingUp }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('🔍 DEBUG AccountManager - handleSubmit');
    console.log('📤 Dados do formulário:', formData);
    console.log('💰 Moeda selecionada:', formData.currency);
    
    try {
      const accountToCreate = {
        ...formData,
        balance: parse(formData.balance, formData.currency)
      }
      
      console.log('📨 Dados sendo enviados para createAccount:', accountToCreate);
      
      const result = await createAccount(accountToCreate)
      
      console.log('✅ Conta criada com sucesso:', result);
      console.log('💰 Moeda da conta criada:', result?.currency);
      
      setIsDialogOpen(false)
      setFormData({
        name: '',
        bank_name: '',
        account_type: 'checking',
        currency: 'EUR',
        balance: ''
      })
    } catch (error) {
      console.error('❌ Erro ao criar conta:', error)
    }
  }

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData(prev => ({ ...prev, balance: value }))
  }

  const getAccountTypeIcon = (type: string) => {
    const accountType = accountTypes.find(at => at.value === type)
    const Icon = accountType?.icon || Building2
    return <Icon className="h-5 w-5" />
  }

  const getAccountTypeLabel = (type: string) => {
    return accountTypes.find(at => at.value === type)?.label || type
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Minhas Contas</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideBalances(!hideBalances)}
            className="flex items-center"
          >
            <Shield className="h-4 w-4 mr-2" />
            {hideBalances ? 'Mostrar Saldos' : 'Ocultar Saldos'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Adicionar Nova Conta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Conta</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Conta Principal"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Banco</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="Ex: CGD, Millennium, Itaú"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="account_type">Tipo de Conta</Label>
                  <select
                    id="account_type"
                    value={formData.account_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, account_type: e.target.value as any }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {accountTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="balance">Saldo Inicial</Label>
                    <Input
                      id="balance"
                      type="text"
                      value={formData.balance}
                      onChange={handleBalanceChange}
                      placeholder="0,00"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Criar Conta
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma conta encontrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece adicionando suas contas bancárias para acompanhar suas finanças.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account: any) => (
            <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  {getAccountTypeIcon(account.account_type)}
                  <CardTitle className="text-sm font-medium truncate">
                    {account.name}
                  </CardTitle>
                </div>
                <div className="flex items-center space-x-1 text-xs">
                  {account.account_masked && <span>🔒</span>}
                  <span className="text-muted-foreground">Segura</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {hideBalances ? '••••••' : formatBalance(account.balance || 0, account.currency as SupportedCurrency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getAccountTypeLabel(account.account_type)}
                    {account.bank_name && ` • ${account.bank_name}`}
                  </div>
                  {account.last_update && (
                    <div className="text-xs text-muted-foreground">
                      Atualizado: {new Date(account.last_update).toLocaleDateString('pt-PT')}
                    </div>
                  )}
                  <div className="text-xs text-green-600 flex items-center">
                    <Shield className="h-3 w-3 mr-1" />
                    Dados protegidos no banco
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
