/**
 * Hook React para formatação de moedas
 * Integra o sistema de formatação com contexto da aplicação
 */

import { useLanguage } from '@/contexts/LanguageContext'
import { useCurrency as useCurrencyContext } from '@/contexts/CurrencyContext'
import { 
  formatCurrency, 
  formatNumber, 
  parseCurrencyString, 
  formatCurrencyInput,
  validateCurrencyAmount,
  convertCurrency,
  type SupportedCurrency 
} from '@/lib/currency'
import { useCallback, useMemo } from 'react'

export function useCurrency() {
  const { language } = useLanguage()
  
  // Integrar com contexto de câmbio existente
  const currencyContext = useCurrencyContext()
  const { displayCurrency, convert: convertExchange, rates } = currencyContext
  
  // Usar a moeda do contexto como padrão
  const defaultCurrency: SupportedCurrency = useMemo(() => {
    return displayCurrency as SupportedCurrency
  }, [displayCurrency])

  // Função de conversão que usa as taxas do contexto
  const convertAmount = useCallback((
    amount: number,
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency = defaultCurrency
  ) => {
    if (fromCurrency === toCurrency) return amount
    
    // Usar o sistema de conversão existente do contexto
    return convertExchange(amount, fromCurrency as 'EUR' | 'BRL', toCurrency as 'EUR' | 'BRL')
  }, [convertExchange, defaultCurrency])

  // Função de formatação com conversão automática
  const formatWithConversion = useCallback((
    amount: number | string | null | undefined,
    originalCurrency: SupportedCurrency,
    options?: Parameters<typeof formatCurrency>[2]
  ) => {
    const numericAmount = parseFloat(String(amount || 0))
    if (isNaN(numericAmount)) return formatCurrency(0, defaultCurrency, options)
    
    // Converter para a moeda de exibição atual
    const convertedAmount = convertAmount(numericAmount, originalCurrency, defaultCurrency)
    
    return formatCurrency(convertedAmount, defaultCurrency, options)
  }, [convertAmount, defaultCurrency])

  // Função de formatação com moeda padrão
  const format = useCallback((
    amount: number | string | null | undefined,
    currency: SupportedCurrency = defaultCurrency,
    options?: Parameters<typeof formatCurrency>[2]
  ) => {
    return formatCurrency(amount, currency, options)
  }, [defaultCurrency])

  // Função para formatar apenas números (sem símbolo)
  const formatNumeric = useCallback((
    amount: number | string | null | undefined,
    currency: SupportedCurrency = defaultCurrency,
    precision?: number
  ) => {
    return formatNumber(amount, currency, precision)
  }, [defaultCurrency])

  // Função para parsear strings monetárias
  const parse = useCallback((
    value: string,
    currency: SupportedCurrency = defaultCurrency
  ) => {
    return parseCurrencyString(value, currency)
  }, [defaultCurrency])

  // Função para formatação de inputs
  const formatInput = useCallback((
    value: string,
    currency: SupportedCurrency = defaultCurrency
  ) => {
    return formatCurrencyInput(value, currency)
  }, [defaultCurrency])

  // Função de validação
  const validate = useCallback((
    amount: number | string,
    currency: SupportedCurrency = defaultCurrency
  ) => {
    return validateCurrencyAmount(amount, currency)
  }, [defaultCurrency])

  // Utilitários específicos para diferentes contextos
  const formatters = useMemo(() => ({
    // Para exibição em dashboards (com conversão automática)
    dashboard: (amount: number | string, originalCurrency?: SupportedCurrency) => 
      originalCurrency 
        ? formatWithConversion(amount, originalCurrency, { showSymbol: true, minimumFractionDigits: 0, maximumFractionDigits: 0 })
        : format(amount, defaultCurrency, { showSymbol: true, minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    
    // Para tabelas e listas (com conversão automática)
    table: (amount: number | string, originalCurrency?: SupportedCurrency) => 
      originalCurrency 
        ? formatWithConversion(amount, originalCurrency, { showSymbol: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : format(amount, defaultCurrency, { showSymbol: true, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    
    // Para formulários (sem conversão, moeda específica)
    form: (amount: number | string, currency: SupportedCurrency = defaultCurrency) => 
      formatNumeric(amount, currency, 2),
    
    // Para resumos financeiros (com conversão automática)
    summary: (amount: number | string, originalCurrency?: SupportedCurrency) => 
      originalCurrency 
        ? formatWithConversion(amount, originalCurrency, { showSymbol: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : format(amount, defaultCurrency, { showSymbol: true, minimumFractionDigits: 2, maximumFractionDigits: 2 }),

    // Para cartões de crédito (valor mais compacto, com conversão)
    compact: (amount: number | string, originalCurrency?: SupportedCurrency) => 
      originalCurrency 
        ? formatWithConversion(amount, originalCurrency, { showSymbol: true, minimumFractionDigits: 0, maximumFractionDigits: 2 })
        : format(amount, defaultCurrency, { showSymbol: true, minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }), [format, formatNumeric, defaultCurrency, formatWithConversion])

  return {
    // Configuração atual
    currentCurrency: defaultCurrency,
    displayCurrency,
    rates,
    
    // Funções principais
    format,
    formatNumeric,
    parse,
    formatInput,
    validate,
    
    // Funções de conversão
    convertAmount,
    formatWithConversion,
    
    // Formatadores contextuais
    formatters,
    
    // Utilitários
    formatCurrency: (amount: number | string, currency?: SupportedCurrency) => 
      format(amount, currency),
    formatAmount: (amount: number | string, currency?: SupportedCurrency) => 
      format(amount, currency || defaultCurrency),
    formatBalance: (amount: number | string, currency?: SupportedCurrency) => 
      format(amount, currency || defaultCurrency),
    formatCompact: (amount: number | string, currency?: SupportedCurrency) => 
      format(amount, currency || defaultCurrency, {
        showSymbol: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }),
    
    // Utilitários com conversão automática para moeda de exibição
    formatBalanceWithConversion: (amount: number | string, originalCurrency: SupportedCurrency) =>
      formatWithConversion(amount, originalCurrency),
    formatAmountWithConversion: (amount: number | string, originalCurrency: SupportedCurrency) =>
      formatWithConversion(amount, originalCurrency)
  }
}

/**
 * Hook específico para campos de input monetários
 */
export function useCurrencyInput(
  initialValue: string = '',
  currency: SupportedCurrency = 'EUR'
) {
  const { formatInput, parse, validate } = useCurrency()

  const formatValue = useCallback((value: string) => {
    return formatInput(value, currency)
  }, [formatInput, currency])

  const parseValue = useCallback((value: string) => {
    return parse(value, currency)
  }, [parse, currency])

  const validateValue = useCallback((value: string) => {
    return validate(value, currency)
  }, [validate, currency])

  return {
    formatValue,
    parseValue,
    validateValue,
    currency
  }
}
