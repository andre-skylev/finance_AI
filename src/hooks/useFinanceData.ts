import { useState, useEffect } from 'react'

interface Account {
  id: string
  name: string
  bank_name?: string
  account_type: 'checking' | 'savings' | 'credit' | 'investment'
  balance_range?: string  // SECURE: Balance shown as range for API security context
  balance: number         // ACTUAL: Real balance for authenticated user display
  currency: string
  is_active: boolean
  account_masked?: string // SECURE: Masked account number
  account_number_hash?: string // SECURE: Hashed account identifier
  last_update?: string
}

interface Transaction {
  id: string
  amount: number
  currency: string
  description: string
  transaction_date: string
  type: 'income' | 'expense' | 'transfer'
  category?: {
    name: string
    color: string
    icon?: string
  }
  account?: {
    name: string
    bank_name?: string
  }
}

interface Category {
  id: string
  name: string
  icon?: string
  color: string
  type: 'income' | 'expense'
  is_default: boolean
  parent_id?: string | null
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/accounts')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch accounts')
      }
      
      setAccounts(data.accounts)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createAccount = async (accountData: Omit<Account, 'id' | 'is_active' | 'balance_range' | 'account_masked'>) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData)
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account')
      }
      
      await fetchAccounts() // Refresh list
      return data.account
    } catch (err) {
      throw err
    }
  }

  const updateAccount = async (id: string, accountData: Partial<Account>) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...accountData })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update account')
      }
      
      await fetchAccounts() // Refresh list
      return data.account
    } catch (err) {
      throw err
    }
  }

  const deleteAccount = async (id: string, hardDelete = true) => {
    try {
      const response = await fetch(`/api/accounts?id=${id}${hardDelete ? '&hard=true' : ''}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }
      
      await fetchAccounts() // Refresh list
    } catch (err) {
      throw err
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount
  }
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = async (filters?: {
    limit?: number
    offset?: number
    account_id?: string
    category_id?: string
    type?: 'income' | 'expense' | 'transfer'
  }) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (filters?.limit) params.append('limit', filters.limit.toString())
      if (filters?.offset) params.append('offset', filters.offset.toString())
      if (filters?.account_id) params.append('account_id', filters.account_id)
      if (filters?.category_id) params.append('category_id', filters.category_id)
      if (filters?.type) params.append('type', filters.type)
      
      const response = await fetch(`/api/transactions?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions')
      }
      
      setTransactions(data.transactions)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createTransaction = async (transactionData: Omit<Transaction, 'id' | 'category' | 'account'> & {
    account_id: string
    category_id?: string
  }) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create transaction')
      }
      
      await fetchTransactions() // Refresh list
      return data.transaction
    } catch (err) {
      throw err
    }
  }

  const updateTransaction = async (id: string, transactionData: Partial<Transaction> & {
    account_id?: string
    category_id?: string
  }) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...transactionData })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update transaction')
      }
      
      await fetchTransactions() // Refresh list
      return data.transaction
    } catch (err) {
      throw err
    }
  }

  const deleteTransaction = async (id: string) => {
    try {
      const response = await fetch(`/api/transactions?id=${id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete transaction')
      }
      
      await fetchTransactions() // Refresh list
    } catch (err) {
      throw err
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction
  }
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/categories')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch categories')
      }
      
      setCategories(data.categories)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createCategory = async (categoryData: Omit<Category, 'id' | 'is_default'>) => {
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create category')
      }
      
      await fetchCategories() // Refresh list
      return data.category
    } catch (err) {
      throw err
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory
  }
}

export function useDashboard() {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<Record<string, string | null>>({})

  const fetchDashboardData = async (type: string) => {
    try {
      setLoading(prev => ({ ...prev, [type]: true }))
      const response = await fetch(`/api/dashboard?type=${type}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || `Failed to fetch ${type}`)
      }
      
      setData((prev: any) => ({ ...prev, [type]: result }))
      setError(prev => ({ ...prev, [type]: null }))
    } catch (err) {
      setError(prev => ({ 
        ...prev, 
        [type]: err instanceof Error ? err.message : 'An error occurred' 
      }))
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }))
    }
  }

  return {
    data,
    loading,
    error,
    fetchDashboardData
  }
}
