"use client"

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '../../contexts/LanguageContext'
import { User, CreditCard, Settings, LogOut, Bell, Globe, Lock, Trash2 } from 'lucide-react'

interface Account {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  is_active: boolean
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { t, language, setLanguage } = useLanguage()
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showAccountForm, setShowAccountForm] = useState(false)

  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'checking',
    balance: '',
    currency: 'EUR',
  })

  const [userPreferences, setUserPreferences] = useState({
    defaultCurrency: 'EUR',
    notifications: true,
  })

  useEffect(() => {
    if (user) {
      fetchAccounts()
      loadUserPreferences()
    }
  }, [user])

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at')

      if (error) throw error

      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserPreferences = () => {
    // In a real app, these would be loaded from a database or local storage
    const saved = localStorage.getItem('userPreferences')
    if (saved) {
      setUserPreferences(JSON.parse(saved))
    }
  }

  const saveUserPreferences = (newPreferences: typeof userPreferences) => {
    setUserPreferences(newPreferences)
    localStorage.setItem('userPreferences', JSON.stringify(newPreferences))
  }

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const balance = parseFloat(accountForm.balance)
      if (isNaN(balance)) {
        alert('Por favor, insira um saldo válido')
        return
      }

      const { error } = await supabase
        .from('accounts')
        .insert([{
          user_id: user?.id,
          name: accountForm.name,
          type: accountForm.type,
          balance: balance,
          currency: accountForm.currency,
          is_active: true,
        }])

      if (error) throw error

      // Reset form and refresh data
      setAccountForm({
        name: '',
        type: 'checking',
        balance: '',
        currency: 'EUR',
      })
      setShowAccountForm(false)
      fetchAccounts()
    } catch (error: any) {
      alert('Erro ao criar conta: ' + error.message)
    }
  }

  const toggleAccount = async (accountId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: !isActive })
        .eq('id', accountId)

      if (error) throw error

      fetchAccounts()
    } catch (error) {
      console.error('Error toggling account:', error)
    }
  }

  const deleteAccount = async (accountId: string) => {
    if (!confirm('Tem a certeza que deseja eliminar esta conta? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId)

      if (error) throw error

      setAccounts(accounts.filter(acc => acc.id !== accountId))
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking': return 'Conta Corrente'
      case 'savings': return 'Poupança'
      case 'credit': return 'Cartão de Crédito'
      case 'investment': return 'Investimento'
      default: return type
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('settings.title')}</h1>
          <p className="text-gray-600">{t('settings.subtitle')}</p>
        </div>

        {/* User Profile Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 bg-gray-100 rounded-full">
              <User className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('settings.profile')}</h2>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>
          
          <div className="border-t pt-6">
            <button
              onClick={signOut}
              className="inline-flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('settings.logout')}
            </button>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3 mb-6">
            <Settings className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">{t('settings.preferences')}</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.defaultCurrency')}
              </label>
              <select
                value={userPreferences.defaultCurrency}
                onChange={(e) => saveUserPreferences({
                  ...userPreferences,
                  defaultCurrency: e.target.value
                })}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              >
                <option value="EUR">Euro (EUR)</option>
                <option value="BRL">Real Brasileiro (BRL)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.language')}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'pt' | 'en')}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              >
                <option value="pt">{t('settings.portuguese')}</option>
                <option value="en">{t('settings.english')}</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('settings.notifications')}
                </label>
                <p className="text-sm text-gray-500">
                  {t('settings.notificationsDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={userPreferences.notifications}
                  onChange={(e) => saveUserPreferences({
                    ...userPreferences,
                    notifications: e.target.checked
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Accounts Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <CreditCard className="h-6 w-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Contas</h2>
            </div>
            <button
              onClick={() => setShowAccountForm(!showAccountForm)}
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Adicionar Conta
            </button>
          </div>

          {/* Add Account Form */}
          {showAccountForm && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Nova Conta</h3>
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome da Conta
                    </label>
                    <input
                      type="text"
                      required
                      value={accountForm.name}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      placeholder="Ex: Conta Principal"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Conta
                    </label>
                    <select
                      value={accountForm.type}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    >
                      <option value="checking">Conta Corrente</option>
                      <option value="savings">Poupança</option>
                      <option value="credit">Cartão de Crédito</option>
                      <option value="investment">Investimento</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Saldo Inicial
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={accountForm.balance}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, balance: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Moeda
                    </label>
                    <select
                      value={accountForm.currency}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    >
                      <option value="EUR">EUR</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowAccountForm(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Accounts List */}
          <div className="space-y-4">
            {accounts.length > 0 ? (
              accounts.map((account) => (
                <div key={account.id} className={`p-4 border rounded-lg ${!account.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">{account.name}</h3>
                        <span className="text-sm text-gray-500">
                          {getAccountTypeLabel(account.type)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          account.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {account.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {account.currency === 'EUR' ? '€' : 'R$'}
                        {account.balance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleAccount(account.id, account.is_active)}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          account.is_active
                            ? 'text-orange-600 hover:bg-orange-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {account.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => deleteAccount(account.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma conta encontrada</p>
              </div>
            )}
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3 mb-6">
            <Lock className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Segurança</h2>
          </div>

          <div className="space-y-4">
            <button className="w-full sm:w-auto inline-flex items-center px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Lock className="h-4 w-4 mr-2" />
              Alterar Palavra-passe
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
