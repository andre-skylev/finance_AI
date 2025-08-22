"use client"

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { BarChart3 } from 'lucide-react';

export function BudgetVsActual() {
  const { t } = useLanguage();
  const { displayCurrency } = useCurrency();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard?type=budget-vs-actual');
        if (!res.ok) {
          // If unauthorized or not found, just return empty data without throwing error
          if (res.status === 401 || res.status === 404) {
            if (!cancelled) setData([]);
            return;
          }
          throw new Error('Failed to load budget data');
        }
        const result = await res.json();
        if (!cancelled) setData(result.data || []);
      } catch (error) {
        console.error('Error loading budget data:', error);
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className="col-span-12 lg:col-span-6">
        <CardHeader>
          <CardTitle>{t('dashboard.budgetVsActual')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-[300px] bg-gray-100 rounded-lg"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-100 rounded w-1/4"></div>
              <div className="h-3 bg-gray-100 rounded"></div>
              <div className="h-3 bg-gray-100 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="col-span-12 lg:col-span-6">
        <CardHeader>
          <CardTitle>{t('dashboard.budgetVsActual')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('dashboard.noBudgetData') || 'Sem dados de orçamento'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('dashboard.noBudgetDataDesc') || 'Configure orçamentos para ver comparações'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
              tickFormatter={(value) => `${displayCurrency === 'EUR' ? '€' : 'R$'}${value}`}
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
                const s = displayCurrency === 'EUR' ? '€' : 'R$'
                return [`${s}${value.toLocaleString()}`, labels[name] || name];
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
        {data.length > 0 && (
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
                    ({displayCurrency === 'EUR' ? '€' : 'R$'}{Math.abs(item.actual - item.budgeted)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}