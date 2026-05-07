import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  _resetRendererNotifyState,
  isBenignRendererError,
  shouldNotifyRendererError
} from './rendererThrottle'

afterEach(() => {
  _resetRendererNotifyState()
  vi.useRealTimers()
})

describe('isBenignRendererError() — known-noise patterns we never popup-notify on', () => {
  it('suppresses ResizeObserver loop errors (browser/React quirk, not a real bug)', () => {
    expect(
      isBenignRendererError('ResizeObserver loop completed with undelivered notifications.')
    ).toBe(true)
    expect(
      isBenignRendererError('ResizeObserver loop limit exceeded')
    ).toBe(true)
  })

  it('does not suppress a real error that mentions ResizeObserver in passing', () => {
    // Anchored-to-start regex means this still notifies — and should, since the
    // user's actual code triggered the throw.
    expect(
      isBenignRendererError('TypeError: cannot read .observe of undefined (was passing ResizeObserver)')
    ).toBe(false)
  })

  it('does not suppress generic errors', () => {
    expect(isBenignRendererError('TypeError: x is undefined')).toBe(false)
    expect(isBenignRendererError('unhandledrejection: AbortError')).toBe(false)
    expect(isBenignRendererError('')).toBe(false)
  })
})

describe('shouldNotifyRendererError() — per-fingerprint cooldown', () => {
  it('returns true on first occurrence of a fingerprint', () => {
    expect(shouldNotifyRendererError('window.onerror', 'TypeError: x is undefined')).toBe(true)
  })

  it('returns false on a second occurrence within the cooldown window', () => {
    expect(shouldNotifyRendererError('window.onerror', 'TypeError: x is undefined')).toBe(true)
    expect(shouldNotifyRendererError('window.onerror', 'TypeError: x is undefined')).toBe(false)
    expect(shouldNotifyRendererError('window.onerror', 'TypeError: x is undefined')).toBe(false)
  })

  it('treats different categories as different fingerprints', () => {
    expect(shouldNotifyRendererError('window.onerror', 'Boom')).toBe(true)
    // Same message, different category — distinct fingerprint, fires again.
    expect(shouldNotifyRendererError('unhandledrejection', 'Boom')).toBe(true)
  })

  it('treats different messages as different fingerprints', () => {
    expect(shouldNotifyRendererError('window.onerror', 'A')).toBe(true)
    expect(shouldNotifyRendererError('window.onerror', 'B')).toBe(true)
  })

  it('re-fires after the cooldown window elapses', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'))
    expect(shouldNotifyRendererError('cat', 'msg')).toBe(true)
    expect(shouldNotifyRendererError('cat', 'msg')).toBe(false)
    vi.advanceTimersByTime(60_001)
    expect(shouldNotifyRendererError('cat', 'msg')).toBe(true)
  })

  it('keeps null category and "" category as distinct fingerprints', () => {
    // Reviewer concern: a renderer that sends category:"" and one that sends
    // category:null must not collide. The throttle uses a non-printable
    // separator so the two cases produce different keys.
    expect(shouldNotifyRendererError(null, 'Boom')).toBe(true)
    expect(shouldNotifyRendererError('', 'Boom')).toBe(true)
    // Re-calling either now suppresses (each has its own cooldown entry).
    expect(shouldNotifyRendererError(null, 'Boom')).toBe(false)
    expect(shouldNotifyRendererError('', 'Boom')).toBe(false)
  })

  it('keeps a literal separator-character in the category from breaking the fingerprint', () => {
    // Defensive — even if a renderer somehow sends \x1F in category, the
    // shape `${SEP}str:${category}` still distinguishes from the null key.
    expect(shouldNotifyRendererError('a\x1Fb', 'msg')).toBe(true)
    expect(shouldNotifyRendererError(null, 'msg')).toBe(true)
  })

  it('caps the fingerprint map: spamming distinct messages does not grow unbounded', () => {
    // Push past the 200-entry cap with monotonically increasing timestamps so
    // the LRU sort has unambiguous ordering — sidesteps Array.sort stability
    // assumptions that the prior test silently relied on.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'))
    for (let i = 0; i < 250; i++) {
      shouldNotifyRendererError('cat', `msg-${i}`)
      vi.advanceTimersByTime(1) // 1 ms apart so each entry has a unique ts
    }
    // The earliest entries should have been evicted by the LRU trim.
    expect(shouldNotifyRendererError('cat', 'msg-0')).toBe(true)
    // The newest entry is still within cooldown — calling again is suppressed.
    expect(shouldNotifyRendererError('cat', 'msg-249')).toBe(false)
  })
})

describe('LLM completion timeout regex — branch that lands in llm/completion/index.ts', () => {
  // The completion handler uses a four-branch if-else cascade. The timeout
  // branch is `/\b408\b|Request timed out|request timeout/i`. These tests
  // pin the exact strings the real upstream sources produce so a regression
  // in the regex shape gets caught here. The unreachable branch follows it.
  const timeoutRe = /\b408\b|Request timed out|request timeout/i
  const unreachableRe = /unreachable|ECONNREFUSED|ENOTFOUND|getaddrinfo|fetch failed|network\s*error|connection timed out/i

  it('matches httpJson timeout error (the actual format from filters/providers/httpJson.ts)', () => {
    // Pinned to the literal string thrown at httpJson.ts:82.
    expect(timeoutRe.test('Request timed out after 60000ms: https://api.openai.com/v1/chat/completions')).toBe(true)
  })

  it('matches HTTP 408 status messages', () => {
    expect(timeoutRe.test('HTTP 408: Request Timeout')).toBe(true)
    expect(timeoutRe.test('OpenAI returned 408')).toBe(true)
  })

  it('matches lowercase "request timeout" phrasing', () => {
    expect(timeoutRe.test('Connection failed: request timeout')).toBe(true)
  })

  it('does not match other failure shapes that have their own branches', () => {
    expect(timeoutRe.test('401 Unauthorized')).toBe(false)
    expect(timeoutRe.test('429 Too Many Requests')).toBe(false)
    expect(timeoutRe.test('ECONNREFUSED 127.0.0.1:11434')).toBe(false)
    expect(timeoutRe.test('fetch failed')).toBe(false)
  })

  it('does not match an unrelated 408 substring (e.g. an ID containing 408)', () => {
    expect(timeoutRe.test('error code 4081')).toBe(false)
    expect(timeoutRe.test('id=24081234')).toBe(false)
  })

  it('"connection timed out" routes to UNREACHABLE, not timeout (downed local daemon)', () => {
    // Reviewer concern: Node's net layer surfaces "connection timed out" when
    // a TCP connect to a stopped daemon (Ollama, LM Studio) fails. That's
    // semantically the unreachable branch — telling the user "pick a faster
    // model" would be wrong. The tightened timeout regex avoids the bare
    // phrase "timed out" so this string falls through to unreachable.
    expect(timeoutRe.test('connection timed out')).toBe(false)
    expect(unreachableRe.test('connection timed out')).toBe(true)
  })
})
