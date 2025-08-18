"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from '../../contexts/LanguageContext';

const accounts = [
  { name: "Millennium BCP", balance: "€5,250.00", currency: "EUR", logo: "/logos/millennium.svg" },
  { name: "Caixa Geral", balance: "€1,234.56", currency: "EUR", logo: "/logos/cgd.svg" },
  { name: "Itaú", balance: "R$12,345.67", currency: "BRL", logo: "/logos/itau.svg" },
  { name: "Nubank", balance: "R$8,765.43", currency: "BRL", logo: "/logos/nubank.svg" },
];

export function AccountBalances() {
  const { t } = useLanguage();

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
        <div className="space-y-4">
          {accounts.map((account) => (
            <div key={account.name} className="flex items-center">
              <div className="h-10 w-10 mr-4 bg-muted rounded-full flex items-center justify-center">
                {/* In a real app, you'd use an <Image> component here */}
                {/* For now, a placeholder */}
                <span className="text-xs font-bold">{account.name.substring(0, 3)}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">{account.name}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{account.balance}</p>
                <p className="text-xs text-muted-foreground">{account.currency}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
