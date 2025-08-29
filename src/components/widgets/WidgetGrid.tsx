"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, X } from 'lucide-react'

export type WidgetSize = 'small' | 'medium' | 'large'
export type WidgetDef = {
  id: string
  title: string
  size: WidgetSize
  component: React.FC
}

const sizeClasses: Record<WidgetSize, string> = {
  small: 'col-span-12 md:col-span-6 lg:col-span-4',
  medium: 'col-span-12 lg:col-span-6',
  large: 'col-span-12'
}

function SortableItem({ id, children, editing, onRemove, size, onSizeChange, title }: { id: string; children: React.ReactNode; editing: boolean; onRemove?: () => void; size: WidgetSize; onSizeChange?: (s: WidgetSize) => void; title?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const sizeTextClass = size === 'small' ? 'text-xs sm:text-[13px]' : size === 'medium' ? 'text-[13px] sm:text-sm' : 'text-sm'
  return (
    <div ref={setNodeRef} style={style} className={`${sizeClasses[size]} relative`}>
      {editing && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
          <button aria-label="drag" {...attributes} {...listeners} className="p-1 rounded bg-white/90 border shadow hover:bg-white">
            <GripVertical className="h-4 w-4" />
          </button>
          {onSizeChange && (
            <div className="flex items-center gap-1 bg-white/90 border rounded shadow px-1 py-0.5">
              {(['small','medium','large'] as WidgetSize[]).map(s => (
                <button key={s} onClick={() => onSizeChange(s)} className={`text-[10px] leading-3 px-1.5 py-0.5 rounded ${size===s? 'bg-gray-900 text-white':'hover:bg-gray-100'}`}>{s[0].toUpperCase()}</button>
              ))}
            </div>
          )}
          {onRemove && (
            <button aria-label="remove" onClick={onRemove} className="p-1 rounded bg-white/90 border shadow hover:bg-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <div className={`widget ${sizeTextClass}`} data-size={size}>
        <div className="widget-body min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}

type Props = {
  available: WidgetDef[]
  storageKey?: string
  defaultLayout?: { id: string; size?: WidgetSize }[]
}

export function WidgetGrid({ available, storageKey = 'dashboard.layout.v1', defaultLayout }: Props) {
  const sensors = useSensors(useSensor(PointerSensor))
  const availableMap = useMemo(() => new Map(available.map(w => [w.id, w])), [available])

  type Item = { id: string; size: WidgetSize }
  const [editing, setEditing] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const dirtyRef = useRef(false)
  const [saving, setSaving] = useState(false)

  // Initial: local fallback, then try remote (Supabase) and override if not dirty
  useEffect(() => {
    // 1) fast local
    const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Item[]
        setItems(parsed.filter(i => availableMap.has(i.id)))
      } catch {}
    }
    if (!raw) {
      const base = (defaultLayout || available.map(w => ({ id: w.id, size: w.size })) ).filter(i => availableMap.has(i.id))
      const fallback: Item[] = base.map(i => ({ id: i.id, size: (i.size ?? (availableMap.get(i.id)?.size as WidgetSize) ?? 'medium') }))
      setItems(fallback)
    }

    // 2) remote load
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/dashboard-layout', { cache: 'no-store' })
        if (!res.ok) return
        const j = await res.json()
        const layout = Array.isArray(j?.layout) ? j.layout as Item[] : null
        if (!layout) return
        const filtered = layout.filter(i => i && i.id && availableMap.has(i.id)).map((i: any) => ({ id: i.id, size: (i.size || (availableMap.get(i.id)?.size as WidgetSize) || 'medium') as WidgetSize }))
        if (!cancelled && !dirtyRef.current && filtered.length) {
          setItems(filtered)
        }
      } catch {}
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, availableMap])

  // Persist
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(storageKey, JSON.stringify(items))
  }, [items, storageKey])

  const onDragEnd = (event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
  dirtyRef.current = true
  setItems(arrayMove(items, oldIndex, newIndex))
  }

  const addable = available.filter(w => !items.some(i => i.id === w.id))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {editing ? 'Modo de edição' : 'Widgets'}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs px-2 py-1 border rounded disabled:opacity-50"
            disabled={saving}
            onClick={async () => {
              if (editing) {
                // Save remotely when finishing edit
                try {
                  setSaving(true)
                  await fetch('/api/dashboard-layout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ layout: items })
                  })
                } catch {}
                finally {
                  setSaving(false)
                  dirtyRef.current = false
                }
              }
              setEditing(e => !e)
            }}
          >
            {editing ? (saving ? 'Salvando…' : 'Concluir') : 'Organizar'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border p-3 bg-white">
          <div className="text-xs font-medium mb-2">Adicionar widgets</div>
          {addable.length === 0 ? (
            <div className="text-xs text-muted-foreground">Todos adicionados</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {addable.map(w => (
                <button key={w.id} onClick={() => { dirtyRef.current = true; setItems([...items, { id: w.id, size: w.size }]) }} className="inline-flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50">
                  <Plus className="h-3 w-3" /> {w.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-12 gap-4 md:gap-6">
            {items.map(({ id, size }) => {
              const def = availableMap.get(id)!
              const Comp = def.component
              return (
                <SortableItem
                  key={id}
                  id={id}
                  editing={editing}
                  size={size}
                  onSizeChange={editing ? (s) => { dirtyRef.current = true; setItems(items.map(it => it.id === id ? { ...it, size: s } : it)) } : undefined}
                  onRemove={editing ? () => { dirtyRef.current = true; setItems(items.filter(i => i.id !== id)) } : undefined}
                >
                  <Comp />
                </SortableItem>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default WidgetGrid
