"use client"

import ProtectedRoute from '@/components/ProtectedRoute'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Eye, EyeOff, FileText, Plus, Pencil } from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCategories } from '@/hooks/useFinanceData'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import PDFUploader from '@/components/PDFUploader'

type Movement = {
  id: string
  amount: number
  currency: string
  description: string | null
  transaction_date: string
  type: 'income' | 'expense' | 'transfer'
  category_id?: string | null
}

type Account = {
  id: string
  name: string
  bank_name?: string | null
  balance: number
  currency: string
}

export default function AccountMovementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { language } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [hideBalance, setHideBalance] = useState(false)

  const [form, setForm] = useState({
    type: 'expense' as 'expense' | 'income',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    category_id: ''
  })
  const [saving, setSaving] = useState(false)
  const { categories } = useCategories()
  const [editing, setEditing] = useState<Movement | null>(null)
  const [editForm, setEditForm] = useState({
    type: 'expense' as 'expense' | 'income',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    category_id: ''
  })

  const t = useMemo(() => ({
    title: language === 'pt' ? 'Movimentações da Conta' : 'Account Movements',
    back: language === 'pt' ? 'Voltar às Contas' : 'Back to Accounts',
    importPdf: language === 'pt' ? 'Importar PDF' : 'Import PDF',
    addMovement: language === 'pt' ? 'Adicionar Movimentação' : 'Add Movement',
    balance: language === 'pt' ? 'Saldo' : 'Balance',
    none: language === 'pt' ? 'Nenhuma movimentação encontrada' : 'No movements found',
    date: language === 'pt' ? 'Data' : 'Date',
    desc: language === 'pt' ? 'Descrição' : 'Description',
    amount: language === 'pt' ? 'Valor' : 'Amount',
    type: language === 'pt' ? 'Tipo' : 'Type',
    expense: language === 'pt' ? 'Saída' : 'Expense',
    income: language === 'pt' ? 'Entrada' : 'Income',
  save: language === 'pt' ? 'Salvar' : 'Save',
  category: language === 'pt' ? 'Categoria' : 'Category',
  selectCategory: language === 'pt' ? 'Selecione uma categoria' : 'Select a category',
    loading: language === 'pt' ? 'Carregando...' : 'Loading...',
    error: language === 'pt' ? 'Erro ao carregar dados' : 'Failed to load data'
  }), [language])

  useEffect(() => {
    if (!user) return
    const saved = typeof window !== 'undefined' ? localStorage.getItem('hideBalances') : null
    if (saved) setHideBalance(saved === '1')
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const { data: acc, error: accErr } = await supabase
          .from('accounts')
          .select('id, name, bank_name, balance, currency')
    .eq('id', id)
          .eq('user_id', user.id)
          .single()
        if (accErr) throw accErr
        setAccount(acc as any)

        const { data: txs, error: txErr } = await supabase
          .from('transactions')
          .select('id, amount, currency, description, transaction_date, type, category_id')
          .eq('user_id', user.id)
    .eq('account_id', id)
          .order('transaction_date', { ascending: false })
        if (txErr) throw txErr
        setMovements((txs || []) as any)
      } catch (e: any) {
        setError(e?.message || t.error)
      } finally {
        setLoading(false)
      }
    })()
  }, [user, id, supabase, t.error])

  const formatCurrency = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(language === 'pt' ? 'pt-PT' : 'en-US', { style: 'currency', currency }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }

  const handleSave = async () => {
    if (!user || !account) return
    const amt = parseFloat(form.amount)
    if (!amt || isNaN(amt)) return
    try {
      setSaving(true)
      const signed = form.type === 'expense' ? -Math.abs(amt) : Math.abs(amt)
      const { error: insErr } = await supabase.from('transactions').insert([
        {
          user_id: user.id,
          account_id: account.id,
          amount: signed,
          currency: account.currency || 'EUR',
          description: form.description || null,
          transaction_date: form.date,
          type: form.type,
          category_id: form.category_id || null
        }
      ])
      if (insErr) throw insErr
      // Persist updated account balance
      const newBalance = (account.balance ?? 0) + signed
      const { data: accUpd, error: updErr } = await supabase
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', account.id)
        .eq('user_id', user.id)
        .select('id, name, bank_name, balance, currency')
        .single()
      if (updErr) throw updErr
      setAccount(accUpd as any)
      // Refresh list
      const { data: txs } = await supabase
        .from('transactions')
  .select('id, amount, currency, description, transaction_date, type, category_id')
        .eq('user_id', user.id)
        .eq('account_id', account.id)
        .order('transaction_date', { ascending: false })
      setMovements((txs || []) as any)
      setForm({ type: 'expense', amount: '', date: new Date().toISOString().split('T')[0], description: '', category_id: '' })
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const toggleHide = () => {
    const next = !hideBalance
    setHideBalance(next)
    if (typeof window !== 'undefined') localStorage.setItem('hideBalances', next ? '1' : '0')
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/accounts" className="p-2 rounded-md border hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="text-sm text-gray-500">{t.title}</div>
            <h1 className="text-2xl font-semibold">{account ? `${account.name}${account.bank_name ? ' — ' + account.bank_name : ''}` : t.loading}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleHide} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50">
            {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{t.balance}</span>
          </button>
          {account && (
            <div className="text-xl font-semibold">
              {hideBalance ? '••••••' : formatCurrency(account.balance, account.currency)}
            </div>
          )}
          {account && (
            <div className="ml-auto">
              <PDFUploader onSuccess={() => {
                // refresh movements after successful import
                (async () => {
                  const { data: txs } = await supabase
                    .from('transactions')
                    .select('id, amount, currency, description, transaction_date, type, category_id')
                    .eq('user_id', user!.id)
                    .eq('account_id', account.id)
                    .order('transaction_date', { ascending: false })
                  setMovements((txs || []) as any)
                  // Optionally refresh account balance here
                  const { data: acc } = await supabase
                    .from('accounts')
                    .select('id, name, bank_name, balance, currency')
                    .eq('id', account.id)
                    .eq('user_id', user!.id)
                    .single()
                  if (acc) setAccount(acc as any)
                })()
              }} forcedTarget={`acc:${account.id}`} />
            </div>
          )}
        </div>

        {/* Quick add movement */}
        <div className="bg-white rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <select
              className="px-3 py-2 rounded-md border"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any, category_id: '' }))}
            >
              <option value="expense">{t.expense}</option>
              <option value="income">{t.income}</option>
            </select>
            <input
              type="number"
              step="0.01"
              className="px-3 py-2 rounded-md border"
              placeholder={t.amount}
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            />
            <input
              type="date"
              className="px-3 py-2 rounded-md border"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
            <select
              className="px-3 py-2 rounded-md border"
              value={form.category_id}
              onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
            >
              <option value="">{t.selectCategory}</option>
              {categories
                .filter((c: any) => c.type === form.type)
                .map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            <input
              className="px-3 py-2 rounded-md border sm:col-span-1"
              placeholder={t.desc}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.amount}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {t.addMovement}
            </button>
          </div>
        </div>

        {/* Movements list */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary" />
          </div>
        ) : error ? (
          <div className="p-3 rounded-md border bg-red-50 text-red-700">{error}</div>
        ) : movements.length === 0 ? (
          <div className="p-6 rounded-md border bg-white text-center text-gray-600">{t.none}</div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 px-3">{t.date}</th>
                  <th className="py-2 px-3">{t.desc}</th>
                  <th className="py-2 px-3 text-right">{t.amount}</th>
                  <th className="py-2 px-3">{t.category}</th>
                  <th className="py-2 px-3">{t.type}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-2 px-3">{new Date(m.transaction_date).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US')}</td>
                    <td className="py-2 px-3">{m.description || '-'}
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${m.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(m.amount), account?.currency || m.currency)}
                    </td>
                    <td className="py-2 px-3">
                      {m.category_id ? (categories.find((c: any) => c.id === m.category_id)?.name || '-') : '-'}
                    </td>
                    <td className="py-2 px-3">{m.type === 'income' ? t.income : m.type === 'expense' ? t.expense : 'Transfer'}</td>
                    <td className="py-2 px-3 text-right">
                      {m.type !== 'transfer' && (
                        <button
                          onClick={() => {
                            setEditing(m)
                            setEditForm({
                              type: (m.type as 'expense' | 'income') || 'expense',
                              amount: String(Math.abs(m.amount)),
                              date: m.transaction_date.slice(0,10),
                              description: m.description || '',
                              category_id: m.category_id || ''
                            })
                          }}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit movement dialog */}
        <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'pt' ? 'Editar movimentação' : 'Edit movement'}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t.type}</Label>
                    <select
                      className="px-3 py-2 rounded-md border w-full"
                      value={editForm.type}
                      onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as any, category_id: '' }))}
                    >
                      <option value="expense">{t.expense}</option>
                      <option value="income">{t.income}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.amount}</Label>
                    <input
                      type="number"
                      step="0.01"
                      className="px-3 py-2 rounded-md border w-full"
                      value={editForm.amount}
                      onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t.date}</Label>
                    <input
                      type="date"
                      className="px-3 py-2 rounded-md border w-full"
                      value={editForm.date}
                      onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.category}</Label>
                    <select
                      className="px-3 py-2 rounded-md border w-full"
                      value={editForm.category_id}
                      onChange={(e) => setEditForm((p) => ({ ...p, category_id: e.target.value }))}
                    >
                      <option value="">{t.selectCategory}</option>
                      {categories
                        .filter((c: any) => c.type === editForm.type)
                        .map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t.desc}</Label>
                  <input
                    className="px-3 py-2 rounded-md border w-full"
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>{language === 'pt' ? 'Cancelar' : 'Cancel'}</Button>
                  <Button onClick={async () => {
                    if (!user || !account || !editing) return
                    const newAmtAbs = parseFloat(editForm.amount || '0') || 0
                    const newSigned = editForm.type === 'expense' ? -Math.abs(newAmtAbs) : Math.abs(newAmtAbs)
                    const delta = newSigned - editing.amount
                    try {
                      // Update transaction
                      const { error: updTxErr } = await supabase
                        .from('transactions')
                        .update({
                          type: editForm.type,
                          description: editForm.description || null,
                          transaction_date: editForm.date,
                          amount: newSigned,
                          category_id: editForm.category_id || null
                        })
                        .eq('id', editing.id)
                        .eq('user_id', user.id)
                      if (updTxErr) throw updTxErr

                      // Update account balance by delta
                      const { data: accUpd, error: updAccErr } = await supabase
                        .from('accounts')
                        .update({ balance: (account.balance ?? 0) + delta })
                        .eq('id', account.id)
                        .eq('user_id', user.id)
                        .select('id, name, bank_name, balance, currency')
                        .single()
                      if (updAccErr) throw updAccErr
                      setAccount(accUpd as any)

                      // Refresh list
                      const { data: txs } = await supabase
                        .from('transactions')
                        .select('id, amount, currency, description, transaction_date, type, category_id')
                        .eq('user_id', user.id)
                        .eq('account_id', account.id)
                        .order('transaction_date', { ascending: false })
                      setMovements((txs || []) as any)
                      setEditing(null)
                    } catch (e) {
                      console.error(e)
                    }
                  }}>{language === 'pt' ? 'Salvar' : 'Save'}</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
