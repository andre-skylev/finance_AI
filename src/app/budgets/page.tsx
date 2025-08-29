"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '@/contexts/LanguageContext'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, BarChart3 } from 'lucide-react'

type Budget = {
  id: string
  user_id: string
  category_id: string
  amount: number
  currency: 'EUR'|'BRL'|'USD'
  period: 'monthly'|'weekly'|'yearly'|'semiannual'|'one_time'|'custom'
  mode?: 'absolute'|'percent_income'
  percent?: number|null
  is_active?: boolean
}

export default function BudgetsPage(){
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = useMemo(() => createClient(), [])
  const [budgets, setBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Budget|null>(null)
  const [categories, setCategories] = useState<any[]>([])

  const [form, setForm] = useState<Partial<Budget>>({
    category_id: '',
    amount: 0,
    currency: 'EUR',
    period: 'monthly',
    mode: 'absolute',
    percent: undefined,
  })
  const [referenceDate, setReferenceDate] = useState<string>(new Date().toISOString().slice(0,10))
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')

  const load = useCallback(async ()=>{
    try{
      setLoading(true)
      const { data: cats } = await supabase
        .from('categories')
        .select('id,name,type')
        .or('user_id.eq.'+user!.id+',is_default.eq.true')
      setCategories((cats||[]).filter((c:any)=>c.type==='expense'))

      // Use API to compute Budget vs Actual without SQL view
      const res = await fetch(`/api/dashboard?type=budget-vs-actual`, { cache: 'no-store' })
      const json = await res.json()
      setBudgets(json?.data||[])
    } finally {
      setLoading(false)
    }
  }, [supabase, user])

  useEffect(()=>{ if(user){ load() } },[user, load])

  const openNew = ()=>{ 
    setEditing(null); 
    setForm({ category_id:'', amount:0, currency:'EUR', period:'monthly', mode:'absolute', percent: undefined }); 
    setReferenceDate(new Date().toISOString().slice(0,10))
    setCustomStart('')
    setCustomEnd('')
    setOpen(true) 
  }
  const openEdit = async (row:any)=>{
    // Fetch original budget to get mode/percent
    const { data: orig } = await supabase
      .from('budgets')
      .select('id, user_id, category_id, amount, currency, period, start_date, end_date, mode, percent')
      .eq('id', row.id)
      .maybeSingle()
    const mode = (orig?.mode as any) || 'absolute'
    const percent = (orig?.percent as any) ?? undefined
    setEditing({
      id: row.id,
      user_id: user!.id,
      category_id: row.category_id,
      amount: Number(orig?.amount ?? row.budgeted ?? 0),
      currency: row.currency,
      period: row.period,
      mode,
      percent: percent as any,
    } as any)
    setForm({ category_id: row.category_id, amount: Number(orig?.amount ?? row.budgeted ?? 0), currency: row.currency, period: row.period, mode, percent })
    setReferenceDate((row.start_date as string) || new Date().toISOString().slice(0,10))
    setCustomStart(row.start_date || '')
    setCustomEnd(row.end_date || '')
    setOpen(true)
  }

  const save = async ()=>{
    if(!user) return
    if(!form.category_id){ alert('Selecione uma categoria'); return }
    if(form.mode === 'percent_income'){
      const p = Number(form.percent||0)
      if(!(p>0)){ alert('Informe um percentual > 0'); return }
    }else{
      const v = Number(form.amount||0)
      if(!(v>0)){ alert('Informe um valor > 0'); return }
    }
    // Compute bounds based on selected period
    const ref = new Date(referenceDate + 'T00:00:00')
    const startOfWeek = (d: Date) => {
      const day = (d.getDay() + 6) % 7 // Monday=0
      const s = new Date(d)
      s.setDate(d.getDate() - day)
      s.setHours(0,0,0,0)
      return s
    }
    let start = new Date(ref)
    let end = new Date(ref)
    switch(form.period){
      case 'weekly':
        start = startOfWeek(ref)
        end = new Date(start)
        end.setDate(start.getDate() + 6)
        break
      case 'monthly':
        start = new Date(ref.getFullYear(), ref.getMonth(), 1)
        end = new Date(ref.getFullYear(), ref.getMonth()+1, 0)
        break
      case 'yearly':
        start = new Date(ref.getFullYear(), 0, 1)
        end = new Date(ref.getFullYear(), 11, 31)
        break
      case 'semiannual':
        if (ref.getMonth() < 6) { // H1
          start = new Date(ref.getFullYear(), 0, 1)
          end = new Date(ref.getFullYear(), 5, 30)
        } else { // H2
          start = new Date(ref.getFullYear(), 6, 1)
          end = new Date(ref.getFullYear(), 11, 31)
        }
        break
      case 'one_time':
        start = new Date(ref)
        end = new Date(ref)
        break
      case 'custom':
        if (!customStart || !customEnd) { alert('Informe início e fim do período'); return }
        start = new Date(customStart + 'T00:00:00')
        end = new Date(customEnd + 'T00:00:00')
        break
      default:
        start = new Date(ref.getFullYear(), ref.getMonth(), 1)
        end = new Date(ref.getFullYear(), ref.getMonth()+1, 0)
    }
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    const payload:any = {
      user_id: user.id,
      category_id: form.category_id,
      currency: form.currency,
      period: form.period,
      is_active: true,
      start_date: startStr,
      end_date: endStr,
    }
    if(form?.mode === 'percent_income'){
      payload.mode = 'percent_income';
      payload.percent = Number(form.percent||0)
      payload.amount = 0
    }else{
      payload.mode = 'absolute';
      payload.amount = Number(form.amount||0)
      payload.percent = null
    }
    try{
      if(editing){
        const { error } = await supabase.from('budgets').update(payload).eq('id', editing.id)
        if(error) throw error
      }else{
        const { error } = await supabase.from('budgets').insert([payload])
        if(error) throw error
      }
    }catch(e:any){
      alert('Falha ao salvar orçamento: ' + (e?.message||''))
      return
    }
    setOpen(false)
    setEditing(null)
    await load()
  }

  const remove = async (id:string)=>{
    if(!confirm('Delete budget?')) return
    await supabase.from('budgets').delete().eq('id', id)
    await load()
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t('dashboard.budgetVsActual')}</h1>
            <p className="text-muted-foreground">{t('budgetsPage.subtitle')}</p>
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4"/>{t('budgetsPage.new')}</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary"/>
          </div>
        ) : budgets.length===0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-sm text-muted-foreground">{t('dashboard.noBudgetData') || 'Sem dados de orçamento'}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('dashboard.noBudgetDataDesc') || 'Configure orçamentos para ver comparações'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">{t('transactions.category')}</th>
                  <th className="p-2 text-left">{t('fixedCosts.period')}</th>
                  <th className="p-2 text-right">{t('dashboard.budgeted')}</th>
                  <th className="p-2 text-right">{t('dashboard.actual')}</th>
                  <th className="p-2 text-right">{t('budgetsPage.usage')}</th>
                  <th className="p-2"/>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b:any)=> (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="p-2">{b.category || 'Outros'}</td>
                    <td className="p-2 text-left whitespace-nowrap text-xs text-muted-foreground">{t(`periods.${b.period}`)} · {b.start_date} → {b.end_date}</td>
                    <td className="p-2 text-right">{new Intl.NumberFormat('pt-PT',{style:'currency',currency:b.currency}).format(b.budgeted||0)}</td>
                    <td className="p-2 text-right">{new Intl.NumberFormat('pt-PT',{style:'currency',currency:b.currency}).format(b.actual||0)}</td>
                    <td className={`p-2 text-right ${b.usage_percentage>=100?'text-red-600':b.usage_percentage>=80?'text-amber-600':'text-green-600'}`}>{(b.usage_percentage||0).toFixed(0)}%</td>
                    <td className="p-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button variant="outline" size="sm" onClick={()=>openEdit(b)}>{t('common.edit')}</Button>
                        <Button variant="destructive" size="sm" onClick={()=>remove(b.id)}>{t('common.delete')}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing? t('budgetsPage.editTitle') : t('budgetsPage.newTitle')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm">{t('transactions.category')}</label>
                <select className="w-full border rounded px-2 py-2" value={form.category_id as any} onChange={(e)=>setForm(f=>({...f, category_id:e.target.value}))}>
                  <option value="">{t('common.select')}</option>
                  {categories.map((c:any)=>(<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-sm">{t('card.currency')}</label>
                <select className="w-full border rounded px-2 py-2" value={form.currency as any} onChange={(e)=>setForm(f=>({...f, currency:e.target.value as any}))}>
                  <option value="EUR">EUR</option>
                  <option value="BRL">BRL</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-sm">{t('fixedCosts.period')}</label>
                <select className="w-full border rounded px-2 py-2" value={form.period as any} onChange={(e)=>setForm(f=>({...f, period:e.target.value as any}))}>
                  <option value="weekly">{t('periods.weekly')}</option>
                  <option value="monthly">{t('periods.monthly')}</option>
                  <option value="semiannual">{t('periods.semiannual')}</option>
                  <option value="yearly">{t('periods.yearly')}</option>
                  <option value="one_time">{t('periods.one_time')}</option>
                  <option value="custom">{t('periods.custom')}</option>
                </select>
              </div>
              {form.period !== 'custom' ? (
                <div>
                  <label className="text-sm">{t('budgetsPage.reference')}</label>
                  <Input type="date" value={referenceDate} onChange={(e)=>setReferenceDate(e.target.value)} />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm">{t('budgetsPage.start')}</label>
                    <Input type="date" value={customStart} onChange={(e)=>setCustomStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">{t('budgetsPage.end')}</label>
                    <Input type="date" value={customEnd} onChange={(e)=>setCustomEnd(e.target.value)} />
                  </div>
                </>
              )}
              <div>
                <label className="text-sm">{t('budgetsPage.mode')}</label>
                <select className="w-full border rounded px-2 py-2" value={form.mode as any} onChange={(e)=>setForm(f=>({...f, mode:e.target.value as any}))}>
                  <option value="absolute">{t('budgetsPage.modes.absolute')}</option>
                  <option value="percent_income">{t('budgetsPage.modes.percentIncome')}</option>
                  <option value="percent_profit">{t('budgetsPage.modes.percentProfit')}</option>
                </select>
              </div>
              {form.mode === 'percent_income' ? (
                <div>
                  <label className="text-sm">{t('budgetsPage.percentLabel')}</label>
                  <Input type="number" value={(form.percent as any) || ''} onChange={(e)=>setForm(f=>({...f, percent:e.target.value as any}))} />
                </div>
              ) : (
                <div>
                  <label className="text-sm">{t('fixedCosts.amount')}</label>
                  <Input type="number" value={(form.amount as any) || ''} onChange={(e)=>setForm(f=>({...f, amount:e.target.value as any}))} />
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">{t('common.cancel')}</Button>
              </DialogClose>
              <Button onClick={save}>{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
