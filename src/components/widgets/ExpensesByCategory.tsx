"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';

// Dados simulados - em produção viriam da API
const data = [
  { name: 'Alimentação', value: 450, color: '#f59e0b' }, // Laranja - comida
  { name: 'Transporte', value: 320, color: '#3b82f6' }, // Azul - movimento
  { name: 'Moradia', value: 800, color: '#8b5cf6' }, // Roxo - casa/estabilidade
  { name: 'Lazer', value: 280, color: '#10b981' }, // Verde - diversão/natureza
  { name: 'Saúde', value: 180, color: '#ef4444' }, // Vermelho - saúde/emergência
  { name: 'Compras', value: 220, color: '#ec4899' }, // Rosa - consumo/compras
  { name: 'Outros', value: 150, color: '#6b7280' }, // Cinza neutro
];

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
          €{data.value.toLocaleString()}
        </div>
      </div>
    );
  }
  return null;
};

export function ExpensesByCategory() {
  const { t } = useLanguage();

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
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Gráfico */}
          <div className="flex-shrink-0">
            <ResponsiveContainer width={240} height={240}>
              <PieChart>
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
            </ResponsiveContainer>
          </div>
          
          {/* Legend minimalista */}
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
                      <span className="font-semibold">€{item.value.toLocaleString()}</span>
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
        
        {/* Total */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total de Gastos</span>
            <span className="text-lg font-bold">€{total.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
