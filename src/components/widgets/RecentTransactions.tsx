"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLanguage } from '../../contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';

export function RecentTransactions() {
  const { t } = useLanguage();
  const { formatAmountWithConversion } = useCurrency();
  const [transactions, setTransactions] = useState<Array<{id:string; description:string; amount:number; currency:string; type:'income'|'expense'}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard?type=recent-transactions&limit=5')
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        if (!cancelled) setTransactions(j.transactions || [])
      } catch (_) {
        if (!cancelled) setTransactions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="col-span-12">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{t('dashboard.recentTransactions')}</CardTitle>
            <CardDescription>{t('dashboard.last5Transactions')}</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/transactions">{t('dashboard.viewAll')}</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {(!loading && transactions.length === 0) ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noTransactions')}</p>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{transaction.description}</p>
                </div>
                <p className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : ''}`}>
                  {formatAmountWithConversion(Math.abs(transaction.amount), (transaction.currency as 'EUR'|'BRL'|'USD') || 'EUR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
