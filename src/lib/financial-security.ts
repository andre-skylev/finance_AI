import crypto from 'crypto'

/**
 * Serviço de Segurança Financeira
 * Responsável por criptografia, mascaramento e proteção de dados sensíveis
 */
export class FinancialSecurityService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 16
  private static readonly TAG_LENGTH = 16

  /**
   * Deriva chave de criptografia única para cada usuário
   */
  static deriveUserKey(userId: string, userSecret?: string): Buffer {
    const salt = process.env.ENCRYPTION_SALT || 'default-salt'
    const secret = userSecret || process.env.DEFAULT_USER_SECRET || userId
    return crypto.pbkdf2Sync(secret, salt + userId, 100000, this.KEY_LENGTH, 'sha256')
  }

  /**
   * Criptografa valor financeiro
   */
  static encryptFinancialValue(value: number | string, userKey: Buffer): string {
    try {
      const iv = crypto.randomBytes(this.IV_LENGTH)
      const cipher = crypto.createCipheriv(this.ALGORITHM, userKey, iv)
      
      let encrypted = cipher.update(value.toString(), 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const authTag = cipher.getAuthTag()
      
      return JSON.stringify({
        encrypted,
        iv: iv.toString('hex'),
        tag: authTag.toString('hex'),
        algorithm: this.ALGORITHM
      })
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt financial data')
    }
  }

  /**
   * Descriptografa valor financeiro
   */
  static decryptFinancialValue(encryptedData: string, userKey: Buffer): number | null {
    try {
      const data = JSON.parse(encryptedData)
      const iv = Buffer.from(data.iv, 'hex')
      const decipher = crypto.createDecipheriv(data.algorithm || this.ALGORITHM, userKey, iv)
      decipher.setAuthTag(Buffer.from(data.tag, 'hex'))
      
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return parseFloat(decrypted)
    } catch (error) {
      console.error('Decryption failed:', error)
      return null
    }
  }

  /**
   * Mascara número de conta bancária
   */
  static maskAccountNumber(accountNumber: string): string {
    if (!accountNumber || accountNumber.length === 0) return ''
    
    if (accountNumber.length <= 4) {
      return '*'.repeat(accountNumber.length)
    }
    
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4)
  }

  /**
   * Mascara número de cartão de crédito
   */
  static maskCardNumber(cardNumber: string): string {
    if (!cardNumber || cardNumber.length === 0) return ''
    
    if (cardNumber.length <= 8) {
      return '*'.repeat(cardNumber.length)
    }
    
    const firstFour = cardNumber.slice(0, 4)
    const lastFour = cardNumber.slice(-4)
    const middle = '*'.repeat(cardNumber.length - 8)
    
    return `${firstFour}${middle}${lastFour}`
  }

  /**
   * Mascara valor monetário
   */
  static maskFinancialValue(value: number, showLastDigits: boolean = false): string {
    const valueStr = value.toFixed(2)
    
    if (showLastDigits) {
      const parts = valueStr.split('.')
      const integerPart = parts[0]
      const decimalPart = parts[1]
      
      if (integerPart.length <= 2) {
        return `**,${decimalPart}`
      } else {
        const maskedInteger = '*'.repeat(integerPart.length - 2) + integerPart.slice(-2)
        return `${maskedInteger},${decimalPart}`
      }
    }
    
    return '***,**'
  }

  /**
   * Gera hash para busca/comparação de valores
   */
  static hashValue(value: string | number): string {
    return crypto.createHash('sha256').update(value.toString()).digest('hex')
  }

  /**
   * Valida se dados são sensíveis
   */
  static isSensitiveData(data: any): boolean {
    const sensitiveFields = [
      'balance', 'amount', 'credit_limit', 'account_number', 
      'card_number', 'salary', 'income', 'expense'
    ]
    
    if (typeof data === 'object') {
      return Object.keys(data).some(key => 
        sensitiveFields.some(field => 
          key.toLowerCase().includes(field.toLowerCase())
        )
      )
    }
    
    return false
  }

  /**
   * Sanitiza dados para logs
   */
  static sanitizeForLogs(data: any): any {
    if (typeof data !== 'object' || data === null) return data
    
    const sanitized = { ...data }
    const sensitiveFields = [
      'balance', 'amount', 'credit_limit', 'account_number', 
      'card_number', 'password', 'key', 'secret'
    ]
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]'
      }
    }
    
    return sanitized
  }

  /**
   * Gera token de sessão seguro
   */
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Valida força de senha para dados financeiros
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean
    score: number
    requirements: string[]
  } {
    const requirements: string[] = []
    let score = 0
    
    if (password.length >= 12) {
      score += 2
    } else if (password.length >= 8) {
      score += 1
    } else {
      requirements.push('Mínimo 8 caracteres')
    }
    
    if (/[A-Z]/.test(password)) score += 1
    else requirements.push('Pelo menos 1 letra maiúscula')
    
    if (/[a-z]/.test(password)) score += 1
    else requirements.push('Pelo menos 1 letra minúscula')
    
    if (/\d/.test(password)) score += 1
    else requirements.push('Pelo menos 1 número')
    
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1
    else requirements.push('Pelo menos 1 caractere especial')
    
    return {
      isValid: score >= 5,
      score,
      requirements
    }
  }

  /**
   * Rate limiting para operações sensíveis
   */
  static checkRateLimit(userId: string, operation: string): boolean {
    // Implementar cache em Redis ou similar em produção
    const key = `rate_limit:${userId}:${operation}`
    const limit = this.getRateLimitForOperation(operation)
    
    // Por enquanto, sempre permitir (implementar cache depois)
    return true
  }

  private static getRateLimitForOperation(operation: string): number {
    const limits: Record<string, number> = {
      'view_balance': 100,
      'transfer': 10,
      'export_data': 5,
      'change_settings': 3
    }
    
    return limits[operation] || 50
  }

  /**
   * Detecta tentativa de acesso suspeito
   */
  static detectSuspiciousActivity(request: {
    userId: string
    ip: string
    userAgent: string
    operation: string
    timestamp: Date
  }): {
    isSuspicious: boolean
    reasons: string[]
  } {
    const reasons: string[] = []
    
    // Verificar horário (acesso fora do horário comercial)
    const hour = request.timestamp.getHours()
    if (hour < 6 || hour > 23) {
      reasons.push('Acesso fora do horário comercial')
    }
    
    // Verificar múltiplas tentativas do mesmo IP
    // TODO: Implementar verificação de histórico
    
    // Verificar user agent suspeito
    if (!request.userAgent || request.userAgent.includes('bot')) {
      reasons.push('User agent suspeito')
    }
    
    return {
      isSuspicious: reasons.length > 0,
      reasons
    }
  }
}

/**
 * Hook para usar segurança financeira no React
 */
export function useFinancialSecurity() {
  const maskValue = (value: number, showPartial: boolean = false) => {
    return FinancialSecurityService.maskFinancialValue(value, showPartial)
  }
  
  const maskAccount = (accountNumber: string) => {
    return FinancialSecurityService.maskAccountNumber(accountNumber)
  }
  
  const maskCard = (cardNumber: string) => {
    return FinancialSecurityService.maskCardNumber(cardNumber)
  }
  
  return {
    maskValue,
    maskAccount,
    maskCard,
    sanitizeForLogs: FinancialSecurityService.sanitizeForLogs,
    isSensitive: FinancialSecurityService.isSensitiveData
  }
}

export default FinancialSecurityService
