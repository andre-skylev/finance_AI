"use client"

import { useEffect, useMemo, useState } from 'react'
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
  currency: 'EUR'|'BRL'
  period: 'monthly'|'weekly'|'yearly'
  mode?: 'absolute'|'percent_income'
  percent?: number|null
  is_active?: boolean
}

export default function BudgetsPage(){
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = createClient()
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

  useEffect(()=>{ if(user){ load() } },[user])

  const load = async ()=>{
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
  }

  const openNew = ()=>{ setEditing(null); setForm({ category_id:'', amount:0, currency:'EUR', period:'monthly', mode:'absolute', percent: undefined }); setOpen(true) }
  const openEdit = (row:any)=>{
    setEditing({
      id: row.id,
      user_id: user!.id,
      category_id: row.category_id,
      amount: row.budgeted,
      currency: row.currency,
      period: row.period,
      mode: 'absolute',
      percent: undefined,
    } as any)
    setForm({ category_id: row.category_id, amount: row.budgeted, currency: row.currency, period: row.period, mode: 'absolute', percent: undefined })
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
    // Current month bounds
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0)
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
            <p className="text-muted-foreground">Defina limites de gastos por categoria</p>
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4"/>Novo Orçamento</Button>
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
                  <th className="p-2 text-left">Categoria</th>
                  <th className="p-2 text-right">Orçado</th>
                  <th className="p-2 text-right">Gasto</th>
                  <th className="p-2 text-right">Uso</th>
                  <th className="p-2"/>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b:any)=> (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="p-2">{b.category || 'Outros'}</td>
                    <td className="p-2 text-right">{new Intl.NumberFormat('pt-PT',{style:'currency',currency:b.currency}).format(b.budgeted||0)}</td>
                    <td className="p-2 text-right">{new Intl.NumberFormat('pt-PT',{style:'currency',currency:b.currency}).format(b.actual||0)}</td>
                    <td className={`p-2 text-right ${b.usage_percentage>=100?'text-red-600':b.usage_percentage>=80?'text-amber-600':'text-green-600'}`}>{(b.usage_percentage||0).toFixed(0)}%</td>
                    <td className="p-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button variant="outline" size="sm" onClick={()=>openEdit(b)}>Editar</Button>
                        <Button variant="destructive" size="sm" onClick={()=>remove(b.id)}>Excluir</Button>
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
              <DialogTitle>{editing? 'Editar Orçamento':'Novo Orçamento'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm">Categoria</label>
                <select className="w-full border rounded px-2 py-2" value={form.category_id as any} onChange={(e)=>setForm(f=>({...f, category_id:e.target.value}))}>
                  <option value="">Selecione</option>
                  {categories.map((c:any)=>(<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-sm">Moeda</label>
                <select className="w-full border rounded px-2 py-2" value={form.currency as any} onChange={(e)=>setForm(f=>({...f, currency:e.target.value as any}))}>
                  <option value="EUR">EUR</option>
                  <option value="BRL">BRL</option>
                </select>
              </div>
              <div>
                <label className="text-sm">Modo</label>
                <select className="w-full border rounded px-2 py-2" value={form.mode as any} onChange={(e)=>setForm(f=>({...f, mode:e.target.value as any}))}>
                  <option value="absolute">Valor fixo</option>
                  <option value="percent_income">% da renda mensal</option>
                </select>
              </div>
              {form.mode === 'percent_income' ? (
                <div>
                  <label className="text-sm">Percentual (%)</label>
                  <Input type="number" value={(form.percent as any) || ''} onChange={(e)=>setForm(f=>({...f, percent:e.target.value as any}))} />
                </div>
              ) : (
                <div>
                  <label className="text-sm">Valor</label>
                  <Input type="number" value={(form.amount as any) || ''} onChange={(e)=>setForm(f=>({...f, amount:e.target.value as any}))} />
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
