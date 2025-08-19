"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Receipt, 
  PlusCircle, 
  Target, 
  MoreHorizontal,
  ArrowLeftRight,
  CreditCard,
  FileText,
  Settings,
  LogOut,
  Globe
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/components/AuthProvider'
import { useState } from 'react'

export function MobileNavigation() {
  const pathname = usePathname()
  const { t, language, setLanguage } = useLanguage()
  const { signOut } = useAuth()
  const [showMore, setShowMore] = useState(false)

  const mainNavItems = [
    { href: '/dashboard', icon: Home, label: t('navigation.dashboard') },
    { href: '/transactions', icon: ArrowLeftRight, label: t('navigation.transactions') },
    { href: '/add', icon: PlusCircle, label: 'Add', isSpecial: true },
    { href: '/receipts', icon: Receipt, label: t('navigation.receipts') },
    { href: '#more', icon: MoreHorizontal, label: 'More', action: () => setShowMore(!showMore) }
  ]

  const moreItems = [
    { href: '/goals', icon: Target, label: t('navigation.goals') },
    { href: '/credit-cards', icon: CreditCard, label: t('navigation.creditCards') },
    { href: '/import', icon: FileText, label: t('navigation.import') },
    { href: '/pdf-import', icon: FileText, label: t('navigation.import') + ' PDF' },
    { href: '/categories', icon: Receipt, label: t('navigation.categories') },
    { href: '/installments', icon: ArrowLeftRight, label: t('navigation.installments') },
    { href: '/fixed-costs', icon: Receipt, label: t('navigation.fixedCosts') },
    { href: '/settings', icon: Settings, label: t('navigation.settings') }
  ]

  // Don't show on certain pages
  if (pathname?.includes('/login') || pathname?.includes('/register')) {
    return null
  }

  return (
    <>
      {/* iOS-style tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="bg-white/95 backdrop-blur-xl border-t border-gray-200/50">
          <div className="grid grid-cols-5 items-center">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              if (item.action) {
                return (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="flex flex-col items-center justify-center py-2 px-1"
                  >
                    <Icon className={`h-6 w-6 ${showMore ? 'text-blue-600' : 'text-gray-600'}`} />
                    <span className={`text-[10px] mt-1 ${showMore ? 'text-blue-600' : 'text-gray-600'}`}>
                      {item.label}
                    </span>
                  </button>
                )
              }

              if (item.isSpecial) {
                return (
                  <Link
                    key={item.href}
                    href="/transactions/add"
                    className="flex flex-col items-center justify-center py-2 px-1"
                  >
                    <div className="bg-blue-600 rounded-full p-1">
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                  </Link>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center py-2 px-1"
                >
                  <Icon className={`h-6 w-6 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
                  <span className={`text-[10px] mt-1 ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* More menu overlay */}
      {showMore && (
        <div 
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setShowMore(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-14 left-0 right-0 bg-white rounded-t-2xl shadow-xl">
            <div className="p-4">
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <div className="grid grid-cols-4 gap-4">
                {moreItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className="flex flex-col items-center p-3"
                    >
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-2">
                        <Icon className="h-6 w-6 text-gray-700" />
                      </div>
                      <span className="text-xs text-gray-700 text-center">
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
              
              {/* Language and Logout section */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                {/* Language toggle */}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setLanguage('pt')
                      setShowMore(false)
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      language === 'pt' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    PT
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('en')
                      setShowMore(false)
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      language === 'en' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    EN
                  </button>
                </div>
                
                {/* Logout button */}
                <button
                  onClick={() => {
                    setShowMore(false)
                    signOut()
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('navigation.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}