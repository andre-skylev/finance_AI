"use client"

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '../../contexts/LanguageContext'
import { useCategories } from '@/hooks/useFinanceData'
import { User, Settings, LogOut, Lock } from 'lucide-react'
import { translateCategoryName } from '@/lib/categories'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { t, language, setLanguage } = useLanguage()
  const { categories, createCategory, refetch: refetchCategories } = useCategories()
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'expense' | 'income',
    color: '#6b7280',
    icon: ''
  })

  const [userPreferences, setUserPreferences] = useState({
    defaultCurrency: 'EUR',
    notifications: true,
  })

  useEffect(() => {
    loadUserPreferences()
  }, [])

  const loadUserPreferences = () => {
    // In a real app, these would be loaded from a database or local storage
    const saved = localStorage.getItem('userPreferences')
    if (saved) {
      setUserPreferences(JSON.parse(saved))
    }
  }

  const saveUserPreferences = (newPreferences: typeof userPreferences) => {
    setUserPreferences(newPreferences)
    localStorage.setItem('userPreferences', JSON.stringify(newPreferences))
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('settings.title')}</h1>
          <p className="text-gray-600">{t('settings.subtitle')}</p>
        </div>

        {/* User Profile Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 bg-gray-100 rounded-full">
              <User className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('settings.profile')}</h2>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>
          
          <div className="border-t pt-6">
            <button
              onClick={signOut}
              className="inline-flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('settings.logout')}
            </button>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3 mb-6">
            <Settings className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">{t('settings.preferences')}</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.defaultCurrency')}
              </label>
              <select
                value={userPreferences.defaultCurrency}
                onChange={(e) => saveUserPreferences({
                  ...userPreferences,
                  defaultCurrency: e.target.value
                })}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              >
                <option value="EUR">Euro (EUR)</option>
                <option value="BRL">Real Brasileiro (BRL)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.language')}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'pt' | 'en')}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              >
                <option value="pt">{t('settings.portuguese')}</option>
                <option value="en">{t('settings.english')}</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('settings.notifications')}
                </label>
                <p className="text-sm text-gray-500">
                  {t('settings.notificationsDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={userPreferences.notifications}
                  onChange={(e) => saveUserPreferences({
                    ...userPreferences,
                    notifications: e.target.checked
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

  {/* Categories Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">🏷️</span>
      <h2 className="text-xl font-semibold text-gray-900">{t('categoriesPage.title')}</h2>
            </div>
          </div>

          {/* Existing categories (default + custom) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {categories.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-sm">{translateCategoryName(c.name, !!c.is_default, t)}</span>
                  {c.is_default && (
                    <span className="ml-1 text-[10px] uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t('categoriesPage.default')}</span>
                  )}
                </div>
                <span className="text-xs uppercase text-gray-500">{c.type === 'expense' ? t('categoriesPage.expense') : t('categoriesPage.income')}</span>
              </div>
            ))}
          </div>

          {/* Add new category */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium mb-4">{t('categoriesPage.add')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">{t('categoriesPage.name')}</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  placeholder={language === 'pt' ? 'Ex: Alimentação' : 'E.g.: Food'}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('categoriesPage.type')}</label>
                <select
                  value={newCategory.type}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                >
                  <option value="expense">{t('categoriesPage.expense')}</option>
                  <option value="income">{t('categoriesPage.income')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('categoriesPage.color')}</label>
                <input
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
                />
              </div>
      {/* Icon input removed per request */}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={async () => {
                  if (!newCategory.name.trim()) return
                  await createCategory({
                    name: newCategory.name.trim(),
                    type: newCategory.type,
                    color: newCategory.color,
        // icon intentionally omitted
                  })
                  setNewCategory({ name: '', type: 'expense', color: '#6b7280', icon: '' })
                  await refetchCategories()
                }}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
              >
                {t('categoriesPage.addButton')}
              </button>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3 mb-6">
            <Lock className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">{t('settings.security')}</h2>
          </div>

          <div className="space-y-4">
            <button className="w-full sm:w-auto inline-flex items-center px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Lock className="h-4 w-4 mr-2" />
              {t('settings.changePassword')}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
