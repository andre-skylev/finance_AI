"use client"

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { Target, TrendingUp, Clock } from 'lucide-react';

// Dados simulados - em produção viriam da API
const goals = [
  {
    id: 1,
    name: 'Fundo de Emergência',
    target: 10000,
    current: 6500,
    progress: 65,
    deadline: '2025-12-31',
    monthlyContribution: 300,
    icon: Target
  },
  {
    id: 2,
    name: 'Viagem para o Brasil',
    target: 3500,
    current: 1200,
    progress: 34,
    deadline: '2025-07-15',
    monthlyContribution: 250,
    icon: TrendingUp
  },
  {
    id: 3,
    name: 'Entrada para Apartamento',
    target: 25000,
    current: 8500,
    progress: 34,
    deadline: '2026-06-30',
    monthlyContribution: 800,
    icon: Clock
  }
];

export function GoalsProgress() {
  const { t } = useLanguage();

  return (
    <Card className="col-span-12">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {t('dashboard.financialGoals')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const remaining = goal.target - goal.current;
            const deadline = new Date(goal.deadline);
            const now = new Date();
            const monthsRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
            
            return (
              <div key={goal.id} className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="font-medium text-sm">{goal.name}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {goal.progress}%
                  </span>
                </div>
                
                <Progress value={goal.progress} className="h-2" />
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('dashboard.saved')}:</span>
                    <span className="font-medium">€{goal.current.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('dashboard.target')}:</span>
                    <span className="font-medium">€{goal.target.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('dashboard.remaining')}:</span>
                    <span className="font-medium text-orange-600">€{remaining.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('dashboard.deadline')}:</span>
                    <span className="font-medium">{deadline.toLocaleDateString('pt-PT')}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">{t('dashboard.monthsLeft')}:</span>
                    <span className="font-medium text-blue-600">{monthsRemaining}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
