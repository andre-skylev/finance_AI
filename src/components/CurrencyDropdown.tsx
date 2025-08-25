'use client'

import React from 'react'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { Loader2 } from 'lucide-react'

type Props = {
  disabled?: boolean
  onChangeStart?: () => void
  onChangeEnd?: () => void
  loading?: boolean
}

export function CurrencyDropdown({ disabled, onChangeStart, onChangeEnd, loading }: Props) {
  const { displayCurrency, setDisplayCurrency } = useCurrency()
  const { t } = useLanguage()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as 'EUR'|'BRL'|'USD'
    if (next === displayCurrency) return
    onChangeStart?.()
    setDisplayCurrency(next)
    // optional small UX delay to show loaders if desired by parent
    window.setTimeout(() => onChangeEnd?.(), 400)
  }

  return (
    <div className="inline-flex items-center gap-2">
      <select
        id="currency-select"
        aria-label={t('settings.defaultCurrency')}
        title={t('settings.defaultCurrency')}
        disabled={disabled}
        value={displayCurrency}
        onChange={handleChange}
        className="px-2 py-1 border rounded-md text-sm bg-white disabled:opacity-50"
      >
        <option value="EUR">EUR</option>
        <option value="BRL">BRL</option>
  <option value="USD">USD</option>
      </select>
      {loading && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

export default CurrencyDropdown
