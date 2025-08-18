'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import ptTranslations from '../locales/pt.json'
import enTranslations from '../locales/en.json'

type Language = 'pt' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const translations = {
  pt: ptTranslations,
  en: enTranslations
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('pt')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load saved language from localStorage
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && (savedLanguage === 'pt' || savedLanguage === 'en')) {
      setLanguage(savedLanguage)
    } else {
      // Auto-detect browser language
      const browserLang = navigator.language.toLowerCase()
      if (browserLang.startsWith('pt')) {
        setLanguage('pt')
      } else {
        setLanguage('en')
      }
    }
    setIsLoading(false)
  }, [])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)
    // Update HTML lang attribute for accessibility
    document.documentElement.lang = lang === 'pt' ? 'pt-PT' : 'en-US'
  }

  const t = (key: string): string => {
    const keys = key.split('.')
    let result: any = translations[language]
    
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k]
      } else {
        // Fallback to English if key not found in current language
        result = translations.en
        for (const fallbackKey of keys) {
          if (result && typeof result === 'object' && fallbackKey in result) {
            result = result[fallbackKey]
          } else {
            console.warn(`Translation key "${key}" not found`)
            return key // Return the key itself as fallback
          }
        }
        break
      }
    }
    
    return typeof result === 'string' ? result : key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
