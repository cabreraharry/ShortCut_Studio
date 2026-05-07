import { describe, expect, it } from 'vitest'
import { isAbsolute } from 'node:path'
import { UnsafePathError, canonicalize } from '../security/safePath'

// canonicalizeFolderPath() is private to folders.ts. Verifying its two
// constituent guards directly is sufficient and avoids exporting an
// otherwise-unused helper just for tests.

describe('canonicalize() — collapses doubled separators (the v0.5 notification bug)', () => {
  it('collapses literal doubled backslashes that historically poisoned Folder.Path', () => {
    const poisoned = 'C:' + '\\\\' + 'Users' + '\\\\' + 'ewi' + '\\\\' + 'Documents'
    expect(canonicalize(poisoned)).toBe('C:\\Users\\ewi\\Documents')
  })

  it('normalises forward-slash input to backslashes on Windows', () => {
    expect(canonicalize('C:/Users/ewi/Documents')).toBe('C:\\Users\\ewi\\Documents')
  })

  it('strips a trailing separator', () => {
    expect(canonicalize('C:\\Users\\')).toBe('C:\\Users')
  })

  it('leaves an already-canonical path unchanged', () => {
    expect(canonicalize('D:\\VeriTex\\arxiv_data')).toBe('D:\\VeriTex\\arxiv_data')
  })
})

describe('canonicalize() — rejects unsafe inputs', () => {
  it('rejects UNC paths (`\\\\server\\share`) — they would bypass assertOnLocalDrive', () => {
    expect(() => canonicalize('\\\\server\\share\\docs')).toThrow(UnsafePathError)
  })

  it('rejects forward-slash UNC (`//server/share`)', () => {
    expect(() => canonicalize('//server/share/docs')).toThrow(UnsafePathError)
  })

  it('rejects empty string', () => {
    expect(() => canonicalize('')).toThrow(UnsafePathError)
  })

  it('rejects strings containing a NUL byte', () => {
    expect(() => canonicalize('C:\\foo\0bar')).toThrow(UnsafePathError)
  })

  it('rejects non-string inputs', () => {
    expect(() => canonicalize(undefined)).toThrow(UnsafePathError)
    expect(() => canonicalize(null)).toThrow(UnsafePathError)
    expect(() => canonicalize(42)).toThrow(UnsafePathError)
  })
})

describe('isAbsolute() — the relative-path guard', () => {
  // canonicalizeFolderPath() in folders.ts uses isAbsolute() before calling
  // canonicalize(). Without this guard a paste like 'Documents\\Papers' would
  // be silently anchored to process.cwd() (the app dir in packaged builds,
  // the repo root in dev), producing a wrong absolute path that may even
  // pass existsSync by accident.
  it('returns false for bare-relative paths', () => {
    expect(isAbsolute('Documents\\Papers')).toBe(false)
    expect(isAbsolute('foo')).toBe(false)
  })

  it('returns false for drive-relative paths', () => {
    // 'C:foo' is drive-C-relative, which path.resolve() would anchor to the
    // per-drive CWD — also wrong.
    expect(isAbsolute('C:foo')).toBe(false)
  })

  it('returns true for proper absolute paths', () => {
    expect(isAbsolute('C:\\Users\\foo')).toBe(true)
    expect(isAbsolute('D:\\VeriTex\\arxiv_data')).toBe(true)
  })
})
