import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { DevSqlResult } from '@shared/types'

const DEFAULT_SQL = 'SELECT * FROM LLM_Provider LIMIT 10'

const QUICK_QUERIES: Array<{ label: string; sql: string }> = [
  { label: 'Providers', sql: 'SELECT * FROM LLM_Provider' },
  { label: 'Folders', sql: 'SELECT * FROM Folder ORDER BY Path' },
  {
    label: 'Tables',
    sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  },
  { label: 'Settings', sql: 'SELECT * FROM AdminData' }
]

export function SqlConsoleTab(): JSX.Element {
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [result, setResult] = useState<DevSqlResult | null>(null)
  const [running, setRunning] = useState(false)

  async function run(): Promise<void> {
    setRunning(true)
    try {
      const r = await api.dev.sqlSelect(sql)
      setResult(r)
    } finally {
      setRunning(false)
    }
  }

  function copyCsv(): void {
    if (!result || !result.ok) return
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return ''
      const s = typeof v === 'string' ? v : JSON.stringify(v)
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = result.columns.map(escape).join(',')
    const body = result.rows.map((row) => row.map(escape).join(',')).join('\n')
    void navigator.clipboard.writeText(`${header}\n${body}`)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {QUICK_QUERIES.map((q) => (
          <Button
            key={q.label}
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => setSql(q.sql)}
          >
            {q.label}
          </Button>
        ))}
      </div>

      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            void run()
          }
        }}
        placeholder="SELECT … FROM …"
        spellCheck={false}
        className="h-24 w-full resize-none rounded-md border border-border/60 bg-muted/30 p-2 font-mono text-xs outline-none focus:border-primary"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={run} disabled={running || !sql.trim()}>
          {running ? 'Running…' : 'Run (Ctrl+Enter)'}
        </Button>
        {result?.ok && result.rows.length > 0 && (
          <Button size="sm" variant="outline" onClick={copyCsv}>
            Copy CSV
          </Button>
        )}
        {result && (
          <span className="text-[10px] text-muted-foreground">
            {result.durationMs} ms · {result.rowCount} row{result.rowCount === 1 ? '' : 's'}
            {result.truncated && ` · showing first 500`}
          </span>
        )}
      </div>

      {result && !result.ok && result.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {result.error}
        </div>
      )}

      {result?.ok && result.columns.length > 0 && <ResultTable result={result} />}

      <div className="text-[10px] text-muted-foreground">
        Read-only: SELECT / WITH / PRAGMA / EXPLAIN only. Max 500 rows.
      </div>
    </div>
  )
}

function ResultTable({ result }: { result: DevSqlResult }): JSX.Element {
  return (
    <div className="overflow-auto rounded-md border border-border/60 max-h-80">
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {result.columns.map((c) => (
              <th
                key={c}
                className="whitespace-nowrap border-b border-border/60 px-2 py-1 text-left font-mono font-semibold"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="odd:bg-muted/20">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="max-w-[200px] truncate border-b border-border/40 px-2 py-1 font-mono"
                  title={cellTitle(cell)}
                >
                  {cellText(cell)}
                </td>
              ))}
            </tr>
          ))}
          {result.rows.length === 0 && (
            <tr>
              <td
                colSpan={result.columns.length}
                className="px-2 py-3 text-center text-muted-foreground"
              >
                (0 rows)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function cellText(v: unknown): string {
  if (v === null) return 'NULL'
  if (v === undefined) return '—'
  if (v instanceof Uint8Array) return `<blob ${v.byteLength} B>`
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

function cellTitle(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
