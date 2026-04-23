import { useCallback, useMemo, useState } from 'react'

export interface RowSelection<Id> {
  selectedIds: Set<Id>
  selectedCount: number
  isSelected: (id: Id) => boolean
  toggle: (id: Id) => void
  toggleAll: (ids: Id[]) => void
  clear: () => void
}

export function useRowSelection<Id extends string | number>(): RowSelection<Id> {
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set())

  const isSelected = useCallback((id: Id) => selectedIds.has(id), [selectedIds])

  const toggle = useCallback((id: Id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids: Id[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id)) && prev.size === ids.length
      return allSelected ? new Set() : new Set(ids)
    })
  }, [])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  return useMemo(
    () => ({ selectedIds, selectedCount: selectedIds.size, isSelected, toggle, toggleAll, clear }),
    [selectedIds, isSelected, toggle, toggleAll, clear]
  )
}
