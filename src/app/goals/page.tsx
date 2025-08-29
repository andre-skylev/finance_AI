"use client"

import { useCallback, useMemo, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '../../contexts/LanguageContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { GoalCard, Goal } from './components/GoalCard'
import { GoalForm, GoalFormValues } from './components/GoalForm'

export default function GoalsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = useMemo(() => createClient(), [])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setGoals(data || [])
    } catch (error) {
      console.error('Error fetching goals:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, user])

  useEffect(() => {
    if (user) {
      fetchGoals()
    }
  }, [user, fetchGoals])


  const handleFormSubmit = async (values: GoalFormValues) => {
    try {
      if (editingGoal) {
        // Update existing goal
        const { error } = await supabase
          .from('goals')
          .update({
            name: values.name,
            description: values.description,
            target_amount: values.target_amount,
            currency: values.currency,
            target_date: values.target_date,
          })
          .eq('id', editingGoal.id)
        if (error) throw error
      } else {
        // Create new goal
        const { error } = await supabase.from('goals').insert([
          {
            user_id: user?.id,
            name: values.name,
            description: values.description,
            target_amount: values.target_amount,
            current_amount: 0,
            currency: values.currency,
            target_date: values.target_date,
            is_completed: false,
          },
        ])
        if (error) throw error
      }

      fetchGoals()
      setIsFormOpen(false)
      setEditingGoal(null)
    } catch (error: any) {
      alert(t('messages.errorSaving') + error.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('goals.deleteConfirm'))) return
    try {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
      fetchGoals()
    } catch (error) {
      console.error('Error deleting goal:', error)
    }
  }

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setIsFormOpen(true)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary"></div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t('goals.title')}</h1>
            <p className="text-muted-foreground">{t('goals.subtitle')}</p>
          </div>
          {/* Quick coach summary (simple MVP) */}
          <div className="text-sm text-muted-foreground">
            {goals.length > 0 && goals.map((g)=>{
              const today = new Date()
              const target = g.target_date ? new Date(g.target_date) : null
              const monthsRemaining = target ? Math.max(1, (target.getFullYear()-today.getFullYear())*12 + (target.getMonth()-today.getMonth())) : null
              const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount||0))
              const neededMonthly = monthsRemaining ? (remaining / monthsRemaining) : null
              return (
                <div key={g.id} className="flex items-center gap-2">
                  <span className="font-medium">{g.name}</span>
                  {neededMonthly !== null && (
                    <span>
                      • {t('goals.perMonth') || 'por mês'}: {new Intl.NumberFormat('pt-PT',{style:'currency',currency:g.currency}).format(neededMonthly)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <Button onClick={() => {
            setEditingGoal(null)
            setIsFormOpen(true)
          }}>
            <Plus className="h-5 w-5 mr-2" />
            {t('goals.newGoal')}
          </Button>
          
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <GoalForm
              onSubmit={handleFormSubmit}
              initialValues={editingGoal ? {
                name: editingGoal.name,
                description: editingGoal.description || '',
                target_amount: editingGoal.target_amount,
                currency: editingGoal.currency as "EUR" | "BRL",
                target_date: editingGoal.target_date || '',
              } : undefined}
            />
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const today = new Date()
            const target = goal.target_date ? new Date(goal.target_date) : null
            const monthsRemaining = target ? Math.max(1, (target.getFullYear()-today.getFullYear())*12 + (target.getMonth()-today.getMonth())) : null
            const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount||0))
            const neededMonthly = monthsRemaining ? (remaining / monthsRemaining) : null
            return (
              <div key={goal.id} className="relative">
                {neededMonthly !== null && (
                  <div className={`absolute right-2 top-2 text-xs px-2 py-0.5 rounded ${neededMonthly<=0?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                    {new Intl.NumberFormat('pt-PT',{style:'currency',currency:goal.currency}).format(neededMonthly)} / {t('goals.month')||'mês'}
                  </div>
                )}
                <GoalCard goal={goal} onDelete={handleDelete} onEdit={handleEdit} />
              </div>
            )
          })}
        </div>

        {goals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('goals.createFirst')}</p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}