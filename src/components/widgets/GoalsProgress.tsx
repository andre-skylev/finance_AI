"use client"

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { Target, TrendingUp, Clock } from 'lucide-react';

export function GoalsProgress() {
  const { t } = useLanguage();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/goals');
        if (!res.ok) {
          // If unauthorized, just return empty goals without throwing error
          if (res.status === 401) {
            if (!cancelled) setGoals([]);
            return;
          }
          throw new Error('Failed to load goals');
        }
        const data = await res.json();
        if (!cancelled) setGoals(data.goals || []);
      } catch (error) {
        console.error('Error loading goals:', error);
        if (!cancelled) setGoals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className="col-span-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('dashboard.financialGoals')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-100 rounded-lg"></div>
            <div className="h-20 bg-gray-100 rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!goals || goals.length === 0) {
    return (
      <Card className="col-span-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('dashboard.financialGoals')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('goals.noGoals')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('goals.createFirst')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            const progress = goal.target_amount > 0 
              ? Math.round((goal.current_amount / goal.target_amount) * 100)
              : 0;
            const remaining = goal.target_amount - goal.current_amount;
            const deadline = goal.target_date ? new Date(goal.target_date) : null;
            const now = new Date();
            const monthsRemaining = deadline 
              ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
              : null;
            
            // Select icon based on progress
            const Icon = progress >= 75 ? TrendingUp : progress >= 50 ? Target : Clock;
            
            return (
              <div key={goal.id} className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="font-medium text-sm">{goal.name}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {progress}%
                  </span>
                </div>
                
                <Progress value={progress} className="h-2" />
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('dashboard.saved')}:</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('pt-PT', { 
                        style: 'currency', 
                        currency: goal.currency || 'EUR' 
                      }).format(goal.current_amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('dashboard.target')}:</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('pt-PT', { 
                        style: 'currency', 
                        currency: goal.currency || 'EUR' 
                      }).format(goal.target_amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('dashboard.remaining')}:</span>
                    <span className="font-medium text-orange-600">
                      {new Intl.NumberFormat('pt-PT', { 
                        style: 'currency', 
                        currency: goal.currency || 'EUR' 
                      }).format(Math.max(0, remaining))}
                    </span>
                  </div>
                  {deadline && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('dashboard.deadline')}:</span>
                        <span className="font-medium">{deadline.toLocaleDateString('pt-PT')}</span>
                      </div>
                      {monthsRemaining !== null && monthsRemaining > 0 && (
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-muted-foreground">{t('dashboard.monthsLeft')}:</span>
                          <span className="font-medium text-blue-600">{monthsRemaining}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}