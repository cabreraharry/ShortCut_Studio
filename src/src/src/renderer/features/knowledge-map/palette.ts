// Palette for Knowledge Map — kept in sync with TopicsPage's CHIP_PALETTE so a
// super-category renders in the same color on both pages.
export interface PaletteEntry {
  stroke: string
  fill: string
  dot: string
  bg: string
}

export const KM_PALETTE: PaletteEntry[] = [
  { stroke: 'rgb(99, 102, 241)', fill: 'rgb(99, 102, 241)', dot: 'rgb(99, 102, 241)', bg: 'rgba(99, 102, 241, 0.18)' },
  { stroke: 'rgb(16, 185, 129)', fill: 'rgb(16, 185, 129)', dot: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.18)' },
  { stroke: 'rgb(244, 114, 182)', fill: 'rgb(244, 114, 182)', dot: 'rgb(244, 114, 182)', bg: 'rgba(244, 114, 182, 0.18)' },
  { stroke: 'rgb(251, 146, 60)', fill: 'rgb(251, 146, 60)', dot: 'rgb(251, 146, 60)', bg: 'rgba(251, 146, 60, 0.18)' },
  { stroke: 'rgb(14, 165, 233)', fill: 'rgb(14, 165, 233)', dot: 'rgb(14, 165, 233)', bg: 'rgba(14, 165, 233, 0.18)' },
  { stroke: 'rgb(168, 85, 247)', fill: 'rgb(168, 85, 247)', dot: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.18)' },
  { stroke: 'rgb(234, 179, 8)', fill: 'rgb(234, 179, 8)', dot: 'rgb(234, 179, 8)', bg: 'rgba(234, 179, 8, 0.18)' }
]

const UNASSIGNED: PaletteEntry = {
  stroke: 'rgb(148, 163, 184)',
  fill: 'rgb(148, 163, 184)',
  dot: 'rgb(148, 163, 184)',
  bg: 'rgba(148, 163, 184, 0.12)'
}

export function paletteFor(superCategoryId: number | undefined | null): PaletteEntry {
  if (superCategoryId === null || superCategoryId === undefined) return UNASSIGNED
  return KM_PALETTE[superCategoryId % KM_PALETTE.length]
}
