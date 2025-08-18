'use client'

import { Save, X, Target, CheckCircle, Plus, CreditCard, Landmark } from 'lucide-react'

interface Transaction {
  date: string
  description?: string
  merchant?: string
  amount: number
  type?: 'credit' | 'debit'
  category: string
  pattern_matched?: string
  confidence?: number
  installments?: number
  installment_info?: string
}

interface AccountInfo {
  bank?: string
  account_number?: string
  period?: string
}

interface CardInfo {
  bank?: string
  last_four_digits?: string
  card_brand?: string
  credit_limit?: number
  statement_date?: string
  due_date?: string
  previous_balance?: number
  payments?: number
  new_purchases?: number
  interest_charges?: number
  fees?: number
  total_amount?: number
  minimum_payment?: number
}

interface AutoCreatedAccount {
  account_id: string
  account_type: string
  was_created: boolean
  account_name: string
}

interface ReviewTransactionsProps {
  transactions: Transaction[]
  accountInfo?: AccountInfo
  cardInfo?: CardInfo
  detectedBank: string
  documentType: string
  isCreditCard?: boolean
  autoCreatedAccount?: AutoCreatedAccount | null
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}

export function ReviewTransactions({
  transactions,
  accountInfo,
  cardInfo,
  detectedBank,
  documentType,
  isCreditCard = false,
  autoCreatedAccount,
  onSave,
  onCancel,
  isSaving,
}: ReviewTransactionsProps) {
  const totalCredits = transactions
    .filter(t => t.type === 'credit')
    .reduce((acc, t) => acc + t.amount, 0)
  const totalDebits = transactions
    .filter(t => t.type === 'debit' || !t.type) // Fatura de cartão não tem type, então trata como despesa
    .reduce((acc, t) => acc + t.amount, 0)

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {isCreditCard ? 'Revise a Fatura de Cartão de Crédito' : 'Revise as Transações Importadas'}
        </h2>
        
        {/* Notificação de conta/cartão criado automaticamente */}
        {autoCreatedAccount && autoCreatedAccount.was_created && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              {autoCreatedAccount.account_type === 'credit_card' ? (
                <CreditCard className="h-5 w-5 text-green-600 mr-2" />
              ) : (
                <Landmark className="h-5 w-5 text-green-600 mr-2" />
              )}
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <div>
                <p className="text-green-800 font-medium">
                  {autoCreatedAccount.account_type === 'credit_card' ? 'Cartão' : 'Conta'} criado automaticamente
                </p>
                <p className="text-green-700 text-sm">
                  <strong>{autoCreatedAccount.account_name}</strong> foi adicionado às suas contas.
                  Você pode editar o nome depois em Configurações.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Informação de conta/cartão encontrado */}
        {autoCreatedAccount && !autoCreatedAccount.was_created && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              {autoCreatedAccount.account_type === 'credit_card' ? (
                <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
              ) : (
                <Landmark className="h-5 w-5 text-blue-600 mr-2" />
              )}
              <div>
                <p className="text-blue-800 font-medium">
                  {autoCreatedAccount.account_type === 'credit_card' ? 'Cartão' : 'Conta'} identificado
                </p>
                <p className="text-blue-700 text-sm">
                  Transações serão importadas para: <strong>{autoCreatedAccount.account_name}</strong>
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Informações do documento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-semibold text-gray-600">
              {isCreditCard ? 'Banco Emissor:' : 'Banco Detectado:'}
            </p>
            <p className="text-gray-800">{detectedBank || 'Não identificado'}</p>
          </div>
          {!isCreditCard && accountInfo && (
            <>
              <div>
                <p className="font-semibold text-gray-600">Conta:</p>
                <p className="text-gray-800">{accountInfo.account_number || 'Não informado'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-600">Período do Extrato:</p>
                <p className="text-gray-800">{accountInfo.period || 'Não informado'}</p>
              </div>
            </>
          )}
          {isCreditCard && cardInfo && (
            <>
              <div>
                <p className="font-semibold text-gray-600">Cartão:</p>
                <p className="text-gray-800">
                  {cardInfo.card_brand?.toUpperCase() || 'N/A'}
                  {cardInfo.last_four_digits && ` •••• ${cardInfo.last_four_digits}`}
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-600">Vencimento:</p>
                <p className="text-gray-800">{cardInfo.due_date || 'Não informado'}</p>
              </div>
            </>
          )}
        </div>

        {/* Resumo da fatura (apenas para cartões de crédito) */}
        {isCreditCard && cardInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <p className="font-semibold text-blue-600">Saldo Anterior:</p>
              <p className="text-blue-800">{cardInfo.previous_balance?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="font-semibold text-blue-600">Compras:</p>
              <p className="text-blue-800">{cardInfo.new_purchases?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="font-semibold text-blue-600">Pagamentos:</p>
              <p className="text-green-800">{cardInfo.payments?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="font-semibold text-red-600">Total da Fatura:</p>
              <p className="text-red-800 font-bold">{cardInfo.total_amount?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-700">Nenhuma transação encontrada</h3>
            <p className="text-gray-500 mt-2">
              A IA não conseguiu extrair nenhuma transação deste documento. Tente com um extrato mais claro ou adicione as transações manualmente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {isCreditCard ? 'Comerciante' : 'Descrição'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria (sugerida)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  {isCreditCard && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parcelas</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((tx, index) => (
                  <tr key={index} className={tx.type === 'credit' ? 'bg-green-50' : 'bg-red-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{tx.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {isCreditCard ? tx.merchant : tx.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-col">
                        <span className="font-medium">{tx.category}</span>
                        {tx.pattern_matched && (
                          <span className="text-xs text-blue-600 mt-1 flex items-center">
                            <Target className="h-3 w-3 mr-1" />
                            {tx.pattern_matched} ({tx.confidence}% confiança)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isCreditCard ? tx.amount.toFixed(2) : 
                       `${tx.type === 'credit' ? '+' : '-'} ${Math.abs(tx.amount).toFixed(2)}`}
                    </td>
                    {isCreditCard && (
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {tx.installments && tx.installments > 1 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            {tx.installment_info || `1/${tx.installments}`}
                          </span>
                        ) : (
                          <span className="text-gray-400">À vista</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100">
                {!isCreditCard && (
                  <>
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right font-bold text-gray-700">Total de Receitas:</td>
                      <td className="px-6 py-3 text-right font-bold text-green-600">{totalCredits.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right font-bold text-gray-700">Total de Despesas:</td>
                      <td className="px-6 py-3 text-right font-bold text-red-600">{Math.abs(totalDebits).toFixed(2)}</td>
                    </tr>
                  </>
                )}
                {isCreditCard && (
                  <tr>
                    <td colSpan={4} className="px-6 py-3 text-right font-bold text-gray-700">Total de Compras:</td>
                    <td className="px-6 py-3 text-right font-bold text-red-600">{totalDebits.toFixed(2)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Transações'}
          </button>
        </div>
      )}
    </div>
  )
}
