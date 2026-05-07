import { describe, expect, it } from 'vitest'
import {
  PLACEHOLDER_PEER_ID_MARKER,
  SCS_POLARIS_BOOTSTRAP_DOMAIN,
  SCS_POLARIS_BOOTSTRAP_MULTIADDRS,
  SCS_POLARIS_FLEET_SIZE,
  buildKuboBootstrapList,
  hasPlaceholderPeerIds
} from './ipfs-bootstrap'

describe('SCS-Polaris bootstrap fleet contract', () => {
  it('domain points at the canonical SCS hostname', () => {
    // Hostname is referenced by docs and the SCS-Polaris docs/onboarding
    // doc. If this changes, also update the TXT-record provisioning step
    // in docs/ipfs_bootstrap_new_peer_onboarding.md.
    expect(SCS_POLARIS_BOOTSTRAP_DOMAIN).toBe('bootstrap.execengine.com')
  })

  it('exposes exactly SCS_POLARIS_FLEET_SIZE multiaddrs', () => {
    // One entry per fleet node. Mismatches usually mean someone added
    // an entry without bumping the size constant or vice versa.
    expect(SCS_POLARIS_BOOTSTRAP_MULTIADDRS.length).toBe(SCS_POLARIS_FLEET_SIZE)
    expect(SCS_POLARIS_FLEET_SIZE).toBe(10)
  })
})

describe('Bootstrap multiaddr shape — every entry is a /dnsaddr/ on the fleet domain', () => {
  it('every entry uses the /dnsaddr/ form (not /dns4/, /dns6/, /ip4/, /ip6/)', () => {
    // Why: only /dnsaddr/ resolves both IPv4 and IPv6 multiaddrs via TXT
    // records. /dns4/ would force IPv4-only, defeating the dual-stack
    // story we just shipped on the SCS-Polaris side.
    for (const maddr of SCS_POLARIS_BOOTSTRAP_MULTIADDRS) {
      expect(maddr).toMatch(/^\/dnsaddr\//)
      expect(maddr).not.toMatch(/^\/dns[46]\//)
      expect(maddr).not.toMatch(/^\/ip[46]\//)
    }
  })

  it('every entry references the configured fleet domain', () => {
    for (const maddr of SCS_POLARIS_BOOTSTRAP_MULTIADDRS) {
      expect(maddr).toContain(`/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/`)
    }
  })

  it('every entry includes a /p2p/ component with a base58btc peer ID', () => {
    // base58btc alphabet excludes 0, O, I, l (visual-collision avoidance).
    // Real PeerIDs always come out of multibase-base58btc, so any "peer ID"
    // containing those four characters is structurally invalid.
    for (const maddr of SCS_POLARIS_BOOTSTRAP_MULTIADDRS) {
      expect(maddr).toMatch(/\/p2p\/[1-9A-HJ-NP-Za-km-z]+$/)
    }
  })

  it('peer IDs are unique across the list (no duplicate fleet slots)', () => {
    const peerIds = SCS_POLARIS_BOOTSTRAP_MULTIADDRS.map((m) => {
      const idx = m.lastIndexOf('/p2p/')
      return m.slice(idx + '/p2p/'.length)
    })
    const distinct = new Set(peerIds)
    expect(distinct.size).toBe(peerIds.length)
  })
})

describe('Placeholder-detection guardrail', () => {
  it('hasPlaceholderPeerIds returns true on the current (un-rekeyed) list', () => {
    // The current commit ships placeholder peer IDs because real fleet
    // keys are minted at deploy time. v2's daemon-start code MUST refuse
    // to start the daemon while this returns true — otherwise we'd dial
    // 10 non-existent peers, time out, and silently fall back to a
    // partially-functional swarm.
    expect(hasPlaceholderPeerIds(SCS_POLARIS_BOOTSTRAP_MULTIADDRS)).toBe(true)
  })

  it('hasPlaceholderPeerIds returns false on a list with no placeholders', () => {
    const realLooking = [
      `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN`,
      `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/QmRealLookingPeerIdNotPlaceholder123456789ABCDEFGH`
    ]
    expect(hasPlaceholderPeerIds(realLooking)).toBe(false)
  })

  it('hasPlaceholderPeerIds returns false on an empty list', () => {
    expect(hasPlaceholderPeerIds([])).toBe(false)
  })

  it('hasPlaceholderPeerIds anchors the match to /p2p/ — substring elsewhere does not trip', () => {
    // Adversarial / accidentally-malformed multiaddr: marker substring lives
    // inside the DNS label, not in the PeerID component. The guard must NOT
    // flag this as a placeholder fleet — that would block daemon start on
    // an unrelated dial input. Anchored check is the fix.
    const sneaky = [
      `/dnsaddr/${PLACEHOLDER_PEER_ID_MARKER}.example.com/p2p/12D3KooWNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN`
    ]
    expect(hasPlaceholderPeerIds(sneaky)).toBe(false)
  })

  it('hasPlaceholderPeerIds skips entries with no /p2p/ component', () => {
    const noP2p = ['/ip4/198.51.100.1/tcp/4001', '/dnsaddr/example.com']
    expect(hasPlaceholderPeerIds(noP2p)).toBe(false)
  })

  it('the placeholder marker is present in every shipped entry', () => {
    // Belt-and-suspenders: if someone adds a real peer ID to the list
    // without removing all placeholders, this test catches the half-done
    // state. Either rekey them all, or none — partial rekeys are how
    // misconfigured fleets ship in production.
    for (const maddr of SCS_POLARIS_BOOTSTRAP_MULTIADDRS) {
      expect(maddr).toContain(PLACEHOLDER_PEER_ID_MARKER)
    }
  })
})

describe('buildKuboBootstrapList()', () => {
  it('returns a mutable array (not a frozen view) so callers can JSON.stringify safely', () => {
    const list = buildKuboBootstrapList()
    expect(Array.isArray(list)).toBe(true)
    // Confirm it's a fresh copy, not a reference to the readonly source —
    // mutation here must not affect SCS_POLARIS_BOOTSTRAP_MULTIADDRS.
    list.push('/dnsaddr/junk/p2p/Qm...')
    expect(list.length).toBe(SCS_POLARIS_FLEET_SIZE + 1)
    expect(SCS_POLARIS_BOOTSTRAP_MULTIADDRS.length).toBe(SCS_POLARIS_FLEET_SIZE)
  })

  it('the returned array round-trips JSON with the same shape (Kubo config compatibility)', () => {
    const list = buildKuboBootstrapList()
    const roundtripped = JSON.parse(JSON.stringify(list)) as string[]
    expect(roundtripped).toEqual([...SCS_POLARIS_BOOTSTRAP_MULTIADDRS])
  })
})
