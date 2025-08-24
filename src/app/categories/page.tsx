"use client"

import ProtectedRoute from '@/components/ProtectedRoute'
import { useCategories } from '@/hooks/useFinanceData'
import { useMemo, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { Trash2 } from 'lucide-react'
import { translateCategoryName } from '@/lib/categories'

export default function CategoriesPage() {
  const { t } = useLanguage()
  const { categories, createCategory, refetch } = useCategories()
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'expense' | 'income',
    color: '#6b7280',
    icon: '',
    parent_id: '' as string | ''
  })
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Build parent -> children map
  const { parents, childrenByParent } = useMemo(() => {
    const parents = categories.filter((c: any) => !c.parent_id)
    const childrenByParent: Record<string, any[]> = {}
    for (const c of categories) {
      if (c.parent_id) {
        if (!childrenByParent[c.parent_id]) childrenByParent[c.parent_id] = []
        childrenByParent[c.parent_id].push(c)
      }
    }
    // Sort parents and children by translated name for stable UI
    const sortByName = (a: any, b: any) => translateCategoryName(a.name, !!a.is_default, t).localeCompare(translateCategoryName(b.name, !!b.is_default, t))
    parents.sort(sortByName)
    Object.values(childrenByParent).forEach(arr => arr.sort(sortByName))
    return { parents, childrenByParent }
  }, [categories, t])

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const deleteCategory = async (id: string) => {
    if (!confirm(t('categoriesPage.deleteConfirm'))) return
    setBusy(true)
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Delete failed')
      }
      await refetch()
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t('categoriesPage.title')}</h1>
          <p className="text-muted-foreground">{t('categoriesPage.subtitle')}</p>
        </div>

        {/* Hierarchical List */}
        <div className="bg-white p-6 rounded-lg shadow space-y-2">
          {parents.map((p: any) => (
            <div key={p.id} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggle(p.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-medium">{translateCategoryName(p.name, !!p.is_default, t)}</span>
                  {p.is_default && (
                    <span className="ml-1 text-[10px] uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t('categoriesPage.default')}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase text-gray-500">
                    {p.type === 'expense' ? t('categoriesPage.expense') : t('categoriesPage.income')}
                  </span>
                  <span className="text-xs text-gray-400">{(childrenByParent[p.id] || []).length}</span>
                </div>
              </button>

              {expanded[p.id] && (
                <div className="px-4 pb-3">
                  {(childrenByParent[p.id] || []).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-2 pl-6 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-sm">{translateCategoryName(c.name, !!c.is_default, t)}</span>
                        {c.is_default && (
                          <span className="ml-1 text-[10px] uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t('categoriesPage.default')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase text-gray-500">
                          {c.type === 'expense' ? t('categoriesPage.expense') : t('categoriesPage.income')}
                        </span>
                        {!c.is_default && (
                          <button
                            onClick={() => deleteCategory(c.id)}
                            disabled={busy}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title={t('categoriesPage.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">{t('categoriesPage.add')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">{t('categoriesPage.name')}</label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                placeholder="Ex: Alimentação"
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
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">{t('categoriesPage.parent')}</label>
              <select
                value={newCategory.parent_id}
                onChange={(e) => setNewCategory(prev => ({ ...prev, parent_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              >
                <option value="">{t('categoriesPage.noParent')}</option>
                {parents
                  .filter((p: any) => p.type === newCategory.type)
                  .map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {translateCategoryName(p.name, !!p.is_default, t)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">{t('categoriesPage.parentHelp')}</p>
            </div>
            {/* Icon input removed per request */}
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={async () => {
                if (!newCategory.name.trim()) return
                setBusy(true)
                try {
                  await createCategory({
                    name: newCategory.name.trim(),
                    type: newCategory.type,
                    color: newCategory.color,
                    parent_id: newCategory.parent_id || undefined,
                    // icon intentionally omitted
                  })
                  setNewCategory({ name: '', type: 'expense', color: '#6b7280', icon: '', parent_id: '' })
                  await refetch()
                } finally {
                  setBusy(false)
                }
              }}
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              disabled={busy}
            >
              {t('categoriesPage.addButton')}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
