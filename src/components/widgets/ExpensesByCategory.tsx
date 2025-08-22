"use client"

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
 
export function ExpensesByCategory() {
  const { t } = useLanguage();
  const { displayCurrency } = useCurrency();
  const [data, setData] = useState<Array<{name:string; value:number; color:string}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard?type=expenses-by-category&currency=${displayCurrency}`)
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        if (!cancelled) setData(j.data || [])
      } catch (_) {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [displayCurrency])

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="font-medium text-sm">{data.payload.name}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {displayCurrency === 'EUR' ? '€' : 'R$'}{data.value.toLocaleString()}
        </div>
      </div>
    );
  }
  return null;
};

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="col-span-12 lg:col-span-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full"></div>
          {t('dashboard.expensesByCategory')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {(!loading && data.length === 0) ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noData') || 'No data yet'}</p>
        ) : (
        <>
  <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            <PieChart width={240} height={240}>
              <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
          </div>
          
          <div className="flex-1 space-y-3 min-w-0">
            {data.map((item, index) => {
              const percentage = ((item.value / total) * 100);
              return (
                <div key={index} className="group hover:bg-muted/50 rounded-md p-2 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{displayCurrency === 'EUR' ? '€' : 'R$'}{item.value.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-1 ml-7">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{percentage.toFixed(1)}% do total</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1">
                      <div 
                        className="h-1 rounded-full transition-all duration-300"
                        style={{ 
                          backgroundColor: item.color,
                          width: `${percentage}%`,
                          opacity: 0.8
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total de Gastos</span>
            <span className="text-lg font-bold">{displayCurrency === 'EUR' ? '€' : 'R$'}{total.toLocaleString()}</span>
          </div>
        </div>
        </>
        )}
      </CardContent>
    </Card>
  );
}
