// Secure Balance Display Utilities
// This file provides functions to display financial data securely

export interface SecureAccount {
  id: string
  name: string
  bank_name?: string
  account_type: 'checking' | 'savings' | 'credit' | 'investment'
  balance_range?: string  // Secure range like "€1,000 - €10,000"
  currency: string
  account_masked?: string // Masked account like "ITAU **** **** d4af"
  is_active: boolean
}

/**
 * Displays balance securely based on user preferences and security settings
 */
export function displaySecureBalance(
  account: SecureAccount, 
  hideBalances: boolean = false
): string {
  if (hideBalances) {
    return '••••••'
  }
  
  if (account.balance_range) {
    return account.balance_range
  }
  
  return 'Balance Hidden'
}

/**
 * Displays account number securely
 */
export function displaySecureAccountNumber(account: SecureAccount): string {
  if (account.account_masked) {
    return account.account_masked
  }
  
  return `${account.bank_name || 'Bank'} **** **** ****`
}

/**
 * Gets display class for balance range (for styling)
 */
export function getBalanceRangeClass(balanceRange?: string): string {
  if (!balanceRange) return 'text-gray-500'
  
  if (balanceRange.includes('Under')) return 'text-red-500'
  if (balanceRange.includes('Over €50,000')) return 'text-green-600'
  if (balanceRange.includes('€10,000')) return 'text-green-500'
  if (balanceRange.includes('€1,000')) return 'text-yellow-500'
  
  return 'text-gray-700'
}

/**
 * Provides security status information
 */
export function getSecurityStatus(account: SecureAccount): {
  isSecure: boolean
  message: string
  icon: '🔒' | '⚠️' | '🔓'
} {
  if (account.account_masked && account.balance_range) {
    return {
      isSecure: true,
      message: 'Account secured with data masking',
      icon: '🔒'
    }
  }
  
  if (account.account_masked) {
    return {
      isSecure: true,
      message: 'Account number masked',
      icon: '🔒'
    }
  }
  
  return {
    isSecure: false,
    message: 'Account data not fully secured',
    icon: '⚠️'
  }
}
