"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '../../contexts/LanguageContext'
import { Plus, Calendar, Euro, Edit, Trash2, RotateCcw, Home, Zap, Car, Wifi, CreditCard, PlayCircle, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'
import Link from 'next/link'
import CurrencyDropdown from '@/components/CurrencyDropdown'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useAccounts } from '@/hooks/useFinanceData'

type Currency = 'EUR' | 'BRL' | 'USD'

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
  account_id?: string | null
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
  currency?: string
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
  const supabase = useMemo(() => createClient(), [])
  const { displayCurrency, convert } = useCurrency()
  const { accounts } = useAccounts()
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [currentMonthEntries, setCurrentMonthEntries] = useState<FixedCostEntry[]>([])
  const [nextMonthEntries, setNextMonthEntries] = useState<FixedCostEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
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
  auto_payment: false,
  account_id: ''
  })

  const [entryFormData, setEntryFormData] = useState({
    fixed_cost_id: '',
    amount: '',
    actual_amount: '',
    due_date: '',
    payment_date: '',
    status: 'pending' as 'pending' | 'paid' | 'overdue',
  notes: '',
  repeat: 'none' as 'none' | 'weekly' | 'monthly' | 'yearly',
  repeat_count: 1
  })

  

  const fetchFixedCosts = useCallback(async () => {
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
  }, [supabase, user])

  const getNextMonth = (yyyyMm: string) => {
    const y = Number(yyyyMm.slice(0,4))
    const m = Number(yyyyMm.slice(5,7))
    const d = new Date(y, m - 1, 1)
    d.setMonth(d.getMonth() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`
  }

  const fetchMonthlyEntries = useCallback(async () => {
    try {
      const monthDate = `${selectedMonth}-01`
      const nextMonth = getNextMonth(selectedMonth)
      const nextMonthDate = `${nextMonth}-01`

      const [resCur, resNext] = await Promise.all([
        supabase
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
              provider,
              currency
            )
          `)
          .eq('user_id', user?.id)
          .eq('month_year', monthDate)
          .order('due_date', { ascending: true }),
        supabase
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
              provider,
              currency
            )
          `)
          .eq('user_id', user?.id)
          .eq('month_year', nextMonthDate)
          .order('due_date', { ascending: true })
      ])

      if (resCur.error) throw resCur.error
      if (resNext.error) throw resNext.error

      const transformedCurrent = (resCur.data || []).map((entry: any) => ({
        ...entry,
        fixed_cost: entry.fixed_costs
      }))
      const transformedNext = (resNext.data || []).map((entry: any) => ({
        ...entry,
        fixed_cost: entry.fixed_costs
      }))

      setCurrentMonthEntries(transformedCurrent)
      setNextMonthEntries(transformedNext)
    } catch (error) {
      console.error('Error fetching monthly entries:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, supabase, user])

  useEffect(() => {
    if (user) {
      fetchFixedCosts()
      fetchMonthlyEntries()
    }
  }, [user, selectedMonth, fetchFixedCosts, fetchMonthlyEntries])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const amount = parseFloat(formData.amount)
      const estimatedAmount = formData.estimated_amount ? parseFloat(formData.estimated_amount) : null
      
      if (isNaN(amount) || amount <= 0) {
        alert(t('messages.invalidAmount'))
        return
      }

      const { data: insertedFixedCosts, error } = await supabase
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
          account_id: formData.account_id || null,
          is_active: true,
        }])
        .select('id, name, currency, account_id, start_date, due_day')

      if (error) throw error

      // Create initial monthly entry for this fixed cost (auto-repeat pattern)
      try {
        const created = Array.isArray(insertedFixedCosts) ? insertedFixedCosts[0] : null
        if (created?.id) {
          // Determine due date: prefer due_day on start month; fallback to start_date
          const startIso = (created.start_date as string) || new Date().toISOString().slice(0,10)
          const [y, m] = [Number(startIso.slice(0,4)), Number(startIso.slice(5,7))]
          const clampDay = (y: number, m: number, d: number) => {
            const lastDay = new Date(y, m, 0).getDate() // JS month is 1-based in this construction
            return Math.min(Math.max(1, d), lastDay)
          }
          const day = created.due_day ? clampDay(y, m, Number(created.due_day)) : Number(startIso.slice(8,10))
          const dueDate = `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const monthYear = `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-01`

          // Use the fixed amount as the initial entry amount
          const { error: entryErr } = await supabase
            .from('fixed_cost_entries')
            .insert([
              {
                user_id: user?.id,
                fixed_cost_id: created.id,
                month_year: monthYear,
                amount: amount,
                actual_amount: null,
                due_date: dueDate,
                payment_date: null,
                status: 'pending',
                notes: null
              }
            ])
          if (entryErr) throw entryErr

          // Create a planned debit movement on the paying account (if selected)
          if (created.account_id) {
            try {
              const { data: acct } = await supabase
                .from('accounts')
                .select('id, currency')
                .eq('id', created.account_id as string)
                .maybeSingle()
              const fromCur = (created.currency || 'EUR') as Currency
              const toCur = (acct?.currency || fromCur) as Currency
              const amt = convert(amount, fromCur, toCur)
              const marker = `fixed_cost:${created.id};planned:true;month:${monthYear.slice(0,7)}`
              await supabase
                .from('bank_account_transactions')
                .insert({
                  user_id: user?.id,
                  account_id: created.account_id as string,
                  category_id: null,
                  amount: amt,
                  currency: toCur,
                  description: `Custo fixo planejado: ${created.name || ''}`,
                  transaction_date: dueDate,
                  transaction_type: 'debit',
                  notes: marker
                })
            } catch (e) {
              console.warn('fixed-cost planned debit (on create) failed (non-blocking)', e)
            }
          }
        }
      } catch (e) {
        console.warn('auto-create initial fixed cost entry failed (non-blocking)', e)
      }

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
  auto_payment: false,
  account_id: ''
      })
      setShowForm(false)
      fetchFixedCosts()
      fetchMonthlyEntries()
      try { await fetch('/api/repasses', { method: 'PATCH', body: JSON.stringify({ op: 'refresh-planned' }) }) } catch {}
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

      // Support repeating entries (create a small batch)
      const entriesToCreate: any[] = []
      const addMonths = (iso: string, n: number) => {
        const d = new Date(iso)
        return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()).toISOString().slice(0,10)
      }
      const addWeeks = (iso: string, n: number) => {
        const d = new Date(iso)
        d.setDate(d.getDate() + (7*n))
        return d.toISOString().slice(0,10)
      }
      const addYears = (iso: string, n: number) => {
        const d = new Date(iso)
        return new Date(d.getFullYear() + n, d.getMonth(), d.getDate()).toISOString().slice(0,10)
      }
      const count = Math.max(1, Number(entryFormData.repeat_count) || 1)
      for (let i=0;i<count;i++) {
        const baseDue = entryFormData.due_date || monthDate
        let due = baseDue
        if (i>0) {
          if (entryFormData.repeat === 'monthly') due = addMonths(baseDue, i)
          else if (entryFormData.repeat === 'weekly') due = addWeeks(baseDue, i)
          else if (entryFormData.repeat === 'yearly') due = addYears(baseDue, i)
        }
        const mY = due.slice(0,7) + '-01'
        entriesToCreate.push({
          user_id: user?.id,
          fixed_cost_id: entryFormData.fixed_cost_id,
          month_year: mY,
          amount: amount,
          actual_amount: actualAmount,
          due_date: due,
          payment_date: entryFormData.payment_date || null,
          status: entryFormData.status,
          notes: entryFormData.notes || null
        })
      }

      let error: any = null
      if (editingEntryId) {
        // Update single entry (ignore repeat fields)
        const { data: prev } = await supabase
          .from('fixed_cost_entries')
          .select('id, fixed_cost_id, due_date')
          .eq('id', editingEntryId)
          .maybeSingle()
        const { error: upErr } = await supabase
          .from('fixed_cost_entries')
          .update({
            fixed_cost_id: entryFormData.fixed_cost_id,
            amount: amount,
            actual_amount: actualAmount,
            due_date: entryFormData.due_date || null,
            payment_date: entryFormData.payment_date || null,
            status: entryFormData.status,
            notes: entryFormData.notes || null,
            month_year: (entryFormData.due_date || monthDate).slice(0,7) + '-01'
          })
          .eq('id', editingEntryId)
        error = upErr
        // Update planned debit movement for the old/new due dates
        try {
          const { data: fc } = await supabase
            .from('fixed_costs')
            .select('id, account_id, currency, name')
            .eq('id', entryFormData.fixed_cost_id)
            .maybeSingle()
          const payAccountId = fc?.account_id
          if (payAccountId) {
            const oldDate = prev?.due_date || monthDate
            const newDate = entryFormData.due_date || monthDate
            const { data: acct } = await supabase.from('accounts').select('id, currency').eq('id', payAccountId).maybeSingle()
            const fromCur = (fc?.currency || 'EUR') as Currency
            const toCur = (acct?.currency || fromCur) as Currency
            const amt = convert(amount, fromCur, toCur)
            const marker = `fixed_cost:${entryFormData.fixed_cost_id};planned:true;month:${newDate.slice(0,7)}`
            // Remove any planned on old date
            await supabase
              .from('bank_account_transactions')
              .delete()
              .eq('user_id', user?.id)
              .eq('account_id', payAccountId)
              .eq('transaction_date', oldDate)
              .eq('transaction_type', 'debit')
              .like('notes', `%fixed_cost:${entryFormData.fixed_cost_id}%`)
            // Upsert on new date
            const { data: existing } = await supabase
              .from('bank_account_transactions')
              .select('id')
              .eq('user_id', user?.id)
              .eq('account_id', payAccountId)
              .eq('transaction_date', newDate)
              .eq('transaction_type', 'debit')
              .like('notes', `%fixed_cost:${entryFormData.fixed_cost_id}%`)
              .maybeSingle()
            if (existing?.id) {
              await supabase
                .from('bank_account_transactions')
                .update({ amount: amt, currency: toCur, description: `Custo fixo planejado: ${fc?.name || ''}`, notes: marker })
                .eq('id', existing.id)
                .eq('user_id', user?.id)
            } else {
              await supabase
                .from('bank_account_transactions')
                .insert({
                  user_id: user?.id,
                  account_id: payAccountId,
                  category_id: null,
                  amount: amt,
                  currency: toCur,
                  description: `Custo fixo planejado: ${fc?.name || ''}`,
                  transaction_date: newDate,
                  transaction_type: 'debit',
                  notes: marker
                })
            }
          }
        } catch (e) {
          console.warn('fixed-cost planned debit update failed (non-blocking)', e)
        }
      } else {
        const insRes = await supabase
          .from('fixed_cost_entries')
          .insert(entriesToCreate)
        error = insRes.error
      }

      if (error) throw error

      // Create/update a planned debit movement on the paying account
      try {
        const { data: fc } = await supabase
          .from('fixed_costs')
          .select('id, account_id, currency, name')
          .eq('id', entryFormData.fixed_cost_id)
          .maybeSingle()
        const payAccountId = fc?.account_id
        if (payAccountId) {
          const marker = `fixed_cost:${entryFormData.fixed_cost_id};planned:true;month:${selectedMonth}`
          const entryDate = entryFormData.due_date || `${selectedMonth}-01`
          // Convert amount into account currency if needed
          const { data: acct } = await supabase.from('accounts').select('id, currency').eq('id', payAccountId).maybeSingle()
          const fromCur = (fc?.currency || 'EUR') as Currency
          const toCur = (acct?.currency || fromCur) as Currency
          const amt = convert(amount, fromCur, toCur)
          const { data: existing } = await supabase
            .from('bank_account_transactions')
            .select('id')
            .eq('user_id', user?.id)
            .eq('account_id', payAccountId)
            .eq('transaction_date', entryDate)
            .eq('transaction_type', 'debit')
            .like('notes', `%fixed_cost:${entryFormData.fixed_cost_id}%`)
            .maybeSingle()
          if (existing?.id) {
            await supabase
              .from('bank_account_transactions')
              .update({ amount: amt, currency: toCur, description: `Custo fixo planejado: ${fc?.name || ''}`, notes: marker })
              .eq('id', existing.id)
              .eq('user_id', user?.id)
          } else {
            await supabase
              .from('bank_account_transactions')
              .insert({
                user_id: user?.id,
                account_id: payAccountId,
                category_id: null,
                amount: amt,
                currency: toCur,
                description: `Custo fixo planejado: ${fc?.name || ''}`,
                transaction_date: entryDate,
                transaction_type: 'debit',
                notes: marker
              })
          }
        }
      } catch (e) {
        console.warn('fixed-cost planned debit create failed (non-blocking)', e)
      }

      // Reset form and refresh data
  setEntryFormData({
        fixed_cost_id: '',
        amount: '',
        actual_amount: '',
        due_date: '',
        payment_date: '',
        status: 'pending',
        notes: '',
        repeat: 'none',
        repeat_count: 1
      })
      setShowEntryForm(false)
  setEditingEntryId(null)
      fetchMonthlyEntries()
      // Ask backend to refresh planned repasses based on updated profit
      try { await supabase.functions.invoke?.('noop') } catch {}
      try {
        await fetch('/api/repasses', { method: 'PATCH', body: JSON.stringify({ op: 'refresh-planned' }) })
      } catch {}
    } catch (error: any) {
      alert(t('messages.errorCreating') + error.message)
    }
  }

  const markEntryAsPaid = async (entryId: string, actualAmount?: number) => {
    try {
      const { data: entry } = await supabase
        .from('fixed_cost_entries')
        .select('id, fixed_cost_id, amount, actual_amount, due_date')
        .eq('id', entryId)
        .maybeSingle()

      const { error } = await supabase
        .from('fixed_cost_entries')
        .update({ 
          status: 'paid',
          payment_date: new Date().toISOString().split('T')[0],
          actual_amount: actualAmount || null
        })
        .eq('id', entryId)

      if (error) throw error

      // Update planned debit to posted amount or create if missing
      try {
        if (entry?.fixed_cost_id) {
          const { data: fc } = await supabase
            .from('fixed_costs')
            .select('id, account_id, currency, name')
            .eq('id', entry.fixed_cost_id)
            .maybeSingle()
          const payAccountId = fc?.account_id
          if (payAccountId) {
            const entryDate = entry?.due_date || new Date().toISOString().slice(0,10)
            const { data: acct } = await supabase.from('accounts').select('id, currency').eq('id', payAccountId).maybeSingle()
            const fromCur = (fc?.currency || 'EUR') as Currency
            const toCur = (acct?.currency || fromCur) as Currency
            const amtSrc = Number(actualAmount ?? entry?.actual_amount ?? entry?.amount ?? 0)
            const amt = convert(amtSrc, fromCur, toCur)
            const markerLike = `%fixed_cost:${entry.fixed_cost_id}%`
            const { data: planned } = await supabase
              .from('bank_account_transactions')
              .select('id')
              .eq('user_id', user?.id)
              .eq('account_id', payAccountId)
              .eq('transaction_date', entryDate)
              .eq('transaction_type', 'debit')
              .like('notes', markerLike)
              .maybeSingle()
            if (planned?.id) {
              await supabase
                .from('bank_account_transactions')
                .update({ amount: amt, currency: toCur, description: `Custo fixo: ${fc?.name || ''}`, notes: `fixed_cost:${entry.fixed_cost_id};planned:false` })
                .eq('id', planned.id)
                .eq('user_id', user?.id)
            } else {
              await supabase
                .from('bank_account_transactions')
                .insert({
                  user_id: user?.id,
                  account_id: payAccountId,
                  category_id: null,
                  amount: amt,
                  currency: toCur,
                  description: `Custo fixo: ${fc?.name || ''}`,
                  transaction_date: entryDate,
                  transaction_type: 'debit',
                  notes: `fixed_cost:${entry.fixed_cost_id};planned:false`
                })
            }
          }
        }
      } catch (e) {
        console.warn('fixed-cost post debit failed (non-blocking)', e)
      }
      fetchMonthlyEntries()
      try {
        await fetch('/api/repasses', { method: 'PATCH', body: JSON.stringify({ op: 'refresh-planned' }) })
      } catch {}
    } catch (error) {
      console.error('Error marking entry as paid:', error)
    }
  }

  const editEntry = async (entry: FixedCostEntry) => {
    // Simple inline edit: reuse form with current values
    setShowEntryForm(true)
  setEditingEntryId(entry.id)
    setEntryFormData({
      fixed_cost_id: entry.fixed_cost_id,
      amount: String(entry.amount || ''),
      actual_amount: String(entry.actual_amount || ''),
      due_date: entry.due_date || '',
      payment_date: entry.payment_date || '',
      status: entry.status,
      notes: entry.notes || '',
      repeat: 'none',
      repeat_count: 1
    })
  }

  const deleteEntry = async (entryId: string) => {
    if (!confirm(t('fixedCosts.deleteEntryConfirm') || 'Apagar lançamento?')) return
    try {
      // Also remove planned bank tx for this entry if present
      const { data: e } = await supabase
        .from('fixed_cost_entries')
        .select('fixed_cost_id, due_date')
        .eq('id', entryId)
        .maybeSingle()
      if (e?.fixed_cost_id && e?.due_date) {
        const { data: fc } = await supabase.from('fixed_costs').select('account_id').eq('id', e.fixed_cost_id).maybeSingle()
        if (fc?.account_id) {
          await supabase
            .from('bank_account_transactions')
            .delete()
            .eq('user_id', user?.id)
            .eq('account_id', fc.account_id)
            .eq('transaction_date', e.due_date)
            .eq('transaction_type', 'debit')
            .like('notes', `%fixed_cost:${e.fixed_cost_id}%`)
        }
      }
      const { error } = await supabase
        .from('fixed_cost_entries')
        .delete()
        .eq('id', entryId)
      if (error) throw error
      fetchMonthlyEntries()
      try { await fetch('/api/repasses', { method: 'PATCH', body: JSON.stringify({ op: 'refresh-planned' }) }) } catch {}
    } catch (err) {
      console.error('Error deleting entry', err)
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

  const generateEntriesForNextMonth = async () => {
    try {
      const nextMonth = getNextMonth(selectedMonth)
      const { data, error } = await supabase
        .rpc('generate_monthly_fixed_cost_entries', {
          target_month: `${nextMonth}-01`
        })
      if (error) throw error
      alert(`${data} lançamentos criados para ${nextMonth}`)
      fetchMonthlyEntries()
    } catch (error) {
      console.error('Error generating next month entries:', error)
    }
  }

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'weekly': return t('periods.weekly')
      case 'monthly': return t('periods.monthly')
  case 'bimonthly': return t('periods.bimonthly') || 'Bimonthly'
  case 'quarterly': return t('periods.quarterly') || 'Quarterly'
  case 'semiannual': return t('periods.semiannual') || 'Semiannual'
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
      let monthly: number
      switch (fc.billing_period) {
        case 'weekly':
          monthly = fc.amount * 4.33; break
        case 'monthly':
          monthly = fc.amount; break
        case 'bimonthly':
          monthly = fc.amount / 2; break
        case 'quarterly':
          monthly = fc.amount / 3; break
        case 'semiannual':
          monthly = fc.amount / 6; break
        case 'yearly':
          monthly = fc.amount / 12; break
        default:
          monthly = fc.amount; break
      }
      return sum + convert(monthly, (fc.currency as Currency), displayCurrency as Currency)
    }, 0)

  const totalActualMonth = currentMonthEntries
    .reduce((sum, entry) => {
      const amount = entry.actual_amount || entry.amount
      const fromCurrency = (entry.fixed_cost?.currency || 'EUR') as Currency
      return sum + convert(amount, fromCurrency, displayCurrency as Currency)
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
  try { await fetch('/api/repasses', { method: 'PATCH', body: JSON.stringify({ op: 'refresh-planned' }) }) } catch {}
    } catch (error) {
      console.error('Error toggling fixed cost:', error)
    }
  }

  const deleteFixedCost = async (id: string) => {
    if (!confirm(t('fixedCosts.deleteConfirm'))) return

    try {
      // Remove any planned bank tx for this fixed cost
      const { data: fc } = await supabase.from('fixed_costs').select('account_id').eq('id', id).maybeSingle()
      if (fc?.account_id) {
        await supabase
          .from('bank_account_transactions')
          .delete()
          .eq('user_id', user?.id)
          .eq('account_id', fc.account_id)
          .eq('transaction_type', 'debit')
          .like('notes', `%fixed_cost:${id}%`)
      }
      const { error } = await supabase
        .from('fixed_costs')
        .delete()
        .eq('id', id)

      if (error) throw error
      setFixedCosts(fixedCosts.filter(fc => fc.id !== id))
      try { await fetch('/api/repasses', { method: 'PATCH', body: JSON.stringify({ op: 'refresh-planned' }) }) } catch {}
    } catch (error) {
      console.error('Error deleting fixed cost:', error)
    }
  }

  const getMonthlyAmount = (amount: number, period: string) => {
    switch (period) {
      case 'weekly': return amount * 4.33
      case 'monthly': return amount
      case 'bimonthly': return amount / 2
      case 'quarterly': return amount / 3
      case 'semiannual': return amount / 6
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
                      {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency as Currency, minimumFractionDigits: 2 }).format(totalMonthlyBudget)}
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
                      {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency as Currency, minimumFractionDigits: 2 }).format(totalActualMonth)}
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
                    const entryCurrency = (entry.fixed_cost?.currency || 'EUR') as Currency
                    const shownAmount = convert((entry.actual_amount || entry.amount), entryCurrency, displayCurrency as Currency)
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
                              {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency as Currency, minimumFractionDigits: 2 }).format(shownAmount)}
                            </p>
                            {entry.actual_amount && entry.actual_amount !== entry.amount && (
                              <p className="text-sm text-gray-500">
                                ({t('fixedCosts.estimatedAmount')}: {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency as Currency, minimumFractionDigits: 2 }).format(convert(entry.amount, entryCurrency, displayCurrency as Currency))})
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
                            <button
                              onClick={() => editEntry(entry)}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                            >
                              {t('common.delete')}
                            </button>
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
                              {fc.name} - {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: fc.currency as Currency, minimumFractionDigits: 2 }).format(fc.estimated_amount || fc.amount)}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 text-xs text-gray-600">
                          {t('fixedCosts.noCosts')}
                          <button
                            type="button"
                            onClick={() => { setActiveTab('fixed-costs'); setShowForm(true); setShowEntryForm(false) }}
                            className="ml-2 text-primary hover:underline"
                          >
                            {t('fixedCosts.newCost')}
                          </button>
                        </div>
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('common.repeat') || 'Repetir'}
                        </label>
                        <div className="flex space-x-2">
                          <select
                            value={entryFormData.repeat}
                            onChange={(e) => setEntryFormData(prev => ({ ...prev, repeat: e.target.value as any }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                          >
                            <option value="none">{t('common.none') || 'Nenhum'}</option>
                            <option value="weekly">{getPeriodLabel('weekly')}</option>
                            <option value="monthly">{getPeriodLabel('monthly')}</option>
                            <option value="yearly">{getPeriodLabel('yearly')}</option>
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={entryFormData.repeat_count}
                            onChange={(e) => setEntryFormData(prev => ({ ...prev, repeat_count: Number(e.target.value || 1) }))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                          />
                        </div>
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

            {/* Next Month Preview */}
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium">{t('fixedCosts.nextMonth') || 'Mês seguinte'} - {getNextMonth(selectedMonth)}</h3>
                <button
                  onClick={generateEntriesForNextMonth}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  {t('fixedCosts.generateEntries')}
                </button>
              </div>

              {nextMonthEntries.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {nextMonthEntries.map((entry) => {
                    const IconComponent = COST_TYPE_ICONS[entry.fixed_cost.cost_type as keyof typeof COST_TYPE_ICONS] || DollarSign
                    const entryCurrency = (entry.fixed_cost?.currency || 'EUR') as Currency
                    const shownAmount = convert((entry.actual_amount || entry.amount), entryCurrency, displayCurrency as Currency)
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
                              {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency as Currency, minimumFractionDigits: 2 }).format(shownAmount)}
                            </p>
                            {entry.actual_amount && entry.actual_amount !== entry.amount && (
                              <p className="text-sm text-gray-500">
                                ({t('fixedCosts.estimatedAmount')}: {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency as Currency, minimumFractionDigits: 2 }).format(convert(entry.amount, entryCurrency, displayCurrency as Currency))})
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(entry.status)}
                            <button
                              onClick={() => editEntry(entry)}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">{t('fixedCosts.noEntriesThisMonth') || 'Sem lançamentos neste mês'}</p>
                  <p className="text-gray-400 text-sm">{t('fixedCosts.tipGenerateNext') || 'Use o botão acima para gerar os lançamentos do próximo mês.'}</p>
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

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('common.currency')}
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as Currency }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="BRL">BRL (R$)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                  </div>

                  {/* Period and scheduling */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.billingPeriod') || 'Billing period'}
                      </label>
                      <select
                        value={formData.billing_period}
                        onChange={(e) => setFormData(prev => ({ ...prev, billing_period: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      >
                        <option value="weekly">{getPeriodLabel('weekly')}</option>
                        <option value="monthly">{getPeriodLabel('monthly')}</option>
                        <option value="bimonthly">{getPeriodLabel('bimonthly')}</option>
                        <option value="quarterly">{getPeriodLabel('quarterly')}</option>
                        <option value="semiannual">{getPeriodLabel('semiannual')}</option>
                        <option value="yearly">{getPeriodLabel('yearly')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.startDate') || 'Start date'}
                      </label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('fixedCosts.dueDay') || 'Due day'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={(formData.due_day as any) || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, due_day: (e.target.value ? Number(e.target.value) : '' as any) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('messages.selectAccount')}
                      </label>
                      <select
                        value={formData.account_id}
                        onChange={(e)=> setFormData(prev=>({...prev, account_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      >
                        <option value="">{t('common.select')}</option>
                        {accounts.filter(a=>a.is_active).map(a => (
                          <option key={a.id} value={a.id}>{a.name}{a.bank_name?` (${a.bank_name})`:''}</option>
                        ))}
                      </select>
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
                    const IconComponent = COST_TYPE_ICONS[fixedCost.cost_type as keyof typeof COST_TYPE_ICONS] || DollarSign
                    return (
                      <div key={fixedCost.id} className={`p-6 ${!fixedCost.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-lg ${COST_TYPE_COLORS[fixedCost.cost_type as keyof typeof COST_TYPE_COLORS]}`}>
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
                                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: fixedCost.currency as Currency, minimumFractionDigits: 2 }).format(fixedCost.amount)}
                              </p>
                              {fixedCost.estimated_amount && (
                                <p className="text-sm text-gray-500">
                                  ~{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: fixedCost.currency as Currency, minimumFractionDigits: 2 }).format(fixedCost.estimated_amount)}
                                </p>
                              )}
                              <p className="text-sm text-gray-500">
                                {(() => {
                                  const monthly = getMonthlyAmount(fixedCost.amount, fixedCost.billing_period)
                                  const converted = convert(monthly, fixedCost.currency as Currency, displayCurrency as Currency)
                                  return `≈ ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency as Currency, minimumFractionDigits: 2 }).format(converted)}/${t('fixedCosts.monthly')}`
                                })()}
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
