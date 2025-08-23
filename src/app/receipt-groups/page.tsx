"use client"

import ProtectedRoute from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import ReceiptGroups from '@/components/ReceiptGroups'
import { useLanguage } from '@/contexts/LanguageContext'

export default function ReceiptGroupsPage() {
  const { t } = useLanguage()

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-6">
          <ReceiptGroups />
        </div>
      </div>
    </ProtectedRoute>
  )
}
