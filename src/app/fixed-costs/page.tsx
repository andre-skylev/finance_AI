"use client"

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '../../contexts/LanguageContext'
import { Plus, Calendar, Euro, Edit, Trash2, RotateCcw, Home, Zap, Car, Wifi, CreditCard, PlayCircle, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'
import Link from 'next/link'
import CurrencyDropdown from '@/components/CurrencyDropdown'
import { useCurrency } from '@/contexts/CurrencyContext'

interface FixedCost {
  id: string
  name: string
  amount: number
  estimated_amount: number | null
  currency: string
  billing_period: string
  start_date: string
  end_date: string | null
  due_day?: number | null
  is_active: boolean
  next_due_date: string | null
  cost_type: 'utilities' | 'housing' | 'insurance' | 'transport' | 'communication' | 'financial' | 'subscriptions' | 'other'
  provider: string | null
  auto_payment: boolean
  category: { name: string; color: string } | null
}

interface FixedCostEntry {
  id: string
  fixed_cost_id: string
  month_year: string
  amount: number
  actual_amount: number | null
  due_date: string | null
  payment_date: string | null
  status: 'pending' | 'paid' | 'overdue'
  notes: string | null
  fixed_cost: {
    name: string
    cost_type: string
    provider: string | null
  }
}

const COST_TYPE_ICONS = {
  utilities: Zap,
  housing: Home,
  insurance: RotateCcw,
  transport: Car,
  communication: Wifi,
  financial: CreditCard,
  subscriptions: PlayCircle,
  other: DollarSign
}

const COST_TYPE_COLORS = {
  utilities: 'bg-yellow-100 text-yellow-800',
  housing: 'bg-blue-100 text-blue-800',
  insurance: 'bg-green-100 text-green-800',
  transport: 'bg-purple-100 text-purple-800',
  communication: 'bg-indigo-100 text-indigo-800',
  financial: 'bg-red-100 text-red-800',
  subscriptions: 'bg-pink-100 text-pink-800',
  other: 'bg-gray-100 text-gray-800'
}

export default function FixedCostsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = createClient()
  const { displayCurrency, convert } = useCurrency()
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [currentMonthEntries, setCurrentMonthEntries] = useState<FixedCostEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [activeTab, setActiveTab] = useState<'overview' | 'fixed-costs' | 'monthly-entries'>('overview')

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    estimated_amount: '',
    currency: 'EUR',
    billing_period: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    due_day: '' as unknown as number | '',
    cost_type: 'utilities' as FixedCost['cost_type'],
    provider: '',
    auto_payment: false
  })

  const [entryFormData, setEntryFormData] = useState({
    fixed_cost_id: '',
    amount: '',
    actual_amount: '',
    due_date: '',
    payment_date: '',
    status: 'pending' as 'pending' | 'paid' | 'overdue',
    notes: ''
  })

  useEffect(() => {
    if (user) {
      fetchFixedCosts()
      fetchMonthlyEntries()
    }
  }, [user, selectedMonth])

  const fetchFixedCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('fixed_costs')
        .select(`
          id,
          name,
          amount,
          estimated_amount,
          currency,
          billing_period,
          start_date,
          end_date,
          is_active,
          next_due_date,
          cost_type,
          provider,
          auto_payment,
          due_day,
          categories (name, color)
        `)
        .eq('user_id', user?.id)
        .order('cost_type', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error

      const transformedFixedCosts = (data || []).map((fc: any) => ({
        ...fc,
        category: fc.categories ? fc.categories[0] : null
      }))

      setFixedCosts(transformedFixedCosts)
    } catch (error) {
      console.error('Error fetching fixed costs:', error)
    }
  }

  const fetchMonthlyEntries = async () => {
    try {
      const monthDate = `${selectedMonth}-01`
      const { data, error } = await supabase
        .from('fixed_cost_entries')
        .select(`
          id,
          fixed_cost_id,
          month_year,
          amount,
          actual_amount,
          due_date,
          payment_date,
          status,
          notes,
          fixed_costs (
            name,
            cost_type,
            provider
          )
        `)
        .eq('user_id', user?.id)
        .eq('month_year', monthDate)
        .order('due_date', { ascending: true })

      if (error) throw error

      const transformedEntries = (data || []).map((entry: any) => ({
        ...entry,
        fixed_cost: entry.fixed_costs
      }))

      setCurrentMonthEntries(transformedEntries)
    } catch (error) {
      console.error('Error fetching monthly entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const amount = parseFloat(formData.amount)
      const estimatedAmount = formData.estimated_amount ? parseFloat(formData.estimated_amount) : null
      
      if (isNaN(amount) || amount <= 0) {
        alert(t('messages.invalidAmount'))
        return
      }

      const { error } = await supabase
        .from('fixed_costs')
        .insert([{
          user_id: user?.id,
          name: formData.name,
          amount: amount,
          estimated_amount: estimatedAmount,
          currency: formData.currency,
          billing_period: formData.billing_period,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          due_day: formData.due_day ? Number(formData.due_day) : null,
          cost_type: formData.cost_type,
          provider: formData.provider || null,
          auto_payment: formData.auto_payment,
          is_active: true,
        }])

      if (error) throw error

      // Reset form and refresh data
      setFormData({
        name: '',
        amount: '',
        estimated_amount: '',
        currency: 'EUR',
        billing_period: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        due_day: '' as unknown as number | '',
        cost_type: 'utilities',
        provider: '',
        auto_payment: false
      })
      setShowForm(false)
      fetchFixedCosts()
    } catch (error: any) {
      alert(t('messages.errorCreating') + error.message)
    }
  }

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const amount = parseFloat(entryFormData.amount)
      const actualAmount = entryFormData.actual_amount ? parseFloat(entryFormData.actual_amount) : null
      
      if (isNaN(amount) || amount <= 0) {
        alert(t('messages.invalidAmount'))
        return
      }

      const monthDate = `${selectedMonth}-01`

      const { error } = await supabase
        .from('fixed_cost_entries')
        .insert([{
          user_id: user?.id,
          fixed_cost_id: entryFormData.fixed_cost_id,
          month_year: monthDate,
          amount: amount,
          actual_amount: actualAmount,
          due_date: entryFormData.due_date || null,
          payment_date: entryFormData.payment_date || null,
          status: entryFormData.status,
          notes: entryFormData.notes || null
        }])

      if (error) throw error

      // Reset form and refresh data
      setEntryFormData({
        fixed_cost_id: '',
        amount: '',
        actual_amount: '',
        due_date: '',
        payment_date: '',
        status: 'pending',
        notes: ''
      })
      setShowEntryForm(false)
      fetchMonthlyEntries()
    } catch (error: any) {
      alert(t('messages.errorCreating') + error.message)
    }
  }

  const markEntryAsPaid = async (entryId: string, actualAmount?: number) => {
    try {
      const { error } = await supabase
        .from('fixed_cost_entries')
        .update({ 
          status: 'paid',
          payment_date: new Date().toISOString().split('T')[0],
          actual_amount: actualAmount || null
        })
        .eq('id', entryId)

      if (error) throw error
      fetchMonthlyEntries()
    } catch (error) {
      console.error('Error marking entry as paid:', error)
    }
  }

  const generateEntriesForMonth = async () => {
    try {
      // Chamar função do banco para gerar lançamentos automáticos
      const { data, error } = await supabase
        .rpc('generate_monthly_fixed_cost_entries', { 
          target_month: `${selectedMonth}-01` 
        })

      if (error) throw error
      
      alert(`${data} lançamentos criados para ${selectedMonth}`)
      fetchMonthlyEntries()
    } catch (error) {
      console.error('Error generating entries:', error)
    }
  }

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'weekly': return t('periods.weekly')
      case 'monthly': return t('periods.monthly')
      case 'yearly': return t('periods.yearly')
      default: return period
    }
  }

  const getCostTypeLabel = (type: string) => {
    return t(`fixedCosts.types.${type}`)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'overdue': return <AlertCircle className="h-4 w-4 text-red-600" />
      default: return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  // Calculações para o overview
  const totalMonthlyBudget = fixedCosts
    .filter(fc => fc.is_active)
    .reduce((sum, fc) => {
      const monthly = fc.billing_period === 'monthly' ? fc.amount : 
                     fc.billing_period === 'yearly' ? fc.amount / 12 : fc.amount * 4.33
      return sum + convert(monthly, (fc.currency as 'EUR'|'BRL'), displayCurrency)
    }, 0)

  const totalActualMonth = currentMonthEntries
    .reduce((sum, entry) => {
      const amount = entry.actual_amount || entry.amount
      return sum + amount
    }, 0)

  const paidThisMonth = currentMonthEntries.filter(e => e.status === 'paid').length
  const pendingThisMonth = currentMonthEntries.filter(e => e.status === 'pending').length
  const overdueThisMonth = currentMonthEntries.filter(e => e.status === 'overdue').length

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary"></div>
        </div>
      </ProtectedRoute>
    )
  }

  const toggleFixedCost = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('fixed_costs')
        .update({ is_active: !isActive })
        .eq('id', id)

      if (error) throw error
      fetchFixedCosts()
    } catch (error) {
      console.error('Error toggling fixed cost:', error)
    }
  }

  const deleteFixedCost = async (id: string) => {
    if (!confirm(t('fixedCosts.deleteConfirm'))) return

    try {
      const { error } = await supabase
        .from('fixed_costs')
        .delete()
        .eq('id', id)

      if (error) throw error
      setFixedCosts(fixedCosts.filter(fc => fc.id !== id))
    } catch (error) {
      console.error('Error deleting fixed cost:', error)
    }
  }

  const getMonthlyAmount = (amount: number, period: string) => {
    switch (period) {
      case 'weekly': return amount * 4.33
      case 'monthly': return amount
      case 'yearly': return amount / 12
      default: return amount
    }
  }

  return (
    <ProtectedRoute>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('fixedCosts.title')}</h1>
            <p className="text-gray-600">{t('fixedCosts.subtitle')}</p>
          </div>
          <div className="flex items-center space-x-4">
            <CurrencyDropdown />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['overview', 'fixed-costs', 'monthly-entries'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                {t(`fixedCosts.tabs.${tab}`)}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{t('fixedCosts.monthlyBudget')}</h3>
                    <p className="text-3xl font-bold text-blue-600">
                      {displayCurrency === 'EUR' ? '€' : 'R$'}{totalMonthlyBudget.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{t('fixedCosts.actualMonth')}</h3>
                    <p className="text-3xl font-bold text-green-600">
                      {displayCurrency === 'EUR' ? '€' : 'R$'}{totalActualMonth.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{t('fixedCosts.statusLabel')}</h3>
                    <div className="flex space-x-4 mt-2">
                      <span className="text-sm text-green-600">{paidThisMonth} {t('fixedCosts.paid')}</span>
                      <span className="text-sm text-yellow-600">{pendingThisMonth} {t('fixedCosts.pending')}</span>
                      <span className="text-sm text-red-600">{overdueThisMonth} {t('fixedCosts.overdue')}</span>
                    </div>
                  </div>
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
            </div>

            {/* Current Month Entries */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium">{t('fixedCosts.thisMonth')} - {selectedMonth}</h3>
                <button
                  onClick={generateEntriesForMonth}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  {t('fixedCosts.generateEntries')}
                </button>
              </div>
              
              {currentMonthEntries.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {currentMonthEntries.map((entry) => {
                    const IconComponent = COST_TYPE_ICONS[entry.fixed_cost.cost_type as keyof typeof COST_TYPE_ICONS] || DollarSign
                    return (
                      <div key={entry.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${COST_TYPE_COLORS[entry.fixed_cost.cost_type as keyof typeof COST_TYPE_COLORS]}`}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-medium">{entry.fixed_cost.name}</h4>
                            <p className="text-sm text-gray-500">
                              {entry.fixed_cost.provider} • {entry.due_date ? new Date(entry.due_date).toLocaleDateString('pt-PT') : '-'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-semibold">
                              €{(entry.actual_amount || entry.amount).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                            </p>
                            {entry.actual_amount && entry.actual_amount !== entry.amount && (
                              <p className="text-sm text-gray-500">
                                (orç: €{entry.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })})
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(entry.status)}
                            {entry.status === 'pending' && (
                              <button
                                onClick={() => markEntryAsPaid(entry.id)}
                                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                              >
                                {t('fixedCosts.markPaid')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">{t('fixedCosts.noEntriesThisMonth')}</p>
                  <button
                    onClick={() => setShowEntryForm(true)}
                    className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('fixedCosts.addEntry')}
                  </button>
                </div>
              )}

              {/* Entry Form */}
              {showEntryForm && (
                <div className="bg-white p-6 rounded-lg shadow mt-4">
                  <h3 className="text-lg font-medium mb-4">{t('fixedCosts.addEntry')}</h3>
                  <form onSubmit={handleEntrySubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('fixedCosts.selectCost')}
                        </label>
                        <select
                          required
                          value={entryFormData.fixed_cost_id}
                          onChange={(e) => setEntryFormData(prev => ({ ...prev, fixed_cost_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">{t('fixedCosts.selectCost')}</option>
                          {fixedCosts.filter(fc => fc.is_active).map(fc => (
                            <option key={fc.id} value={fc.id}>
                              {fc.name} - €{fc.estimated_amount || fc.amount}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('fixedCosts.amount')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={entryFormData.amount || ''}
                          onChange={(e) => setEntryFormData(prev => ({ ...prev, amount: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('fixedCosts.statusLabel')}
                        </label>
                        <select
                          value={entryFormData.status}
                          onChange={(e) => setEntryFormData(prev => ({ ...prev, status: e.target.value as 'pending' | 'paid' | 'overdue' }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="pending">{t('fixedCosts.status.pending')}</option>
                          <option value="paid">{t('fixedCosts.status.paid')}</option>
                          <option value="overdue">{t('fixedCosts.status.overdue')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('fixedCosts.paymentDate')}
                        </label>
                        <input
                          type="date"
                          value={entryFormData.payment_date || ''}
                          onChange={(e) => setEntryFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.notes')}
                      </label>
                      <textarea
                        value={entryFormData.notes || ''}
                        onChange={(e) => setEntryFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        rows={3}
                        placeholder={t('fixedCosts.placeholders.notes')}
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowEntryForm(false)}
                        className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                      >
                        {t('fixedCosts.saveEntry')}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fixed Costs Tab */}
        {activeTab === 'fixed-costs' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">{t('fixedCosts.manageCosts')}</h2>
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                {t('fixedCosts.newCost')}
              </button>
            </div>

            {/* Add Form */}
            {showForm && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-4">{t('fixedCosts.newCost')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.name')}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        placeholder={t('fixedCosts.placeholders.name')}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.provider')}
                      </label>
                      <input
                        type="text"
                        value={formData.provider}
                        onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        placeholder="EDP, Vodafone, etc."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.type')}
                      </label>
                      <select
                        value={formData.cost_type}
                        onChange={(e) => setFormData(prev => ({ ...prev, cost_type: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      >
                        {Object.keys(COST_TYPE_ICONS).map(type => (
                          <option key={type} value={type}>{getCostTypeLabel(type)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.amount')} ({t('fixedCosts.fixed')})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.amount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        placeholder="50.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.estimatedAmount')} ({t('common.optional')})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.estimated_amount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, estimated_amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        placeholder="75.00"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.auto_payment}
                        onChange={(e) => setFormData(prev => ({ ...prev, auto_payment: e.target.checked }))}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="ml-2 text-sm">{t('fixedCosts.autoPayment')}</span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      {t('common.add')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Fixed Costs List */}
            <div className="bg-white rounded-lg shadow">
              {fixedCosts.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {fixedCosts.map((fixedCost) => {
                    const IconComponent = COST_TYPE_ICONS[fixedCost.cost_type] || DollarSign
                    return (
                      <div key={fixedCost.id} className={`p-6 ${!fixedCost.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-lg ${COST_TYPE_COLORS[fixedCost.cost_type]}`}>
                              <IconComponent className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{fixedCost.name}</h3>
                              <p className="text-sm text-gray-500">{fixedCost.provider} • {getCostTypeLabel(fixedCost.cost_type)}</p>
                              <div className="flex items-center space-x-4 mt-1">
                                <span className="text-xs text-gray-400">{getPeriodLabel(fixedCost.billing_period)}</span>
                                {fixedCost.auto_payment && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    {t('fixedCosts.autoPayment')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-lg font-semibold">
                                €{fixedCost.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                              </p>
                              {fixedCost.estimated_amount && (
                                <p className="text-sm text-gray-500">
                                  ~€{fixedCost.estimated_amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                                </p>
                              )}
                              <p className="text-sm text-gray-500">
                                ≈ €{getMonthlyAmount(fixedCost.amount, fixedCost.billing_period).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}/{t('fixedCosts.monthly')}
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleFixedCost(fixedCost.id, fixedCost.is_active)}
                                className={`p-2 rounded-lg transition-colors ${
                                  fixedCost.is_active
                                    ? 'text-green-600 hover:bg-green-50'
                                    : 'text-gray-400 hover:bg-gray-50'
                                }`}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteFixedCost(fixedCost.id)}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Home className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">{t('fixedCosts.noCosts')}</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('fixedCosts.addFirst')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
