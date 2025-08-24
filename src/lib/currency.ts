/**
 * Sistema Centralizado de Formatação de Moedas
 * Resolve problemas de formatação regional para EUR, BRL e futuras moedas
 */

// Configurações regionais para cada moeda
export const CURRENCY_CONFIGS = {
  EUR: {
    code: 'EUR',
    symbol: '€',
    locale: 'pt-PT', // Formato português: 1.234,56 €
    placement: 'suffix', // € vai depois do número
    decimalSeparator: ',',
    thousandsSeparator: '.',
    precision: 2
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    locale: 'pt-BR', // Formato brasileiro: R$ 1.234,56
    placement: 'prefix', // R$ vai antes do número
    decimalSeparator: ',',
    thousandsSeparator: '.',
    precision: 2
  },
  USD: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US', // Formato americano: $1,234.56
    placement: 'prefix',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    precision: 2
  }
} as const

export type SupportedCurrency = keyof typeof CURRENCY_CONFIGS

/**
 * Formata um valor monetário de acordo com a moeda e região
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: SupportedCurrency = 'EUR',
  options: {
    showSymbol?: boolean
    showCode?: boolean
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    locale?: string
  } = {}
): string {
  // Validar entrada
  const numericAmount = parseFloat(String(amount || 0))
  if (isNaN(numericAmount)) return '0,00'

  const config = CURRENCY_CONFIGS[currency]
  if (!config) {
    console.warn(`Moeda não suportada: ${currency}. Usando EUR como fallback.`)
    return formatCurrency(amount, 'EUR', options)
  }

  const {
    showSymbol = true,
    showCode = false,
    minimumFractionDigits = config.precision,
    maximumFractionDigits = config.precision,
    locale = config.locale
  } = options

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: showSymbol ? 'currency' : 'decimal',
      currency: showSymbol ? config.code : undefined,
      minimumFractionDigits,
      maximumFractionDigits,
      // Personalizar posição do símbolo quando necessário
      ...(currency === 'EUR' && showSymbol ? {
        currencyDisplay: 'symbol'
      } : {})
    })

    let formatted = formatter.format(numericAmount)

    // Ajustes específicos para EUR (símbolo após o valor)
    if (currency === 'EUR' && showSymbol && locale === 'pt-PT') {
      // Garantir que € aparece depois: "1.234,56 €"
      formatted = formatted.replace(/€\s*/, '').trim() + ' €'
    }

    // Adicionar código da moeda se solicitado
    if (showCode && !showSymbol) {
      formatted += ` ${config.code}`
    }

    return formatted

  } catch (error) {
    console.error(`Erro na formatação de moeda: ${error}`)
    // Fallback manual
    const fixed = numericAmount.toFixed(config.precision)
    return showSymbol ? `${config.symbol}${fixed}` : fixed
  }
}

/**
 * Formata valor sem símbolo de moeda (apenas número formatado)
 */
export function formatNumber(
  amount: number | string | null | undefined,
  currency: SupportedCurrency = 'EUR',
  precision?: number
): string {
  return formatCurrency(amount, currency, {
    showSymbol: false,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  })
}

/**
 * Parseia string formatada de volta para número
 */
export function parseCurrencyString(
  value: string,
  currency: SupportedCurrency = 'EUR'
): number {
  if (!value || typeof value !== 'string') return 0

  const config = CURRENCY_CONFIGS[currency]
  
  // Remover símbolos e espaços
  let cleaned = value
    .replace(new RegExp(`[${config.symbol}]`, 'g'), '')
    .replace(/\s/g, '')
    .trim()

  // Tratar formato regional
  if (currency === 'EUR' || currency === 'BRL') {
    // Formato: 1.234,56 -> 1234.56
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',')
      if (parts.length === 2) {
        const integerPart = parts[0].replace(/\./g, '')
        const decimalPart = parts[1]
        cleaned = `${integerPart}.${decimalPart}`
      }
    }
  } else if (currency === 'USD') {
    // Formato: 1,234.56 -> 1234.56
    cleaned = cleaned.replace(/,/g, '')
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Converte entre moedas (usando taxas de câmbio)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  exchangeRates?: { eur_to_brl: number; brl_to_eur: number; usd_to_eur?: number }
): number {
  if (fromCurrency === toCurrency) return amount
  if (!exchangeRates) return amount

  // Implementar conversões conhecidas
  if (fromCurrency === 'EUR' && toCurrency === 'BRL') {
    return amount * exchangeRates.eur_to_brl
  }
  if (fromCurrency === 'BRL' && toCurrency === 'EUR') {
    return amount * exchangeRates.brl_to_eur
  }

  // Adicionar mais conversões conforme necessário
  console.warn(`Conversão ${fromCurrency} -> ${toCurrency} não implementada`)
  return amount
}

/**
 * Utilitário para campos de input de valor monetário
 */
export function formatCurrencyInput(
  value: string,
  currency: SupportedCurrency = 'EUR'
): string {
  // Remove caracteres inválidos
  const cleaned = value.replace(/[^\d,.-]/g, '')
  
  // Aplica formatação conforme o usuário digita
  const config = CURRENCY_CONFIGS[currency]
  
  if (currency === 'EUR' || currency === 'BRL') {
    // Permite apenas vírgula como separador decimal
    return cleaned.replace(/\./g, '').replace(/,/g, ',')
  } else {
    // Para USD e outros, permite ponto como decimal
    return cleaned.replace(/,/g, '').replace(/\./g, '.')
  }
}

/**
 * Detecta moeda a partir de string de texto
 */
export function detectCurrency(text: string): SupportedCurrency {
  const lowerText = text.toLowerCase()
  
  if (lowerText.includes('€') || lowerText.includes('eur')) return 'EUR'
  if (lowerText.includes('r$') || lowerText.includes('brl') || lowerText.includes('real')) return 'BRL'
  if (lowerText.includes('$') || lowerText.includes('usd') || lowerText.includes('dollar')) return 'USD'
  
  // Default para EUR
  return 'EUR'
}

/**
 * Validações para valores monetários
 */
export function validateCurrencyAmount(
  amount: number | string,
  currency: SupportedCurrency = 'EUR'
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const numericAmount = typeof amount === 'string' ? parseCurrencyString(amount, currency) : amount

  if (isNaN(numericAmount)) {
    errors.push('Valor deve ser numérico')
  }

  if (numericAmount < 0) {
    errors.push('Valor não pode ser negativo')
  }

  // Validar precisão máxima
  const config = CURRENCY_CONFIGS[currency]
  const decimalPlaces = (numericAmount.toString().split('.')[1] || '').length
  if (decimalPlaces > config.precision) {
    errors.push(`Máximo ${config.precision} casas decimais para ${currency}`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Exportar configurações para uso em componentes
export { CURRENCY_CONFIGS as CURRENCIES }
