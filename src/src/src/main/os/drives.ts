import { existsSync } from 'node:fs'
import { statfs } from 'node:fs/promises'
import type { DriveInfo } from '@shared/types'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export async function listDrives(): Promise<DriveInfo[]> {
  const drives: DriveInfo[] = []
  for (const letter of LETTERS) {
    const root = `${letter}:\\`
    if (!existsSync(root)) continue
    let freeBytes = 0
    let totalBytes = 0
    try {
      const s = await statfs(root)
      freeBytes = Number(s.bsize) * Number(s.bfree)
      totalBytes = Number(s.bsize) * Number(s.blocks)
    } catch {
      /* ignore — drive exists but we can't stat it (e.g. CD-ROM without media) */
    }
    drives.push({ letter, label: `${letter}:`, freeBytes, totalBytes })
  }
  return drives
}
