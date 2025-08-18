"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Target, Calendar } from 'lucide-react';

// Dados simulados - em produção viriam da API
const kpis = [
  {
    title: 'Receita Mensal',
    value: '€3,200',
    change: '+4.2%',
    trend: 'up',
    icon: DollarSign,
    description: 'vs mês anterior'
  },
  {
    title: 'Gastos Mensais',
    value: '€2,450',
    change: '-8.1%',
    trend: 'down',
    icon: CreditCard,
    description: 'vs mês anterior'
  },
  {
    title: 'Taxa de Poupança',
    value: '23.4%',
    change: '+2.1%',
    trend: 'up',
    icon: Target,
    description: 'do rendimento'
  },
  {
    title: 'Dias até Próxima Meta',
    value: '127',
    change: '-5 dias',
    trend: 'down',
    icon: Calendar,
    description: 'viagem para o Brasil'
  }
];

export function FinancialKPIs() {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        const isPositive = kpi.trend === 'up';
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;
        
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendIcon className={`h-3 w-3 mr-1 ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`} />
                <span className={`font-medium ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpi.change}
                </span>
                <span className="ml-1">{kpi.description}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
