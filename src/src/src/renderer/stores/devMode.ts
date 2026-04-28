import { create } from 'zustand'

export type DevTab =
  | 'devtools'
  | 'workers'
  | 'sql'
  | 'ipc'
  | 'storybook'
  | 'system'
  | 'llm-playground'

export interface IpcEvent {
  id: number
  ts: number
  channel: string
  label: string
  args: string[]
  durationMs: number
  resultSize: number
  error?: string
}

const MAX_EVENTS = 500

interface DevModeState {
  isOpen: boolean
  activeTab: DevTab
  paused: boolean
  events: IpcEvent[]
  _nextId: number
  openOverlay: () => void
  closeOverlay: () => void
  toggleOverlay: () => void
  setActiveTab: (tab: DevTab) => void
  setPaused: (paused: boolean) => void
  pushEvent: (event: Omit<IpcEvent, 'id' | 'ts'>) => void
  clearEvents: () => void
}

export const useDevModeStore = create<DevModeState>((set, get) => ({
  isOpen: false,
  activeTab: 'devtools',
  paused: false,
  events: [],
  _nextId: 1,
  openOverlay: () => set({ isOpen: true }),
  closeOverlay: () => set({ isOpen: false }),
  toggleOverlay: () => set((s) => ({ isOpen: !s.isOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPaused: (paused) => set({ paused }),
  pushEvent: (partial) => {
    const { paused, events, _nextId } = get()
    if (paused) return
    const next: IpcEvent = { ...partial, id: _nextId, ts: Date.now() }
    const sliced = events.length >= MAX_EVENTS ? events.slice(-(MAX_EVENTS - 1)) : events
    set({ events: [...sliced, next], _nextId: _nextId + 1 })
  },
  clearEvents: () => set({ events: [] })
}))
