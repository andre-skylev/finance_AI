"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';

// Dados simulados - em produção viriam da API
const data = [
  { category: 'Alimentação', budgeted: 500, actual: 450, variance: -10 },
  { category: 'Transporte', budgeted: 300, actual: 320, variance: 6.7 },
  { category: 'Moradia', budgeted: 800, actual: 800, variance: 0 },
  { category: 'Lazer', budgeted: 200, actual: 280, variance: 40 },
  { category: 'Saúde', budgeted: 150, actual: 180, variance: 20 },
  { category: 'Compras', budgeted: 250, actual: 220, variance: -12 },
];

export function BudgetVsActual() {
  const { t } = useLanguage();

  return (
    <Card className="col-span-12 lg:col-span-6">
      <CardHeader>
        <CardTitle>{t('dashboard.budgetVsActual')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="category" 
              stroke="hsl(var(--foreground))" 
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="hsl(var(--foreground))" 
              fontSize={12}
              tickFormatter={(value) => `€${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderColor: "hsl(var(--border))",
                borderRadius: "8px"
              }}
              formatter={(value: number, name: string) => {
                const labels: { [key: string]: string } = {
                  budgeted: t('dashboard.budgeted'),
                  actual: t('dashboard.actual')
                };
                return [`€${value.toLocaleString()}`, labels[name] || name];
              }}
            />
            <Bar 
              dataKey="budgeted" 
              fill="#8b5cf6" 
              radius={[4, 4, 0, 0]}
              name="budgeted"
            />
            <Bar 
              dataKey="actual" 
              fill="#06b6d4" 
              radius={[4, 4, 0, 0]}
              name="actual"
            />
          </BarChart>
        </ResponsiveContainer>
        
        {/* Tabela de variações */}
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium">{t('dashboard.variances')}</h4>
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span>{item.category}</span>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${
                  item.variance > 0 
                    ? 'text-red-600' 
                    : item.variance < 0 
                      ? 'text-green-600' 
                      : 'text-gray-600'
                }`}>
                  {item.variance > 0 ? '+' : ''}{item.variance.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  (€{Math.abs(item.actual - item.budgeted)})
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
