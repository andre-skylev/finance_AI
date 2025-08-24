"use client"

import React from 'react'
import { Receipt } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCurrency } from '@/hooks/useCurrency'

export default function ReceiptsPage() {
  const { t } = useLanguage()
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-optimized Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight">
              {t('receipts.title')}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile optimized */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Upload section removed per request */}

          {/* Receipts List */}
          <ReceiptsList />
        </div>
      </div>
    </div>
  )
}

function ReceiptsList() {
  const { t, language } = useLanguage()
  const { formatBalance } = useCurrency()
  const [loading, setLoading] = React.useState(true)
  const [receipts, setReceipts] = React.useState<any[]>([])
  const [error, setError] = React.useState<string>('')
  const [selectedReceipt, setSelectedReceipt] = React.useState<any>(null)
  const [showDetails, setShowDetails] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/receipts')
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || t('receipts.errors.loadFailed'))
        if (!cancelled) setReceipts(j.receipts || [])
      } catch (e: any) {
        if (!cancelled) setError(e.message || t('receipts.errors.unexpected'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleReceiptClick = (receipt: any) => {
    setSelectedReceipt(receipt)
    setShowDetails(true)
  }

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!confirm(t('receipts.confirmDelete'))) return
    
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setReceipts(receipts.filter(r => r.id !== receiptId))
        setShowDetails(false)
        setSelectedReceipt(null)
      } else {
        const result = await response.json()
        throw new Error(result.error || 'Erro ao excluir recibo')
      }
    } catch (error: any) {
      alert(error.message)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-6 sm:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-100 rounded-lg w-32"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-50 rounded-xl"></div>
            <div className="h-16 bg-gray-50 rounded-xl"></div>
            <div className="h-16 bg-gray-50 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-6 sm:p-8">
        <div className="text-center py-4">
          <div className="text-gray-600 text-sm">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 text-sm text-gray-900 font-medium hover:text-gray-600 transition-colors"
          >
            {t('receipts.errors.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  if (!receipts?.length) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60">
        <div className="text-center py-12 sm:py-16 px-6 sm:px-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-100 mb-3 sm:mb-4">
            <Receipt className="h-6 w-6 sm:h-7 sm:w-7 text-gray-400" />
          </div>
          <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-1 sm:mb-2">
            {t('receipts.noReceipts')}
          </h3>
          <p className="text-gray-500 text-xs sm:text-sm max-w-xs mx-auto">
            {t('receipts.noReceiptsDesc')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60">
      <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-medium text-gray-900">
            {t('receipts.allReceipts')}
          </h2>
          <span className="text-xs sm:text-sm text-gray-500">
            {receipts.length} {t('receipts.total')}
          </span>
        </div>
      </div>

      {/* Mobile-optimized List View */}
      <div className="divide-y divide-gray-100">
        {receipts.map((r) => (
          <div 
            key={r.id} 
            className="px-4 sm:px-8 py-4 sm:py-5 hover:bg-gray-50/50 transition-colors cursor-pointer"
            onClick={() => handleReceiptClick(r)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                  <h3 className="font-medium text-gray-900 text-sm truncate">
                    {r.merchant_name || t('receipts.unknownMerchant')}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {r.receipt_date ? new Date(r.receipt_date).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    }) : '—'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500">
                  {typeof r.subtotal === 'number' && (
                    <span>{t('receipts.subtotal')} {formatBalance(r.subtotal, 'EUR')}</span>
                  )}
                  {typeof r.tax === 'number' && r.tax > 0 && (
                    <span>{t('receipts.tax')} {formatBalance(r.tax, 'EUR')}</span>
                  )}
                </div>
              </div>
              <div className="text-right ml-4">
                <div className="text-sm sm:text-base font-semibold text-gray-900">
                  {formatBalance(r.total, 'EUR')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ver detalhes →
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Receipt Details Modal */}
      {showDetails && selectedReceipt && (
        <ReceiptDetailsModal 
          receipt={selectedReceipt}
          onClose={() => setShowDetails(false)}
          onDelete={() => handleDeleteReceipt(selectedReceipt.id)}
          onUpdate={(updatedReceipt: any) => {
            setReceipts(receipts.map(r => r.id === updatedReceipt.id ? updatedReceipt : r))
            setSelectedReceipt(updatedReceipt)
          }}
        />
      )}
    </div>
  )
}

// Receipt Details Modal Component
function ReceiptDetailsModal({ receipt, onClose, onDelete, onUpdate }: {
  receipt: any
  onClose: () => void
  onDelete: () => void
  onUpdate: (receipt: any) => void
}) {
  const { t, language } = useLanguage()
  const { formatBalance } = useCurrency()
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<any[]>([])
  const [transactions, setTransactions] = React.useState<any[]>([])
  const [error, setError] = React.useState<string>('')
  const [editingItem, setEditingItem] = React.useState<any>(null)
  const [editingTransaction, setEditingTransaction] = React.useState<any>(null)
  const [editForm, setEditForm] = React.useState({
    amount: '',
    description: '',
    transaction_date: '',
    type: 'expense' as 'expense' | 'income',
    category_id: ''
  })

  React.useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true)
        // Load receipt items
        const itemsRes = await fetch(`/api/receipts/${receipt.id}/items`)
        const itemsData = await itemsRes.json()
        
        // Load related transactions
        const transactionsRes = await fetch(`/api/receipts/${receipt.id}/transactions`)
        const transactionsData = await transactionsRes.json()
        
        if (itemsRes.ok) setItems(itemsData.items || [])
        if (transactionsRes.ok) setTransactions(transactionsData.transactions || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadDetails()
  }, [receipt.id])

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm(t('receipts.confirmDeleteTransaction'))) return
    
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setTransactions(transactions.filter(t => t.id !== transactionId))
      } else {
        const result = await response.json()
        throw new Error(result.error || 'Erro ao excluir transação')
      }
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction)
    setEditForm({
      amount: String(Math.abs(transaction.amount)),
      description: transaction.description || '',
      transaction_date: transaction.transaction_date.slice(0, 10),
      type: transaction.transaction_type === 'credit' ? 'income' : 'expense',
      category_id: transaction.category_id || ''
    })
  }

  const handleSaveTransaction = async () => {
    if (!editingTransaction) return
    
    try {
      const amount = parseFloat(editForm.amount) || 0
    const response = await fetch(`/api/transactions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
      id: editingTransaction.id,
      amount: Math.abs(amount),
          description: editForm.description,
          transaction_date: editForm.transaction_date,
          type: editForm.type,
          category_id: editForm.category_id || null
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setTransactions(transactions.map(t => {
          if (t.id !== editingTransaction.id) return t
          const nt = result.transaction
          return {
            ...t,
            amount: nt.amount,
            description: nt.description,
            transaction_date: nt.transaction_date,
            transaction_type: nt.transaction_type,
            category_id: nt.category_id,
            categories: nt.category ? { name: nt.category.name } : t.categories
          }
        }))
        setEditingTransaction(null)
      } else {
        const result = await response.json()
        throw new Error(result.error || 'Erro ao atualizar transação')
      }
    } catch (error: any) {
      alert(error.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {receipt.merchant_name || t('receipts.receiptDetails')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onDelete}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              {t('common.delete')}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full mx-auto"></div>
              <p className="text-gray-500 mt-2">{t('common.loading')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Receipt Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">{t('receipts.summary')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{t('receipts.merchant')}</span>
                    <div className="font-medium">{receipt.merchant_name || '—'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('receipts.date')}</span>
                    <div className="font-medium">
                      {receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US') : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('receipts.subtotal')}</span>
                    <div className="font-medium">{formatBalance(receipt.subtotal, 'EUR')}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('receipts.tax')}</span>
                    <div className="font-medium">{formatBalance(receipt.tax, 'EUR')}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">{t('receipts.total')}</span>
                    <div className="font-semibold text-lg">{formatBalance(receipt.total, 'EUR')}</div>
                  </div>
                </div>
              </div>

              {/* Receipt Items */}
              {items.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">{t('receipts.items')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2">{t('receipts.description')}</th>
                          <th className="text-right py-2">{t('receipts.quantity')}</th>
                          <th className="text-right py-2">{t('receipts.unitPrice')}</th>
                          <th className="text-right py-2">{t('receipts.total')}</th>
                          <th className="text-center py-2">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-2">{item.description}</td>
                            <td className="py-2 text-right">{item.quantity || '—'}</td>
                            <td className="py-2 text-right">{formatBalance(item.unit_price, 'EUR')}</td>
                            <td className="py-2 text-right font-medium">{formatBalance(item.total, 'EUR')}</td>
                            <td className="py-2 text-center">
                              <button
                                onClick={() => setEditingItem(item)}
                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                              >
                                {t('common.edit')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Related Transactions */}
              {transactions.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">{t('receipts.relatedTransactions')}</h3>
                  <div className="space-y-2">
                    {transactions.map((transaction) => {
                      const signed = (transaction.transaction_type === 'credit' ? 1 : -1) * Number(transaction.amount || 0)
                      return (
                      <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(transaction.transaction_date).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US')}
                            {transaction.categories?.name && (
                              <span className="ml-2">• {transaction.categories.name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${signed >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatBalance(signed, 'EUR')}
                          </span>
                          <button
                            onClick={() => handleEditTransaction(transaction)}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transaction Edit Modal */}
        {editingTransaction && (
          <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {language === 'pt' ? 'Editar Transação' : 'Edit Transaction'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'pt' ? 'Tipo' : 'Type'}
                  </label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'expense' | 'income' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="expense">{language === 'pt' ? 'Despesa' : 'Expense'}</option>
                    <option value="income">{language === 'pt' ? 'Receita' : 'Income'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'pt' ? 'Valor' : 'Amount'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'pt' ? 'Descrição' : 'Description'}
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'pt' ? 'Data' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={editForm.transaction_date}
                    onChange={(e) => setEditForm({ ...editForm, transaction_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setEditingTransaction(null)}
                  className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  {language === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={handleSaveTransaction}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  {language === 'pt' ? 'Salvar' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}