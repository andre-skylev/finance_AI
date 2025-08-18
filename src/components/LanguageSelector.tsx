'use client'

import { useLanguage } from '../contexts/LanguageContext'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex gap-1">
      <Button 
        variant={language === 'pt' ? 'default' : 'outline'} 
        size="sm" 
        onClick={() => setLanguage('pt')}
      >
        PT
      </Button>
      <Button 
        variant={language === 'en' ? 'default' : 'outline'} 
        size="sm" 
        onClick={() => setLanguage('en')}
      >
        EN
      </Button>
    </div>
  )
}
