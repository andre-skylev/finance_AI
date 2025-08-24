"use client"

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from '../../contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';

export function AccountBalances() {
  const { t } = useLanguage();
  const { displayCurrency, formatWithConversion } = useCurrency();
  const [accounts, setAccounts] = useState<Array<{name:string; balance:number; currency:string;}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard?type=account-balances`) // Buscar dados originais sem conversão
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        if (!cancelled) setAccounts(j.accounts || [])
      } catch (_) {
        if (!cancelled) setAccounts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [displayCurrency])

  return (
    <Card className="col-span-12 lg:col-span-5">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{t('dashboard.accountBalances')}</CardTitle>
            <CardDescription>{t('dashboard.accountsDescription')}</CardDescription>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!loading && accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noAccounts') || 'No accounts found'}</p>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div key={account.name} className="flex items-center">
                <div className="h-10 w-10 mr-4 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold">{account.name.substring(0, 3)}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{account.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatWithConversion(account.balance || 0, (account.currency as 'EUR'|'BRL'|'USD') || 'EUR')}
                  </p>
                  <p className="text-xs text-muted-foreground">{account.currency}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
