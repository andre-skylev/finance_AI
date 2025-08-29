"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useLanguage } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { useAccounts } from '@/hooks/useFinanceData'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import CurrencyDropdown from '@/components/CurrencyDropdown'
import { Loader2 } from 'lucide-react'

type Rule = { id: string; name: string; percentage: number; payout_day: number; is_active: boolean; is_recurring?: boolean }
type Forecast = { rule_id: string; name: string; percentage: number; payout_day: number; is_recurring?: boolean; amount: number; currency: string; base_profit?: number; executed?: number; available?: number; horizon?: string }

export default function RepassesPage() {
  const { language, t } = useLanguage()
  const supabase = useMemo(() => createClient(), [])
  const { accounts } = useAccounts()
  const { format, displayCurrency } = useCurrency()

  const [rules, setRules] = useState<Rule[]>([])
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10))
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [profit, setProfit] = useState<number>(0)
  const [currency, setCurrency] = useState<'EUR'|'BRL'|'USD'>('EUR')
  // Loading state as a concurrent-safe counter
  const [pending, setPending] = useState(0)
  const isLoading = pending > 0
  const [executions, setExecutions] = useState<any[]>([])
  const [editing, setEditing] = useState<null | { rule: Rule, targets: {account_id:string; share_percent:number}[], sources: string[], sourceCards: string[] }>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const refreshTimer = useRef<number | null>(null)

  const labels = useMemo(() => ({
    title: language==='pt' ? 'Repasses' : 'Payouts',
    subtitle: language==='pt' ? 'Configure regras de repasse e execute com base no lucro' : 'Configure payout rules and execute based on profit',
    newRule: language==='pt' ? 'Nova Regra' : 'New Rule',
    name: language==='pt' ? 'Nome' : 'Name',
    percentage: language==='pt' ? 'Percentual (%)' : 'Percentage (%)',
    payoutDay: language==='pt' ? 'Dia do repasse' : 'Payout day',
  account: language==='pt' ? 'Conta de saída' : 'Source account',
    active: language==='pt' ? 'Ativa' : 'Active',
    save: language==='pt' ? 'Salvar' : 'Save',
    delete: language==='pt' ? 'Excluir' : 'Delete',
    forecast: language==='pt' ? 'Previsão' : 'Forecast',
    date: language==='pt' ? 'Data' : 'Date',
    run: language==='pt' ? 'Executar repasse' : 'Run payout',
    total: language==='pt' ? 'Total' : 'Total',
    profit: language==='pt' ? 'Lucro até a data' : 'Profit until date',
  }), [language])

  const track = useCallback(async <T,>(fn: () => Promise<T>) => {
    setPending((p) => p + 1)
    try { return await fn() } finally { setPending((p) => Math.max(0, p - 1)) }
  }, [])

  const loadRules = useCallback(async () => {
    await track(async () => {
      const res = await fetch('/api/repasses')
      const j = await res.json()
      setRules((j.rules || []).map((r: any) => ({ id: r.id, name: r.name, percentage: r.percentage, payout_day: r.payout_day, is_active: r.is_active, is_recurring: r.is_recurring })))
    })
  }, [track])

  const loadForecast = useCallback(async (d: string) => {
    await track(async () => {
      const res = await fetch(`/api/repasses?action=forecast&date=${d}&currency=${displayCurrency}`)
      const j = await res.json()
      setForecasts((j.forecasts || []).map((f: any) => ({ rule_id: f.rule_id, name: f.name, percentage: f.percentage, payout_day: f.payout_day, is_recurring: f.is_recurring, amount: f.amount, currency: f.currency, base_profit: f.base_profit, executed: f.executed, available: f.available, horizon: f.horizon })))
      setProfit(j.profit || 0)
      setCurrency(j.currency || 'EUR')
    })
  }, [displayCurrency, track])

  const loadExecutions = useCallback(async () => {
    await track(async () => {
      const res = await fetch('/api/repasses?action=executions&limit=10')
      const j = await res.json()
      setExecutions(j.executions || [])
    })
  }, [track])

  const startEditRule = useCallback(async (rule: Rule) => {
    // Load targets and sources directly via supabase client (RLS enforced)
    const [tRes, sRes] = await Promise.all([
      supabase.from('repasse_rule_targets').select('account_id, share_percent').eq('rule_id', rule.id),
      supabase.from('repasse_rule_sources').select('account_id, credit_card_id').eq('rule_id', rule.id)
    ])
    const targets = (tRes.data || []).map((r: any) => ({ account_id: r.account_id, share_percent: Number(r.share_percent || 0) }))
    const sources = (sRes.data || []).map((r: any) => r.account_id).filter(Boolean)
    const sourceCards = (sRes.data || []).map((r: any) => r.credit_card_id).filter(Boolean)
    setEditing({ rule, targets, sources, sourceCards })
  }, [supabase])

  useEffect(() => { loadRules(); loadForecast(date); loadExecutions() }, [loadRules, loadForecast, loadExecutions, date])
  useEffect(() => { loadForecast(date) }, [displayCurrency, date, loadForecast])

  // Fetch current user id for realtime filters
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser()
        setUserId(data.user?.id || null)
      } catch {}
    })()
  }, [supabase])

  // Realtime: refresh forecasts when account movements change (insert/update/delete)
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('repasses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_account_transactions', filter: `user_id=eq.${userId}` }, () => {
        if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
        refreshTimer.current = window.setTimeout(() => { loadForecast(date); loadExecutions() }, 500)
      })
      // Also listen to fixed cost entries and credit card transactions which can impact profit
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_cost_entries', filter: `user_id=eq.${userId}` }, () => {
        if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
        refreshTimer.current = window.setTimeout(() => { loadForecast(date); loadExecutions() }, 500)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_card_transactions', filter: `user_id=eq.${userId}` }, () => {
        if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
        refreshTimer.current = window.setTimeout(() => { loadForecast(date); loadExecutions() }, 500)
      })
      .subscribe()

    return () => { supabase.removeChannel?.(channel) }
  }, [supabase, userId, loadForecast, loadExecutions, date])

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{labels.title}</h1>
            <p className="text-gray-600">{labels.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <CurrencyDropdown />
            <button onClick={loadRules} className="px-3 py-2 border rounded-md">Reload</button>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          {isLoading && (
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {language==='pt' ? 'Atualizando repasses…' : 'Refreshing payouts…'}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm">{labels.date}</label>
            <input type="date" value={date} onChange={(e)=>{ setDate(e.target.value); loadForecast(e.target.value) }} className="px-3 py-2 border rounded-md" />
            <div className="ml-auto text-sm text-gray-700">
              {labels.profit}: <span className="font-semibold">{format(profit, currency as any)}</span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-3">{labels.name}</th>
                  <th className="py-2 px-3">{labels.percentage}</th>
                  <th className="py-2 px-3">{labels.payoutDay}</th>
                  <th className="py-2 px-3 text-right">{labels.forecast}</th>
                  <th className="py-2 px-3 text-right">{language==='pt'?'Disponível':'Available'}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f) => {
                  const rule = rules.find(r => r.id === f.rule_id)
                  return (
                    <tr key={f.rule_id} className="border-b">
                      <td className="py-2 px-3">{f.name}{rule?.is_recurring ? ' • ' + (language==='pt'?'Recorrente':'Recurring') : ''}</td>
                      <td className="py-2 px-3">{f.percentage}%</td>
                      <td className="py-2 px-3">{f.payout_day}</td>
                      <td className="py-2 px-3 text-right font-medium">{format(f.amount, f.currency as any)}</td>
                      <td className="py-2 px-3 text-right">{format(f.available ?? 0, f.currency as any)}</td>
                      <td className="py-2 px-3 text-right space-x-2">
                        <button
                          className="px-3 py-1 border rounded-md hover:bg-gray-50"
                          onClick={async()=>{
                            const execDate = f.horizon || date
                            const res = await fetch('/api/repasses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rule_id: f.rule_id, date: execDate, amount: f.amount, source_currency: currency }) })
                            if (!res.ok) {
                              const j = await res.json().catch(()=>({}))
                              return alert(j.error || 'Failed')
                            }
                            alert(language==='pt'?'Repasse registrado':'Payout recorded')
                            loadForecast(date); loadExecutions()
                          }}
                        >{labels.run}</button>
                        <button
                          className="px-3 py-1 border rounded-md hover:bg-gray-50"
                          onClick={()=>{
                            const r = rules.find(r=>r.id===f.rule_id)
                            if (r) startEditRule(r)
                          }}
                        >{language==='pt'?'Editar':'Edit'}</button>
                        <button
                          className="px-3 py-1 border rounded-md hover:bg-gray-50 text-red-600"
                          onClick={async()=>{
                            if (!confirm(language==='pt'?'Excluir esta regra?':'Delete this rule?')) return
                            const res = await fetch(`/api/repasses?id=${encodeURIComponent(f.rule_id)}`, { method: 'DELETE' })
                            if (!res.ok) { const j = await res.json().catch(()=>({})); return alert(j.error||'Failed') }
                            await loadRules(); await loadForecast(date)
                          }}
                        >{labels.delete}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-3 text-sm">
            <span className="text-gray-600 mr-2">{labels.total}:</span>
            <span className="font-semibold">{format(forecasts.reduce((s,f)=>s+f.amount,0), currency as any)}</span>
          </div>
        </div>

        <RuleForm
          key={editing?.rule.id || 'new'}
          editing={editing ? { id: editing.rule.id } : undefined}
          initial={editing ? {
            name: editing.rule.name,
            percentage: String(editing.rule.percentage),
            payout_day: String(editing.rule.payout_day),
            is_recurring: !!editing.rule.is_recurring,
            targets: editing.targets,
            sources: editing.sources
          } : undefined}
          onCancelEdit={()=> setEditing(null)}
          onSaved={()=>{ setEditing(null); loadRules(); loadForecast(date) }}
        />

        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-medium">{language==='pt'?'Execuções recentes':'Recent executions'}</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-3">{language==='pt'?'Data':'Date'}</th>
                  <th className="py-2 px-3">{labels.name}</th>
                  <th className="py-2 px-3">{labels.account}</th>
                  <th className="py-2 px-3 text-right">{labels.total}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {executions.map((e)=>{
                  const rule = rules.find(r=>r.id===e.rule_id)
                  const acct = accounts.find(a=>a.id===e.account_id)
                  return (
                    <tr key={e.id} className="border-b">
                      <td className="py-2 px-3">{new Date(e.execution_date).toLocaleDateString('pt-PT')}</td>
                      <td className="py-2 px-3">{rule?.name || '-'}</td>
                      <td className="py-2 px-3">{acct ? `${acct.name}${acct.bank_name ? ' ('+acct.bank_name+')' : ''}` : '-'}</td>
                      <td className="py-2 px-3 text-right">{format(e.amount, (e.currency||'EUR'))}</td>
                      <td className="py-2 px-3 text-right">
                        <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={async()=>{
                          if (!confirm(language==='pt'?'Remover execução?':'Remove execution?')) return
                          const res = await fetch('/api/repasses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'delete-execution', execution_id: e.id }) })
                          if (!res.ok) return alert('Failed')
                          loadExecutions(); loadForecast(date)
                        }}>{labels.delete}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function RuleForm({ onSaved, editing, initial, onCancelEdit }: {
  onSaved: () => void
  editing?: { id: string }
  initial?: { name: string; percentage: string; payout_day: string; is_recurring: boolean; targets: { account_id: string; share_percent: number }[]; sources: string[]; sourceCards?: string[] }
  onCancelEdit?: () => void
}) {
  const { language } = useLanguage()
  const [form, setForm] = useState({ name: '', percentage: '', payout_day: '', is_recurring: true })
  const [targets, setTargets] = useState<{ account_id: string; share_percent: string }[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [sourceCards, setSourceCards] = useState<string[]>([])
  const { accounts } = useAccounts()
  const [creditCards, setCreditCards] = useState<{ id: string; card_name: string; bank_name?: string|null; is_active?: boolean }[]>([])
  const sumTargets = targets.reduce((s,t)=> s + (Number(t.share_percent) || 0), 0)
  const targetsValid = targets.length === 0 || Math.abs(sumTargets - 100) < 0.001

  // Prefill when editing toggles
  useEffect(() => {
    if (editing && initial) {
      setForm({
        name: initial.name || '',
        percentage: initial.percentage || '',
        payout_day: initial.payout_day || '',
        is_recurring: !!initial.is_recurring
      })
      setTargets((initial.targets || []).map(t => ({ account_id: t.account_id, share_percent: String(t.share_percent) })))
      setSources(initial.sources || [])
      setSourceCards(initial.sourceCards || [])
    } else {
      // reset for new rule
      setForm({ name: '', percentage: '', payout_day: '', is_recurring: true })
      setTargets([])
      setSources([])
      setSourceCards([])
    }
  }, [editing, initial])

  // Load user's credit cards for selection
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('credit_cards')
          .select('id, card_name, bank_name, is_active')
          .eq('user_id', user.id)
        setCreditCards((data || []) as any)
      } catch {}
    })()
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{editing ? (language==='pt'?'Editar Regra':'Edit Rule') : (language==='pt'?'Nova Regra':'New Rule')}</CardTitle>
          {editing && (
            <Button
              variant="destructive"
              onClick={async()=>{
                if (!editing?.id) return
                if (!confirm(language==='pt'?'Excluir esta regra?':'Delete this rule?')) return
                const res = await fetch(`/api/repasses?id=${encodeURIComponent(editing.id)}`, { method: 'DELETE' })
                if (!res.ok) { const j = await res.json().catch(()=>({})); return alert(j.error||'Failed') }
                onSaved()
              }}
            >{language==='pt'?'Excluir':'Delete'}</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
  <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>{language==='pt'?'Nome':'Name'}</Label>
            <Input placeholder={language==='pt'?'Nome':'Name'} value={form.name} onChange={(e)=>setForm(p=>({...p,name:e.target.value}))} />
          </div>
          <div className="space-y-1">
            <Label>{language==='pt'?'Percentual (%)':'Percentage (%)'}</Label>
            <Input type="number" step="0.01" placeholder="0" value={form.percentage} onChange={(e)=>setForm(p=>({...p,percentage:e.target.value}))} />
          </div>
          <div className="space-y-1">
            <Label>{language==='pt'?'Dia (1-31)':'Day (1-31)'}</Label>
            <Input type="number" min={1} max={31} placeholder="1" value={form.payout_day} onChange={(e)=>setForm(p=>({...p,payout_day:e.target.value}))} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" className="accent-primary" checked={form.is_recurring} onChange={(e)=>setForm(p=>({...p,is_recurring:e.target.checked}))} />
            {language==='pt'?'Recorrente (divisão de lucros)':'Recurring (profit sharing)'}
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{language==='pt'?'Contas de destino (opcional)':'Target accounts (optional)'}</h4>
            <Button variant="outline" size="sm" onClick={()=>setTargets(t=>[...t,{ account_id:'', share_percent:'' }])}>{language==='pt'?'Adicionar conta':'Add account'}</Button>
          </div>
          {targets.map((t,idx)=> (
            <div key={idx} className="grid gap-2 sm:grid-cols-3">
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={t.account_id} onChange={(e)=>setTargets(list=>list.map((x,i)=>i===idx?{...x,account_id:e.target.value}:x))}>
                <option value="">{language==='pt'?'Conta':'Account'}</option>
                {accounts.filter(a=>a.is_active).map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.bank_name?` (${a.bank_name})`:''}</option>
                ))}
              </select>
              <Input placeholder={language==='pt'?'% da regra':'% of rule'} value={t.share_percent} onChange={(e)=>setTargets(list=>list.map((x,i)=>i===idx?{...x,share_percent:e.target.value}:x))} />
              <Button variant="ghost" className="justify-self-start sm:justify-self-auto" onClick={()=>setTargets(list=>list.filter((_,i)=>i!==idx))}>{language==='pt'?'Remover':'Remove'}</Button>
            </div>
          ))}
          {targets.length>0 && (
            <p className={`text-xs ${targetsValid? 'text-muted-foreground':'text-red-600'}`}>
              {targetsValid
                ? (language==='pt'?'A soma deve ser 100%.':'Sum should be 100%.')
                : (language==='pt'?`Soma atual: ${sumTargets.toFixed(2)}% (ajuste para 100%).`:`Current sum: ${sumTargets.toFixed(2)}% (adjust to 100%).`)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">{language==='pt'?'Base de Lucro':'Profit base'}</h4>
          <p className="text-xs text-muted-foreground">{language==='pt'?'Escolha as contas cujo lucro (entradas - saídas) será considerado. Se nada for escolhido, todas as contas ativas serão usadas.':'Pick the accounts whose profit (income - expenses) is considered. If none selected, all active accounts are used.'}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.filter(a=>a.is_active).map(a => {
              const checked = sources.includes(a.id)
              return (
                <label key={a.id} className="flex items-center gap-2 text-sm border rounded px-2 py-2">
                  <input type="checkbox" className="accent-primary" checked={checked} onChange={(e)=>{
                    setSources(prev => e.target.checked ? [...prev, a.id] : prev.filter(id=>id!==a.id))
                  }} />
                  <span>{a.name}{a.bank_name?` (${a.bank_name})`:''}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">{language==='pt'?'Base de Débitos':'Debit base'}</h4>
          <p className="text-xs text-muted-foreground">{language==='pt'?'Escolha os cartões cujas compras devem ser subtraídas do lucro da base.':'Pick credit cards whose purchases should be subtracted from the profit base.'}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {creditCards.map(cc => {
              const checked = sourceCards.includes(cc.id)
              return (
                <label key={cc.id} className="flex items-center gap-2 text-sm border rounded px-2 py-2">
                  <input type="checkbox" className="accent-primary" checked={checked} onChange={(e)=>{
                    setSourceCards(prev => e.target.checked ? [...prev, cc.id] : prev.filter(id=>id!==cc.id))
                  }} />
                  <span>{cc.card_name}{cc.bank_name?` (${cc.bank_name})`:''}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {editing && (
            <Button variant="outline" onClick={()=>{ onCancelEdit?.() }}>
              {language==='pt'?'Cancelar':'Cancel'}
            </Button>
          )}
          <Button
            onClick={async()=>{
            const payload = {
              name: form.name.trim(),
              percentage: Number(form.percentage),
              payout_day: Number(form.payout_day),
              is_active: true,
              is_recurring: !!form.is_recurring,
              targets: targets.map(t=>({ account_id: t.account_id, share_percent: Number(t.share_percent) })),
              sources: [
                ...sources.map(id=>({ account_id: id })),
                ...sourceCards.map(id=>({ credit_card_id: id }))
              ]
            }
            if (!payload.name || !payload.percentage || !payload.payout_day) return alert(language==='pt'?'Preencha os campos obrigatórios':'Fill required fields')
            if (!targetsValid) return alert(language==='pt'?'As porcentagens de destino devem somar 100%.':'Target percentages must sum to 100%.')
            let res: Response
            if (editing?.id) {
              res = await fetch('/api/repasses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...payload }) })
            } else {
              res = await fetch('/api/repasses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            }
            if (!res.ok) {
              const j = await res.json().catch(()=>({}))
              return alert(j.error || 'Failed')
            }
            setForm({ name:'', percentage:'', payout_day:'', is_recurring: true })
            setTargets([])
            setSources([])
            setSourceCards([])
            onSaved()
            }}
            disabled={!form.name.trim() || !form.percentage || !form.payout_day || !targetsValid}
          >{editing ? (language==='pt'?'Atualizar':'Update') : (language==='pt'?'Salvar':'Save')}</Button>
        </div>
      </CardContent>
    </Card>
  )
}
