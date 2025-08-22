"use client"

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '../../contexts/LanguageContext'
import { Plus, Calendar, Euro, Edit, Trash2, RotateCcw } from 'lucide-react'
import Link from 'next/link'

interface FixedCost {
  id: string
  name: string
  amount: number
  currency: string
  billing_period: string
  start_date: string
  end_date: string | null
  due_day?: number | null
  is_active: boolean
  next_due_date: string | null
  category: { name: string; color: string } | null
}

export default function FixedCostsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = createClient()
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    currency: 'EUR',
    billing_period: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  due_day: '' as unknown as number | ''
  })

  useEffect(() => {
    if (user) {
      fetchFixedCosts()
    }
  }, [user])

  const fetchFixedCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('fixed_costs')
        .select(`
          id,
          name,
          amount,
          currency,
          billing_period,
          start_date,
          end_date,
          is_active,
          next_due_date,
          categories (name, color)
        `)
        .eq('user_id', user?.id)
        .order('name')

      if (error) throw error

      // Transform the data
      const transformedFixedCosts = (data || []).map((fc: any) => ({
        ...fc,
        category: fc.categories ? fc.categories[0] : null
      }))

      setFixedCosts(transformedFixedCosts)
    } catch (error) {
      console.error('Error fetching fixed costs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        alert(t('messages.invalidAmount'))
        return
      }

      // Calculate next due date
      const startDate = new Date(formData.start_date)
      let nextDueDate = new Date(startDate)
      // If monthly and due_day provided, set to that day next month
      if (formData.billing_period === 'weekly') {
        nextDueDate.setDate(nextDueDate.getDate() + 7)
      } else if (formData.billing_period === 'monthly') {
        if (formData.due_day) {
          // move to next month, then set day
          nextDueDate.setMonth(nextDueDate.getMonth() + 1)
          const d = Math.min(Number(formData.due_day), 28) // clamp to 28 to avoid invalid dates
          nextDueDate.setDate(d)
        } else {
          nextDueDate.setMonth(nextDueDate.getMonth() + 1)
        }
      } else if (formData.billing_period === 'yearly') {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1)
      }

      const { error } = await supabase
        .from('fixed_costs')
        .insert([{
          user_id: user?.id,
          name: formData.name,
          amount: amount,
          currency: formData.currency,
          billing_period: formData.billing_period,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          due_day: formData.due_day ? Number(formData.due_day) : null,
          next_due_date: nextDueDate.toISOString().split('T')[0],
          is_active: true,
        }])

      if (error) throw error

      // Reset form and refresh data
      setFormData({
        name: '',
        amount: '',
        currency: 'EUR',
        billing_period: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        due_day: '' as unknown as number | ''
      })
      setShowForm(false)
      fetchFixedCosts()
    } catch (error: any) {
      alert(t('messages.errorCreating') + error.message)
    }
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

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'weekly': return t('periods.weekly')
      case 'monthly': return t('periods.monthly')
      case 'yearly': return t('periods.yearly')
      default: return period
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

  const totalMonthlyFixed = fixedCosts
    .filter(fc => fc.is_active)
    .reduce((sum, fc) => sum + getMonthlyAmount(fc.amount, fc.billing_period), 0)

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary"></div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('fixedCosts.title')}</h1>
            <p className="text-gray-600">{t('fixedCosts.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('fixedCosts.newCost')}
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{t('fixedCosts.totalMonthly')}</h3>
              <p className="text-3xl font-bold text-red-600">
                €{totalMonthlyFixed.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {fixedCosts.filter(fc => fc.is_active).length} {t('fixedCosts.activeCosts')}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <RotateCcw className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium mb-4">{t('fixedCosts.newCost')}</h2>
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
                    {t('fixedCosts.amount')}
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-primary focus:border-primary"
                      placeholder={t('fixedCosts.placeholders.amount')}
                    />
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="px-3 py-2 border-l-0 border border-gray-300 rounded-r-lg focus:ring-primary focus:border-primary"
                    >
                      <option value="EUR">EUR</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('fixedCosts.period')}
                  </label>
                  <select
                    value={formData.billing_period}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_period: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  >
                    <option value="weekly">{t('periods.weekly')}</option>
                    <option value="monthly">{t('periods.monthly')}</option>
                    <option value="yearly">{t('periods.yearly')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('fixedCosts.startDate')}
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('fixedCosts.endDate')} ({t('common.optional')})
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('fixedCosts.dueDay')} ({t('common.optional')})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.due_day as any || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_day: e.target.value ? Number(e.target.value) : '' as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    placeholder={t('fixedCosts.placeholders.dueDay')}
                  />
                </div>
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {fixedCosts.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {fixedCosts.map((fixedCost) => (
                <div key={fixedCost.id} className={`p-6 ${!fixedCost.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">{fixedCost.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          fixedCost.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {fixedCost.is_active ? t('fixedCosts.active') : t('fixedCosts.inactive')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {getPeriodLabel(fixedCost.billing_period)}
                        </div>
                        {fixedCost.next_due_date && (
                          <span>
                            {t('fixedCosts.nextDue')}: {new Date(fixedCost.next_due_date).toLocaleDateString('pt-PT')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-red-600">
                          {fixedCost.currency === 'EUR' ? '€' : 'R$'}
                          {fixedCost.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </p>
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
                          title={fixedCost.is_active ? t('fixedCosts.deactivate') : t('fixedCosts.activate')}
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
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <RotateCcw className="h-12 w-12 text-gray-300 mx-auto mb-4" />
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
    </ProtectedRoute>
  )
}
