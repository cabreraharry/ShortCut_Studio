import { readdir, type Dirent } from 'node:fs'
import { readdir as readdirAsync } from 'node:fs/promises'
import { join } from 'node:path'
import type { FsEntry } from '@shared/types'

function readdirTyped(path: string): Promise<Dirent[]> {
  return new Promise((resolve) => {
    readdir(path, { withFileTypes: true, encoding: 'utf8' }, (err, files) => {
      if (err) resolve([])
      else resolve(files as Dirent[])
    })
  })
}

export async function listChildren(path: string): Promise<FsEntry[]> {
  const entries = await readdirTyped(path)
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('$'))

  const out: FsEntry[] = []
  for (const d of dirs) {
    const full = join(path, d.name)
    let fileCount: number | undefined
    try {
      const kids = await readdirAsync(full)
      fileCount = kids.length
    } catch {
      fileCount = undefined
    }
    out.push({ name: d.name, path: full, isDir: true, fileCount })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}
