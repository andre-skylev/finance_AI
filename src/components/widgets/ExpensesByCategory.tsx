"use client"

import { useEffect, useMemo, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';
import { ChevronLeft } from 'lucide-react'
 
export function ExpensesByCategory() {
  const { t } = useLanguage();
  const { displayCurrency } = useCurrency();
  type Child = { id: string; name: string; value: number }
  type Parent = { id: string | null; name: string; color: string; value: number; children: Child[] }
  const [parents, setParents] = useState<Parent[]>([])
  const [selected, setSelected] = useState<Parent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard?type=expenses-by-category&currency=${displayCurrency}`)
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        if (!cancelled) {
          setParents(Array.isArray(j.data) ? j.data : [])
          setSelected(null)
        }
      } catch (_) {
        if (!cancelled) {
          setParents([])
          setSelected(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [displayCurrency])

  // Simple color palette for children
  const CHILD_COLORS = useMemo(() => ['#60a5fa','#34d399','#f59e0b','#f472b6','#22c55e','#a78bfa','#fb7185','#38bdf8','#84cc16','#f97316'], [])
  const childColors = useCallback((count: number) => Array.from({length: count}, (_, i)=> CHILD_COLORS[i % CHILD_COLORS.length]), [CHILD_COLORS])

  const currentData = useMemo(() => {
    if (!selected) {
      return parents.map(p => ({ name: p.name, value: p.value, color: p.color, id: p.id }))
    }
    const colors = childColors(selected.children.length)
    return selected.children.map((c, idx) => ({ name: c.name, value: c.value, color: colors[idx], id: c.id }))
  }, [parents, selected, childColors])

  const total = currentData.reduce((sum, item) => sum + item.value, 0);

  const onSliceClick = (index: number) => {
    if (!selected) {
      const p = parents[index]
      if (p) setSelected(p)
    }
  }

  const backToParents = () => setSelected(null)

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
            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency }).format(Number(data.value || 0))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-12 lg:col-span-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            {t('dashboard.expensesByCategory')}
          </CardTitle>
          {selected && (
            <button onClick={backToParents} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back') || 'Voltar'}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
  {(!loading && parents.length === 0) ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noData') || 'No data yet'}</p>
        ) : (
        <>
  <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            <PieChart width={240} height={240}>
              <Pie
                  data={currentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  onClick={(_, index) => onSliceClick(index as number)}
                >
                  {currentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
          </div>
          
          <div className="flex-1 space-y-3 min-w-0">
            {currentData.map((item, index) => {
              const percentage = ((item.value / total) * 100);
              return (
                <div key={index} className="group hover:bg-muted/50 rounded-md p-2 transition-colors cursor-pointer" onClick={() => onSliceClick(index)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency }).format(item.value)}</span>
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
            <span className="text-lg font-bold">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: displayCurrency }).format(total)}</span>
          </div>
        </div>
        </>
        )}
      </CardContent>
    </Card>
  );
}
