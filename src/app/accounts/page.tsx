"use client"

import ProtectedRoute from '@/components/ProtectedRoute'
import { useAccounts } from '@/hooks/useFinanceData'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCurrency } from '@/hooks/useCurrency'
import { type SupportedCurrency } from '@/lib/currency'
import { 
  displaySecureBalance, 
  getBalanceRangeClass, 
  getSecurityStatus,
  type SecureAccount 
} from '@/lib/secure-display'
import { useEffect, useRef, useState } from 'react'
import { Building2, Eye, EyeOff, Plus, RefreshCw, Wallet, Trash2, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AccountsPage() {
  const { t } = useLanguage()
  const { accounts, loading, error, refetch, createAccount } = useAccounts()
  const { formatBalance, parse } = useCurrency()
  const router = useRouter()
  const [hideBalances, setHideBalances] = useState<boolean>(false)
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const [newAccount, setNewAccount] = useState({
    name: '',
    bank_name: '',
    account_type: 'checking' as 'checking' | 'savings' | 'credit' | 'investment',
    currency: 'EUR' as SupportedCurrency,
    balance: '' as string | number
  })
  const [confirmingDelete, setConfirmingDelete] = useState<{ id: string; name: string } | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('hideBalances') : null
    if (saved) setHideBalances(saved === '1')
  }, [])

  const toggleHide = () => {
    const next = !hideBalances
    setHideBalances(next)
    if (typeof window !== 'undefined') localStorage.setItem('hideBalances', next ? '1' : '0')
  }

  const quickCreate = async () => {
    if (!newAccount.name.trim()) {
      setCreateMsg({ type: 'error', text: 'Informe um nome para a conta.' })
      nameInputRef.current?.focus()
      return
    }
    try {
      setIsCreating(true)
      await createAccount({
        ...newAccount,
        balance: parse(String(newAccount.balance), newAccount.currency)
      })
      setNewAccount({ name: '', bank_name: '', account_type: 'checking', currency: 'EUR', balance: '' })
      setCreateMsg({ type: 'success', text: 'Conta criada com sucesso.' })
    } finally {
      setIsCreating(false)
    }
  }

  const focusCreateForm = () => {
    setTimeout(() => {
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      nameInputRef.current?.focus()
    }, 10)
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">{t('settings.accounts') || 'Contas'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleHide}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50"
              title={hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'}
            >
              {hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline">{hideBalances ? 'Mostrar' : 'Ocultar'}</span>
            </button>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
        ref={nameInputRef}
              className="md:col-span-2 px-3 py-2 rounded-md border"
              placeholder="Nome da Conta"
              value={newAccount.name}
              onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="px-3 py-2 rounded-md border"
              placeholder="Banco (opcional)"
              value={newAccount.bank_name}
              onChange={(e) => setNewAccount(prev => ({ ...prev, bank_name: e.target.value }))}
            />
            <select
              className="px-3 py-2 rounded-md border"
              value={newAccount.account_type}
              onChange={(e) => setNewAccount(prev => ({ ...prev, account_type: e.target.value as any }))}
            >
              <option value="checking">Conta Corrente</option>
              <option value="savings">Poupança</option>
              <option value="credit">Cartão de Crédito</option>
              <option value="investment">Investimento</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="px-3 py-2 rounded-md border"
                value={newAccount.currency}
                onChange={(e) => setNewAccount(prev => ({ ...prev, currency: e.target.value as any }))}
              >
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
              </select>
              <input
                className="px-3 py-2 rounded-md border"
                type="text"
                placeholder="Saldo inicial"
                value={newAccount.balance}
                onChange={(e) => setNewAccount(prev => ({ ...prev, balance: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={quickCreate}
              disabled={isCreating || !newAccount.name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar Conta
            </button>
          </div>
          {createMsg && (
            <div
              className={`mt-3 text-sm rounded-md px-3 py-2 border ${
                createMsg.type === 'success'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
              role="status"
              aria-live="polite"
            >
              {createMsg.text}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-md bg-red-50 text-red-700 border border-red-200">{error}</div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 rounded-lg border bg-white">
            <Building2 className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-3">Nenhuma conta encontrada</p>
            <button
              onClick={focusCreateForm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Adicionar Primeira Conta
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc: any) => {
              
              return (
                <Link
                  key={acc.id}
                  href={`/accounts/${acc.id}`}
                  className="rounded-lg border bg-white p-4 hover:shadow-md transition-shadow block group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        {acc.bank_name || 'Conta'}
                      </div>
                      <div className="font-medium">{acc.name}</div>
                    </div>
                  </div>
                  <div className={`mt-3 text-2xl font-semibold tracking-tight`}>
                    {hideBalances ? (
                      <span className="select-none">••••••</span>
                    ) : (
                      formatBalance(acc.balance || 0, acc.currency as SupportedCurrency)
                    )}
                  </div>
                  {acc.last_update && (
                    <div className="mt-1 text-xs text-gray-500">
                      Atualizado {new Date(acc.last_update).toLocaleDateString('pt-PT')}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-green-600 flex items-center">
                      <Shield className="h-3 w-3 mr-1" />
                      Dados protegidos
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete({ id: acc.id, name: acc.name }); setConfirmName('') }}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                      title="Eliminar conta"
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Delete confirmation dialog */}
        {confirmingDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
              <h2 className="text-lg font-semibold mb-1">Remover conta</h2>
              <p className="text-sm text-gray-600 mb-3">
                Esta ação é irreversível. Para confirmar, escreva o nome da conta exatamente como abaixo:
              </p>
              <div className="p-2 rounded border bg-gray-50 text-sm font-medium mb-3">{confirmingDelete.name}</div>
              <input
                className="w-full px-3 py-2 rounded-md border"
                placeholder="Digite o nome da conta para confirmar"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="rounded-md border px-3 py-2 hover:bg-gray-50"
                  onClick={() => setConfirmingDelete(null)}
                >
                  Cancelar
                </button>
                <button
                  disabled={deleteLoading || confirmName !== confirmingDelete.name}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 text-white px-3 py-2 disabled:opacity-50"
                  onClick={async () => {
                    if (!confirmingDelete) return
                    try {
                      setDeleteLoading(true)
                      // Use hard delete to remove account and all related transactions
                      await fetch(`/api/accounts?id=${confirmingDelete.id}&hard=true`, { method: 'DELETE' })
                      setConfirmingDelete(null)
                      await refetch()
                    } finally {
                      setDeleteLoading(false)
                    }
                  }}
                >
                  {deleteLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Remover definitivamente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
