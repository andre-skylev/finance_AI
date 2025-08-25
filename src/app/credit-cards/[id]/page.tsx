"use client"

import ProtectedRoute from '@/components/ProtectedRoute'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Eye, EyeOff, FileText, Plus, CreditCard as CreditCardIcon, Pencil, Trash } from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useMemo, useState } from 'react'
import { useCategories } from '@/hooks/useFinanceData'
import PDFUploader from '@/components/PDFUploader'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type CardTx = {
	id: string
	transaction_date: string
	merchant_name: string | null
	description: string | null
	amount: number
	currency: string
	transaction_type: 'purchase' | 'payment'
	installments?: number | null
	installment_number?: number | null
	category_id?: string | null
}

type CreditCard = {
	id: string
	card_name: string
	bank_name?: string | null
	currency: string
	credit_limit?: number | null
	current_balance: number
}

export default function CreditCardMovementsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params)
	const { language } = useLanguage()
	const { user } = useAuth()
	const supabase = createClient()

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [card, setCard] = useState<CreditCard | null>(null)
	const [movements, setMovements] = useState<CardTx[]>([])
	const [hideBalance, setHideBalance] = useState(false)

	const [form, setForm] = useState({
		type: 'purchase' as 'purchase' | 'payment',
		amount: '',
		date: new Date().toISOString().split('T')[0],
		description: '',
		category_id: ''
	})
	const [saving, setSaving] = useState(false)
	const [editing, setEditing] = useState<CardTx | null>(null)
	const [editForm, setEditForm] = useState({
		transaction_type: 'purchase' as 'purchase' | 'payment',
		amount: '',
		date: new Date().toISOString().split('T')[0],
		description: '',
		merchant_name: '',
		category_id: ''
	})

	const t = useMemo(() => ({
		title: language === 'pt' ? 'Movimentações do Cartão' : 'Card Movements',
		back: language === 'pt' ? 'Voltar aos Cartões' : 'Back to Cards',
		importPdf: language === 'pt' ? 'Importar PDF' : 'Import PDF',
		addMovement: language === 'pt' ? 'Adicionar Movimentação' : 'Add Movement',
		balance: language === 'pt' ? 'Saldo Atual' : 'Current Balance',
		limit: language === 'pt' ? 'Limite' : 'Limit',
		available: language === 'pt' ? 'Disponível' : 'Available',
		none: language === 'pt' ? 'Nenhuma movimentação encontrada' : 'No movements found',
		date: language === 'pt' ? 'Data' : 'Date',
		desc: language === 'pt' ? 'Descrição' : 'Description',
		merchant: language === 'pt' ? 'Estabelecimento' : 'Merchant',
		amount: language === 'pt' ? 'Valor' : 'Amount',
		type: language === 'pt' ? 'Tipo' : 'Type',
		purchase: language === 'pt' ? 'Compra' : 'Purchase',
		payment: language === 'pt' ? 'Pagamento' : 'Payment',
		save: language === 'pt' ? 'Salvar' : 'Save',
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
				const { data: c, error: cErr } = await supabase
					.from('credit_cards')
					.select('id, card_name, bank_name, currency, credit_limit, current_balance')
					.eq('id', id)
					.eq('user_id', user.id)
					.single()
				if (cErr) throw cErr
				setCard(c as any)

						const { data: txs, error: txErr } = await supabase
					.from('credit_card_transactions')
							.select('id, transaction_date, merchant_name, description, amount, currency, transaction_type, installments, installment_number, category_id')
					.eq('user_id', user.id)
					.eq('credit_card_id', id)
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

	const { categories } = useCategories()

	const handleSave = async () => {
		if (!user || !card) return
		const amt = parseFloat(form.amount)
		if (!amt || isNaN(amt)) return
		try {
			setSaving(true)
			const isPurchase = form.type === 'purchase'
			// merchant_name is NOT NULL in DB; ensure a fallback label
			const merchant = (form.description || '').trim() || (language === 'pt' ? 'Lançamento manual' : 'Manual entry')
			// Use server API to insert and update balance atomically
			const res = await fetch('/api/credit-card-transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					credit_card_id: card.id,
					transaction_date: form.date,
					description: form.description || null,
					merchant_name: merchant,
					amount: Math.abs(amt),
					currency: card.currency || 'EUR',
					transaction_type: isPurchase ? 'purchase' : 'payment',
					installments: 1,
					installment_number: 1,
					category_id: isPurchase && form.category_id ? form.category_id : null,
				})
			})
			if (!res.ok) {
				const j = await res.json().catch(() => ({}))
				throw new Error(j.error || `HTTP ${res.status}`)
			}

			// Refresh list
						const { data: txs } = await supabase
				.from('credit_card_transactions')
							.select('id, transaction_date, merchant_name, description, amount, currency, transaction_type, installments, installment_number, category_id')
				.eq('user_id', user.id)
				.eq('credit_card_id', card.id)
				.order('transaction_date', { ascending: false })
			setMovements((txs || []) as any)
			// Refresh card from DB to get updated balance
			const { data: updCard } = await supabase
				.from('credit_cards')
				.select('id, card_name, bank_name, currency, credit_limit, current_balance')
				.eq('id', card.id)
				.eq('user_id', user.id)
				.single()
			if (updCard) setCard(updCard as any)
			setForm({ type: 'purchase', amount: '', date: new Date().toISOString().split('T')[0], description: '', category_id: '' })
		} catch (e) {
			console.error('Failed to add credit card movement:', e)
		} finally {
			setSaving(false)
		}
	}

	const toggleHide = () => {
		const next = !hideBalance
		setHideBalance(next)
		if (typeof window !== 'undefined') localStorage.setItem('hideBalances', next ? '1' : '0')
	}

	const availableLimit = typeof card?.credit_limit === 'number' ? (card.credit_limit - (card?.current_balance || 0)) : undefined

	return (
		<ProtectedRoute>
			<div className="space-y-6">
				<div className="flex items-center gap-3">
					<Link href="/credit-cards" className="p-2 rounded-md border hover:bg-gray-50">
						<ArrowLeft className="h-4 w-4" />
					</Link>
					<div>
						<div className="text-sm text-gray-500 flex items-center gap-2"><CreditCardIcon className="h-4 w-4" /> {t.title}</div>
						<h1 className="text-2xl font-semibold">{card ? `${card.card_name}${card.bank_name ? ' — ' + card.bank_name : ''}` : t.loading}</h1>
					</div>
				</div>

				<div className="flex items-center gap-3 flex-wrap">
					<button onClick={toggleHide} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50">
						{hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
						<span className="hidden sm:inline">{t.balance}</span>
					</button>
					<div className="flex items-center gap-4 flex-wrap">
						{card && (
							<div className="text-xl font-semibold">
								{hideBalance ? '••••••' : formatCurrency(card.current_balance, card.currency)}
							</div>
						)}
						{typeof card?.credit_limit === 'number' && (
							<div className="text-sm text-gray-600">
								{t.limit}: {hideBalance ? '•••••' : formatCurrency(card.credit_limit!, card.currency)}
								{typeof availableLimit === 'number' && (
									<span className="ml-3">• {t.available}: {hideBalance ? '•••••' : formatCurrency(availableLimit, card!.currency)}</span>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Import Transactions */}
				{card && (
					<div className="bg-white rounded-lg border p-4">
						<h3 className="text-lg font-medium mb-2">{t.importPdf}</h3>
						<p className="text-sm text-gray-600 mb-4">Upload a PDF statement or take a photo to automatically extract transactions</p>
						<PDFUploader onSuccess={async () => {
							const { data: txs } = await supabase
								.from('credit_card_transactions')
								.select('id, transaction_date, merchant_name, description, amount, currency, transaction_type, installments, installment_number, category_id')
								.eq('user_id', user!.id)
								.eq('credit_card_id', card.id)
								.order('transaction_date', { ascending: false })
							setMovements((txs || []) as any)
							const { data: c } = await supabase
											.from('credit_cards')
											.select('id, card_name, bank_name, currency, credit_limit, current_balance')
											.eq('id', card.id)
											.eq('user_id', user!.id)
											.single()
										if (c) setCard(c as any)
									}} forcedTarget={`cc:${card.id}`} />
					</div>
				)}

				{/* Quick add movement */}
				<div className="bg-white rounded-lg border p-4">
					<div className="grid gap-3 sm:grid-cols-6">
						<select
							className="px-3 py-2 rounded-md border"
							value={form.type}
							onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))}
						>
							<option value="purchase">{t.purchase}</option>
							<option value="payment">{t.payment}</option>
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
						<input
							className="px-3 py-2 rounded-md border sm:col-span-2"
							placeholder={t.desc}
							value={form.description}
							onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
						/>
						{form.type === 'purchase' ? (
							<select
								className="px-3 py-2 rounded-md border"
								value={form.category_id}
								onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
							>
								<option value="">{language === 'pt' ? 'Categoria' : 'Category'}</option>
								{categories.filter((c:any)=>c.type==='expense').map((c:any)=>(
									<option key={c.id} value={c.id}>{c.name}</option>
								))}
							</select>
						) : <div />}
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
									<th className="py-2 px-3">{t.merchant}</th>
									<th className="py-2 px-3">{t.desc}</th>
									<th className="py-2 px-3 text-right">{t.amount}</th>
									<th className="py-2 px-3">{t.type}</th>
									<th className="py-2 px-3"></th>
								</tr>
							</thead>
							<tbody>
								{movements.map((m) => (
									<tr key={m.id} className="border-b border-gray-100">
										<td className="py-2 px-3">{new Date(m.transaction_date).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US')}</td>
										<td className="py-2 px-3">{m.merchant_name || '-'}</td>
										<td className="py-2 px-3">{m.description || '-'}</td>
										<td className={`py-2 px-3 text-right font-medium ${m.transaction_type === 'purchase' ? 'text-red-600' : 'text-green-600'}`}>
											{formatCurrency(Math.abs(m.amount), card?.currency || m.currency)}
										</td>
										<td className="py-2 px-3">{m.transaction_type === 'purchase' ? t.purchase : t.payment}</td>
										<td className="py-2 px-3 text-right">
											<div className="flex justify-end gap-2">
												<button
												onClick={() => {
													setEditing(m)
													setEditForm({
														transaction_type: m.transaction_type,
														amount: String(Math.abs(m.amount)),
														date: m.transaction_date.slice(0,10),
														description: m.description || '',
														merchant_name: m.merchant_name || '',
														category_id: m.category_id || ''
													})
												}}
												className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-gray-50"
											>
												<Pencil className="h-4 w-4" />
											</button>
											<button
												className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-red-50 text-red-600"
												onClick={async()=>{
													if(!card) return
													try{
														const res=await fetch('/api/credit-card-transactions',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:m.id})})
														if(!res.ok){const j=await res.json().catch(()=>({})); throw new Error(j.error||`HTTP ${res.status}`)}
														const { data: txs } = await supabase
															.from('credit_card_transactions')
															.select('id, transaction_date, merchant_name, description, amount, currency, transaction_type, installments, installment_number, category_id')
															.eq('user_id', user!.id)
															.eq('credit_card_id', card.id)
															.order('transaction_date', { ascending: false })
														setMovements((txs||[]) as any)
														const { data: updCard } = await supabase
															.from('credit_cards')
															.select('id, card_name, bank_name, currency, credit_limit, current_balance')
															.eq('id', card.id)
															.eq('user_id', user!.id)
															.single()
														if(updCard) setCard(updCard as any)
													} catch(e){ console.error(e) }
												}}
											>
												<Trash className="h-4 w-4" />
											</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			<Dialog open={!!editing} onOpenChange={(open)=>{ if (!open) setEditing(null) }}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{language === 'pt' ? 'Editar movimentação' : 'Edit movement'}</DialogTitle>
				</DialogHeader>
				{editing && (
					<div className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label>{t.type}</Label>
								<select className="px-3 py-2 rounded-md border w-full" value={editForm.transaction_type} onChange={(e)=>setEditForm((p)=>({ ...p, transaction_type: e.target.value as any }))}>
									<option value="purchase">{t.purchase}</option>
									<option value="payment">{t.payment}</option>
								</select>
							</div>
							<div className="space-y-2">
								<Label>{t.amount}</Label>
								<input type="number" step="0.01" className="px-3 py-2 rounded-md border w-full" value={editForm.amount} onChange={(e)=>setEditForm((p)=>({ ...p, amount: e.target.value }))} />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label>{t.date}</Label>
								<input type="date" className="px-3 py-2 rounded-md border w-full" value={editForm.date} onChange={(e)=>setEditForm((p)=>({ ...p, date: e.target.value }))} />
							</div>
							<div className="space-y-2">
								<Label>{language==='pt'?'Estabelecimento':'Merchant'}</Label>
								<input className="px-3 py-2 rounded-md border w-full" value={editForm.merchant_name} onChange={(e)=>setEditForm((p)=>({ ...p, merchant_name: e.target.value }))} />
							</div>
						</div>
						<div className="space-y-2">
							<Label>{t.desc}</Label>
							<input className="px-3 py-2 rounded-md border w-full" value={editForm.description} onChange={(e)=>setEditForm((p)=>({ ...p, description: e.target.value }))} />
						</div>
						<div className="space-y-2">
							<Label>{language==='pt'?'Categoria':'Category'}</Label>
							<select className="px-3 py-2 rounded-md border w-full" value={editForm.category_id} onChange={(e)=>setEditForm((p)=>({ ...p, category_id: e.target.value }))}>
								<option value="">{language==='pt'?'Sem categoria':'No category'}</option>
								{categories.filter((c:any)=>c.type==='expense').map((c:any)=>(
									<option key={c.id} value={c.id}>{c.name}</option>
								))}
							</select>
						</div>
						<div className="flex justify-end gap-2 pt-2">
							<Button variant="outline" onClick={()=>setEditing(null)}>{language==='pt'?'Cancelar':'Cancel'}</Button>
							<Button onClick={async()=>{
								if(!editing||!card) return
								const body={
									id: editing.id,
									transaction_date: editForm.date,
									merchant_name: editForm.merchant_name,
									description: editForm.description,
									amount: Math.abs(parseFloat(editForm.amount||'0')),
									currency: card.currency||'EUR',
									transaction_type: editForm.transaction_type,
									category_id: editForm.category_id||null
								}
								try{
									const res=await fetch('/api/credit-card-transactions',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
									if(!res.ok){const j=await res.json().catch(()=>({})); throw new Error(j.error||`HTTP ${res.status}`)}
									// Refresh list and card
				    const { data: txs } = await supabase
										.from('credit_card_transactions')
					    .select('id, transaction_date, merchant_name, description, amount, currency, transaction_type, installments, installment_number, category_id')
										.eq('user_id', user!.id)
										.eq('credit_card_id', card.id)
										.order('transaction_date', { ascending: false })
									setMovements((txs||[]) as any)
									const { data: updCard } = await supabase
										.from('credit_cards')
										.select('id, card_name, bank_name, currency, credit_limit, current_balance')
										.eq('id', card.id)
										.eq('user_id', user!.id)
										.single()
									if(updCard) setCard(updCard as any)
									setEditing(null)
								} catch(e){ console.error(e) }
							}}>{language==='pt'?'Salvar':'Save'}</Button>
						</div>
					</div>
				)}
			</DialogContent>
			</Dialog>
		</ProtectedRoute>
	)
}

