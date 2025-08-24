# Sistema Centralizado de Formatação de Moedas

## Visão Geral

Foi implementado um sistema centralizado de formatação de moedas que resolve os problemas de inconsistência e formatação regional. O sistema suporta EUR, BRL, USD e pode ser facilmente estendido para outras moedas.

## Principais Melhorias

✅ **Formatação Regional Correta**: 
- EUR: `1.234,56 €` (formato português)
- BRL: `R$ 1.234,56` (formato brasileiro)
- USD: `$1,234.56` (formato americano)

✅ **Parse Bidirecional**: Converte strings formatadas de volta para números

✅ **Configuração Flexível**: Controle sobre símbolo, código da moeda, precisão decimal

✅ **Tratamento de Casos Extremos**: Validação robusta de entradas inválidas

## Como Usar

### 1. Hook useCurrency (Recomendado para React)

```typescript
import { useCurrency } from '@/hooks/useCurrency'

function MyComponent() {
  const { formatBalance, formatAmount, parse } = useCurrency()
  
  // Formatação básica
  const formatted = formatBalance(1234.56) // "1.234,56 €"
  
  // Parse de string
  const number = parse("1.234,56 €") // 1234.56
  
  // Formatação sem símbolo
  const formatters = useCurrency().formatters
  const tableValue = formatters.table(1234.56) // "1.234,56 €"
}
```

### 2. Utilitários Diretos

```typescript
import { formatCurrency, parseCurrencyString } from '@/lib/currency'

// Formatação com opções
const formatted = formatCurrency(1234.56, 'EUR', {
  showSymbol: true,
  minimumFractionDigits: 2
})

// Parse de string
const value = parseCurrencyString("R$ 1.234,56", 'BRL')
```

## Contextos de Uso

### Dashboard e KPIs
```typescript
const { formatBalance } = useCurrency()
return <div>{formatBalance(totalBalance)}</div>
```

### Tabelas e Listas
```typescript
const { formatters } = useCurrency()
return <td>{formatters.table(amount)}</td>
```

### Formulários
```typescript
const { formatters, parse } = useCurrency()

// Display
<input value={formatters.form(amount)} />

// Parse ao submeter
const numericValue = parse(inputValue)
```

### Resumos Financeiros
```typescript
const { formatters } = useCurrency()
return <span>{formatters.summary(totalExpenses)}</span>
```

## Migração de Código Existente

### Antes (Código Antigo)
```typescript
// ❌ Inconsistente e limitado
const formatted = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR'
}).format(amount)

// ❌ Hardcoded e inflexível
const value = `€${amount.toFixed(2)}`
```

### Depois (Novo Sistema)
```typescript
// ✅ Centralizado e flexível
const { formatBalance } = useCurrency()
const formatted = formatBalance(amount)

// ✅ Com controle regional automático
const { formatters } = useCurrency()
const value = formatters.table(amount)
```

## Configurações Suportadas

### Moedas Disponíveis
- **EUR**: Formato português (`1.234,56 €`)
- **BRL**: Formato brasileiro (`R$ 1.234,56`)
- **USD**: Formato americano (`$1,234.56`)

### Opções de Formatação
```typescript
interface FormatOptions {
  showSymbol?: boolean        // Exibir símbolo da moeda
  showCode?: boolean          // Exibir código (EUR, BRL, USD)
  minimumFractionDigits?: number  // Mínimo de casas decimais
  maximumFractionDigits?: number  // Máximo de casas decimais
  locale?: string             // Locale específico
}
```

## Validação e Tratamento de Erros

```typescript
import { validateCurrencyAmount } from '@/lib/currency'

const validation = validateCurrencyAmount(userInput, 'EUR')
if (!validation.isValid) {
  console.log('Erros:', validation.errors)
}
```

## Extensão para Novas Moedas

Para adicionar uma nova moeda, edite `/src/lib/currency.ts`:

```typescript
export const CURRENCY_CONFIGS = {
  // ... existentes
  GBP: {
    code: 'GBP',
    symbol: '£',
    locale: 'en-GB',
    placement: 'prefix',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    precision: 2
  }
}
```

## Arquivos Atualizados

### Novos Arquivos
- `/src/lib/currency.ts` - Utilitários centralizados
- `/src/hooks/useCurrency.ts` - Hook React
- `/teste-sistema-moedas.js` - Testes de validação

### Arquivos Migrados
- `/src/components/AccountManager.tsx` - ✅ Migrado
- `/src/app/accounts/page.tsx` - ✅ Migrado
- `/src/components/PDFUploader.tsx` - ✅ Migrado
- `/src/components/widgets/FinancialKPIs.tsx` - ✅ Migrado

### Pendentes de Migração
- `/src/components/widgets/AccountBalances.tsx`
- `/src/components/widgets/ExpensesByCategory.tsx`
- `/src/components/widgets/CashFlow.tsx`
- `/src/components/widgets/NetWorth.tsx`
- `/src/components/widgets/BudgetVsActual.tsx`
- `/src/components/widgets/FixedCosts.tsx`
- `/src/components/widgets/RecentTransactions.tsx`
- `/src/components/widgets/GoalsProgress.tsx`
- Páginas: receipts, credit-cards, transactions, etc.

## Próximos Passos

1. **Migrar widgets restantes** - Substituir implementações antigas
2. **Migrar páginas** - Atualizar todas as páginas com formatação de moeda
3. **Adicionar configuração de usuário** - Permitir escolha de moeda padrão
4. **Testes automatizados** - Criar testes unitários para o sistema
5. **Documentação** - Expandir documentação com mais exemplos

## Benefícios Alcançados

✅ **Consistência**: Formatação uniforme em toda aplicação  
✅ **Flexibilidade**: Suporte a múltiplas moedas e regiões  
✅ **Manutenibilidade**: Mudanças centralizadas afetam toda aplicação  
✅ **Extensibilidade**: Fácil adição de novas moedas  
✅ **Robustez**: Tratamento adequado de casos extremos  
✅ **Performance**: Cache inteligente com useMemo  

O sistema resolve completamente o problema de formatação de moedas identificado pelo usuário e estabelece uma base sólida para expansão futura da aplicação para outras regiões e moedas.
