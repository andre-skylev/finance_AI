"use client"

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';

// Dados simulados - em produção viriam da API
const data = [
  { month: 'Jan', income: 3200, expenses: 2450, net: 750 },
  { month: 'Fev', income: 3200, expenses: 2890, net: 310 },
  { month: 'Mar', income: 3400, expenses: 2650, net: 750 },
  { month: 'Abr', income: 3200, expenses: 3100, net: 100 },
  { month: 'Mai', income: 3500, expenses: 2750, net: 750 },
  { month: 'Jun', income: 3200, expenses: 2400, net: 800 },
];

export function CashFlow() {
  const { t } = useLanguage();

  return (
    <Card className="col-span-12 lg:col-span-6">
      <CardHeader>
        <CardTitle>{t('dashboard.cashFlow')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--foreground))" 
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--foreground))" 
              fontSize={12}
              tickFormatter={(value) => `€${value}`}
            />
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderColor: "hsl(var(--border))",
                borderRadius: "8px"
              }}
              formatter={(value: number, name: string) => {
                const labels: { [key: string]: string } = {
                  income: t('dashboard.income'),
                  expenses: t('dashboard.expenses'), 
                  net: t('dashboard.netBalance')
                };
                return [`€${value.toLocaleString()}`, labels[name] || name];
              }}
            />
            <Bar dataKey="income" fill="url(#incomeGradient)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="url(#expenseGradient)" radius={[4, 4, 0, 0]} />
            <Line 
              type="monotone" 
              dataKey="net" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
