"use client"

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '@/contexts/LanguageContext'
import { Plus, Calendar, Euro, Edit, Trash2, RotateCcw, Banknote } from 'lucide-react'
import CurrencyDropdown from '@/components/CurrencyDropdown'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useAccounts } from '@/hooks/useFinanceData'

type FixedIncome = {
  id: string
  name: string
  amount: number
  currency: 'EUR'|'BRL'
  billing_period: 'weekly'|'monthly'|'yearly'
  start_date: string
  end_date: string | null
  pay_day?: number | null
  is_active: boolean
  next_pay_date: string | null
  account_id?: string | null
}

export default function FixedIncomesPage() {
  const supabase = createClient()
  const { user } = useAuth()
  const { t } = useLanguage()
  const { displayCurrency, convert } = useCurrency()
  const { accounts } = useAccounts()
  const [items, setItems] = useState<FixedIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    amount: '',
    currency: 'EUR' as 'EUR'|'BRL',
    billing_period: 'monthly' as 'weekly'|'monthly'|'yearly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    pay_day: '' as unknown as number | '',
    account_id: '' as string
  })

  useEffect(() => { if (user) load() }, [user])
  // When accounts load, preselect first active account
  useEffect(() => {
    const first = accounts.find(a => a.is_active)
    setForm(prev => ({ ...prev, account_id: prev.account_id || first?.id || '' }))
  }, [accounts])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('fixed_incomes')
      .select('id,name,amount,currency,billing_period,start_date,end_date,is_active,next_pay_date,pay_day,account_id')
      .eq('user_id', user?.id)
      .order('name')
    if (!error) setItems((data || []) as any)
    setLoading(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return alert(t('messages.invalidAmount'))
    const startDate = new Date(form.start_date)
    let nextDate = new Date(startDate)
    if (form.billing_period === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
    else if (form.billing_period === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1)
      if (form.pay_day) nextDate.setDate(Math.min(Number(form.pay_day), 28))
    } else if (form.billing_period === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1)

    if (!form.account_id) return alert(t('messages.selectAccount'))
    const { error } = await supabase.from('fixed_incomes').insert([{
      user_id: user?.id,
      name: form.name,
      amount,
      currency: form.currency,
      billing_period: form.billing_period,
      start_date: form.start_date,
      end_date: form.end_date || null,
      pay_day: form.pay_day ? Number(form.pay_day) : null,
      next_pay_date: nextDate.toISOString().split('T')[0],
      is_active: true,
      account_id: form.account_id
    }])
    if (error) return alert(t('messages.errorCreating') + (error as any).message)
  setForm({ name:'', amount:'', currency:'EUR', billing_period:'monthly', start_date:new Date().toISOString().split('T')[0], end_date:'', pay_day: '' as any, account_id: '' })
    setShowForm(false)
    load()
  }

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from('fixed_incomes').update({ is_active: !active }).eq('id', id)
    if (!error) load()
  }

  const removeItem = async (id: string) => {
    if (!confirm(t('fixedIncomes.deleteConfirm'))) return
    const { error } = await supabase.from('fixed_incomes').delete().eq('id', id)
    if (!error) setItems(items.filter(i => i.id !== id))
  }

  const getPeriodLabel = (p: string) => ({ weekly: t('periods.weekly'), monthly: t('periods.monthly'), yearly: t('periods.yearly') } as any)[p] || p

  const monthlyAmount = (amount: number, period: string) => period === 'weekly' ? amount * 4.33 : period === 'yearly' ? amount/12 : amount
  const totalMonthly = items
    .filter(i => i.is_active)
    .reduce((s,i)=> s + convert(monthlyAmount(i.amount, i.billing_period), i.currency as 'EUR'|'BRL', displayCurrency), 0)

  if (loading) return (
    <ProtectedRoute>
      <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary" /></div>
    </ProtectedRoute>
  )

  return (
    <ProtectedRoute>
  <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('fixedIncomes.title')}</h1>
            <p className="text-gray-600">{t('fixedIncomes.subtitle')}</p>
          </div>
          <CurrencyDropdown />
          <button onClick={()=>setShowForm(!showForm)} className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">
            <Plus className="h-5 w-5 mr-2" /> {t('fixedIncomes.newIncome')}
          </button>
        </div>

  <div className="bg-white p-4 sm:p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{t('fixedIncomes.totalMonthly')}</h3>
              <p className="text-3xl font-bold text-green-600">{displayCurrency === 'EUR' ? '€' : 'R$'}{totalMonthly.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
              <p className="text-sm text-gray-500 mt-1">{items.filter(i=>i.is_active).length} {t('fixedIncomes.activeIncomes')}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg"><RotateCcw className="h-8 w-8 text-green-600" /></div>
          </div>
        </div>

        {showForm && (
          <div className="bg-white p-4 sm:p-6 rounded-lg border">
            <h2 className="text-lg font-medium mb-4">{t('fixedIncomes.newIncome')}</h2>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fixedIncomes.name')}</label>
                  <input className="w-full px-3 py-2 border rounded-lg" required value={form.name} onChange={(e)=>setForm(p=>({...p,name:e.target.value}))} placeholder={t('fixedIncomes.placeholders.name')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fixedIncomes.amount')}</label>
                  <div className="flex">
                    <input type="number" step="0.01" min="0" required value={form.amount} onChange={(e)=>setForm(p=>({...p,amount:e.target.value}))} className="flex-1 px-3 py-2 border rounded-l-lg" placeholder={t('fixedIncomes.placeholders.amount')} />
                    <select value={form.currency} onChange={(e)=>setForm(p=>({...p,currency:e.target.value as any}))} className="px-3 py-2 border rounded-r-lg border-l-0">
                      <option value="EUR">EUR</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fixedIncomes.period')}</label>
                  <select value={form.billing_period} onChange={(e)=>setForm(p=>({...p,billing_period:e.target.value as any}))} className="w-full px-3 py-2 border rounded-lg">
                    <option value="weekly">{t('periods.weekly')}</option>
                    <option value="monthly">{t('periods.monthly')}</option>
                    <option value="yearly">{t('periods.yearly')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fixedIncomes.startDate')}</label>
                  <input type="date" required value={form.start_date} onChange={(e)=>setForm(p=>({...p,start_date:e.target.value}))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fixedIncomes.endDate')} ({t('common.optional')})</label>
                  <input type="date" value={form.end_date} onChange={(e)=>setForm(p=>({...p,end_date:e.target.value}))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fixedIncomes.payDay')} ({t('common.optional')})</label>
                  <input type="number" min={1} max={31} value={form.pay_day as any || ''} onChange={(e)=>setForm(p=>({...p,pay_day: e.target.value ? Number(e.target.value) : '' as any}))} className="w-full px-3 py-2 border rounded-lg" placeholder={t('fixedIncomes.placeholders.payDay')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fixedIncomes.account')}</label>
                  <select value={form.account_id} onChange={(e)=>setForm(p=>({...p, account_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg" required>
                    <option value="">{t('fixedIncomes.selectAccount')}</option>
                    {accounts.filter(a=>a.is_active).map(a => (
                      <option key={a.id} value={a.id}>{a.name} {a.bank_name ? `(${a.bank_name})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border rounded-lg">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">{t('common.add')}</button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg border overflow-hidden">
          {items.length === 0 ? (
            <div className="p-12 text-center text-gray-600">{t('fixedIncomes.noIncomes')}</div>
          ) : (
            <div className="divide-y">
              {items.map(i => (
                <div key={i.id} className={`p-4 sm:p-6 ${!i.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{i.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${i.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{i.is_active ? t('fixedCosts.active') : t('fixedCosts.inactive')}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <div className="flex items-center"><Calendar className="h-4 w-4 mr-1" />{getPeriodLabel(i.billing_period)}</div>
                        {i.next_pay_date && (<span>{t('fixedIncomes.nextPay')}: {new Date(i.next_pay_date).toLocaleDateString('pt-PT')}</span>)}
                        {i.account_id && (
                          <span className="flex items-center"><Banknote className="h-4 w-4 mr-1" />{accounts.find(a=>a.id===i.account_id)?.name || t('fixedIncomes.unknownAccount')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-green-600">{displayCurrency === 'EUR' ? '€' : 'R$'}{convert(i.amount, i.currency as 'EUR'|'BRL', displayCurrency).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                        <p className="text-sm text-gray-500">≈ {displayCurrency === 'EUR' ? '€' : 'R$'}{convert(monthlyAmount(i.amount, i.billing_period), i.currency as 'EUR'|'BRL', displayCurrency).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}/{t('fixedCosts.monthly')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>toggle(i.id, i.is_active)} className={`p-2 rounded-lg ${i.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`} title={i.is_active ? t('fixedCosts.deactivate') : t('fixedCosts.activate')}>
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button onClick={()=>removeItem(i.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
