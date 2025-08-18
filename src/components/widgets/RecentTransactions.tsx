"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLanguage } from '../../contexts/LanguageContext';

const transactions = [
  { id: "1", description: "Pingo Doce", amount: "-€25.50", category: "Groceries" },
  { id: "2", description: "Salary", amount: "+€3,200.00", category: "Income" },
  { id: "3", description: "Restaurante O Pescador", amount: "-€45.00", category: "Restaurants" },
  { id: "4", description: "Aluguel (Brasil)", amount: "+R$1,500.00", category: "Rental Income" },
  { id: "5", description: "CP - Comboio", amount: "-€12.50", category: "Transport" },
];

export function RecentTransactions() {
  const { t } = useLanguage();

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
        <div className="divide-y divide-border">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{transaction.description}</p>
                <p className="text-sm text-muted-foreground">{transaction.category}</p>
              </div>
              <p className={`font-semibold ${transaction.amount.startsWith('+') ? 'text-green-600' : ''}`}>
                {transaction.amount}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
