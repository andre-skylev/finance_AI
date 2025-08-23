# Correção: fixedCosts.status Exposto

## ❌ Problema Identificado
A chave de tradução `fixedCosts.status` estava sendo exibida como texto literal na interface, em vez de mostrar a tradução correta.

## 🔍 Causa Raiz
O código estava referenciando `t('fixedCosts.status')` mas essa chave não existia nas traduções. Durante a reorganização das traduções para evitar duplicação, essa chave foi renomeada para `fixedCosts.statusLabel`.

## ✅ Solução Implementada

### Arquivos Corrigidos
**Arquivo**: `src/app/fixed-costs/page.tsx`

### Alterações Realizadas

#### 1. Correção no Cabeçalho de Status (linha 487)
```typescript
// ❌ Antes
<h3 className="text-lg font-medium text-gray-900">{t('fixedCosts.status')}</h3>

// ✅ Depois  
<h3 className="text-lg font-medium text-gray-900">{t('fixedCosts.statusLabel')}</h3>
```

#### 2. Correção no Label do Formulário (linha 614)
```typescript
// ❌ Antes
<label className="block text-sm font-medium text-gray-700 mb-2">
  {t('fixedCosts.status')}
</label>

// ✅ Depois
<label className="block text-sm font-medium text-gray-700 mb-2">
  {t('fixedCosts.statusLabel')}
</label>
```

### Traduções Utilizadas
As seguintes chaves de tradução estão corretas e funcionando:

#### Para labels de status:
- `fixedCosts.statusLabel` → "Estado" / "Status"

#### Para valores de status (mantidos corretos):
- `fixedCosts.status.pending` → "Pendente" / "Pending"  
- `fixedCosts.status.paid` → "Pago" / "Paid"
- `fixedCosts.status.overdue` → "Em Atraso" / "Overdue"

## 🧪 Validação
- ✅ Build compilou sem erros
- ✅ Todas as referências de tradução corrigidas
- ✅ Não há mais chaves expostas na interface
- ✅ Funcionalidade mantida intacta

## 📋 Estrutura Final das Traduções
```json
{
  "fixedCosts": {
    "statusLabel": "Estado",  // Para labels
    "status": {               // Para valores
      "pending": "Pendente",
      "paid": "Pago", 
      "overdue": "Em Atraso"
    }
  }
}
```

## 🎯 Resultado
- Interface agora exibe corretamente "Estado" em português e "Status" em inglês
- Não há mais texto de chave de tradução exposto
- Todas as funcionalidades de status continuam funcionando normalmente
