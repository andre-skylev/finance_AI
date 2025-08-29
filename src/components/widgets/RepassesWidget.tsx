"use client"

import React, { useEffect, useState } from 'react'
import { useCurrency } from '@/contexts/CurrencyContext'

type Forecast = {
	rule_id: string
	name: string
	amount: number
	currency: 'EUR'|'BRL'|'USD'
	horizon: string // ISO date yyyy-mm-dd
}

export default function RepassesWidget() {
	const { displayCurrency } = useCurrency()
	const [items, setItems] = useState<Forecast[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(false)
	const [err, setErr] = useState<string| null>(null)

	useEffect(() => {
		let cancelled = false
		const load = async () => {
			setLoading(true)
			setErr(null)
			try {
				const qs = new URLSearchParams({ action: 'forecast', currency: displayCurrency })
				const res = await fetch(`/api/repasses?${qs.toString()}`, { cache: 'no-store' })
				if (!res.ok) throw new Error(`${res.status}`)
				const j = await res.json()
				if (!cancelled) {
					setItems(Array.isArray(j?.forecasts) ? j.forecasts : [])
					setTotal(Number(j?.total || 0))
				}
			} catch (e: any) {
				if (!cancelled) setErr('Falha ao carregar')
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		load()
		return () => { cancelled = true }
	}, [displayCurrency])

	const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency, minimumFractionDigits: 2 }).format(n)
	const fmtDate = (iso: string) => {
		try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-PT') } catch { return iso }
	}

	if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>
	if (err) return <div className="text-sm text-red-600">{err}</div>

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="text-sm font-medium">Próximos repasses</div>
				<div className="text-sm font-semibold">{fmt(total)}</div>
			</div>
			{items.length === 0 ? (
				<div className="text-sm text-muted-foreground">Sem repasses previstos</div>
			) : (
				<ul className="divide-y">
					{items.map((f) => (
						<li key={f.rule_id} className="py-2 flex items-center justify-between gap-3">
							<div className="min-w-0">
								<div className="text-sm font-medium truncate">{f.name}</div>
								<div className="text-xs text-muted-foreground">Repasse em {fmtDate(f.horizon)}</div>
							</div>
							<div className="text-sm font-semibold whitespace-nowrap">{fmt(f.amount)}</div>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

export { RepassesWidget }

