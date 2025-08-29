"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/LanguageContext"
import { useCurrency } from "@/hooks/useCurrency"
import { Progress } from "@/components/ui/progress"
import { 
  Zap, 
  Home, 
  Shield, 
  Car, 
  Wifi, 
  CreditCard, 
  Calendar,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react"

const costTypeIcons = {
  utilities: Zap,
  housing: Home,
  insurance: Shield,
  transport: Car,
  communication: Wifi,
  financial: CreditCard,
  subscriptions: Calendar,
  other: MoreHorizontal
}

interface FixedCostsData {
  dashboard: {
    totalEstimated: number
    totalActual: number
    paidCount: number
    pendingCount: number
    overdueCount: number
    byType: Record<string, {
      estimated: number
      actual: number
      count: number
    }>
  }
  costs: Array<{
    id: string
    name: string
    type: string
    estimated: number
    actual: number
    currency: string
    provider: string
    dueDay: number
    status: 'paid' | 'pending' | 'overdue'
    paymentDate?: string
    variance: number
  }>
  month: string
}

export function FixedCosts() {
  const { t } = useLanguage()
  const { formatWithConversion, displayCurrency } = useCurrency()
  const [data, setData] = useState<FixedCostsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/dashboard?type=fixed-costs&currency=${encodeURIComponent(displayCurrency)}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching fixed costs data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [displayCurrency])

  if (loading) {
    return (
      <div className="col-span-12 lg:col-span-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.fixedCosts.title') || 'Custos Fixos'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="col-span-12 lg:col-span-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.fixedCosts.title') || 'Custos Fixos'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t('dashboard.fixedCosts.noData') || 'Nenhum dado disponível'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { dashboard } = data

  // Calculate completion percentage
  const totalItems = dashboard.paidCount + dashboard.pendingCount + dashboard.overdueCount
  const completionRate = totalItems > 0 ? (dashboard.paidCount / totalItems) * 100 : 0

  // Calculate variance
  const variance = dashboard.totalEstimated > 0 
    ? ((dashboard.totalActual - dashboard.totalEstimated) / dashboard.totalEstimated) * 100 
    : 0

  // Already converted on the API side to displayCurrency; format as-is
  const formatCurrency = (amount: number) => {
    return formatWithConversion(amount, displayCurrency as any)
  }

  const getVarianceIcon = (variance: number) => {
    if (variance > 5) return <TrendingUp className="h-3 w-3 text-red-500" />
    if (variance < -5) return <TrendingDown className="h-3 w-3 text-green-500" />
    return <Minus className="h-3 w-3 text-gray-500" />
  }

  const getVarianceColor = (variance: number) => {
    if (variance > 5) return "text-red-500"
    if (variance < -5) return "text-green-500"
    return "text-gray-500"
  }

  // Get top 3 cost types by amount
  const topTypes = Object.entries(dashboard.byType)
    .sort(([,a], [,b]) => (b.actual || b.estimated) - (a.actual || a.estimated))
    .slice(0, 3)

  return (
    <div className="col-span-12 lg:col-span-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            {t('dashboard.fixedCosts.title') || 'Custos Fixos'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t('dashboard.fixedCosts.estimated') || 'Estimado'}
              </p>
              <p className="text-lg font-semibold">
                {formatCurrency(dashboard.totalEstimated)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t('dashboard.fixedCosts.actual') || 'Real'}
              </p>
              <div className="flex items-center gap-1">
                <p className="text-lg font-semibold">
                  {formatCurrency(dashboard.totalActual)}
                </p>
                {getVarianceIcon(variance)}
                <span className={`text-xs ${getVarianceColor(variance)}`}>
                  {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{t('dashboard.fixedCosts.completion') || 'Completude'}</span>
              <span>{completionRate.toFixed(0)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{t('dashboard.fixedCosts.paid') || 'Pagos'}: {dashboard.paidCount}</span>
              <span>{t('dashboard.fixedCosts.pending') || 'Pendentes'}: {dashboard.pendingCount}</span>
              {dashboard.overdueCount > 0 && (
                <span className="text-red-500">
                  {t('dashboard.fixedCosts.overdue') || 'Atrasados'}: {dashboard.overdueCount}
                </span>
              )}
            </div>
          </div>

          {/* Top cost types */}
          <div>
            <p className="text-sm font-medium mb-2">
              {t('dashboard.fixedCosts.topCategories') || 'Principais Categorias'}
            </p>
            <div className="space-y-2">
              {topTypes.map(([type, typeData]) => {
                const Icon = costTypeIcons[type as keyof typeof costTypeIcons] || MoreHorizontal
                const amount = typeData.actual || typeData.estimated
                
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {t(`fixedCosts.types.${type}`) || type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({typeData.count})
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
