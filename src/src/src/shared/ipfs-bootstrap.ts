/**
 * SCS-Polaris bootstrap-fleet contract.
 *
 * The bundled Kubo daemon (ipfs.exe at resources/extras/ipfs/, dormant in v1
 * — see components-manifest.ts) is meant to peer with the SCS-Polaris fleet
 * for swarm-distributed payload delivery. When v2 lands the daemon-start
 * code, it imports BOOTSTRAP_MULTIADDRS below and writes them into the
 * Kubo config at `%IPFS_PATH%\config` on first run.
 *
 * Path note: Kubo on Windows reads IPFS_PATH (env var) if set, otherwise
 * defaults to `%LOCALAPPDATA%\ipfs\config` — NOT `~/.ipfs/config` (Unix).
 * v2's daemon-start code should set IPFS_PATH explicitly (e.g. to a
 * subdirectory of `app.getPath('userData')`) so the per-app Kubo store
 * doesn't collide with a user's standalone Kubo install on the same box.
 *
 * Why /dnsaddr/ form (not /dns4/ or /dns6/):
 *   - /dnsaddr/<host>/p2p/<peerID> resolves to TXT records at
 *     `_dnsaddr.<host>` which carry both IPv4 and IPv6 multiaddrs across
 *     both transports (TCP + QUIC). One client config entry → up to four
 *     reachable paths per peer.
 *   - Adding/removing fleet nodes is a TXT-record edit, NOT a client
 *     release. The 10 stable PeerIDs below stay constant; their underlying
 *     IPs rotate freely via DNS.
 *   - If the user's ISP loses one IP family (the incident that prompted
 *     Erland's "multiaddressing" callout), the resolved address set still
 *     contains the other family for any peer they can still reach.
 *
 * Production deployment status (as of 2026-05-07):
 *   - SCS-Polaris fleet: dual-stack ready (IPv6 listening + advertising)
 *     but NOT yet deployed to live hosts. Local/staging only.
 *   - DNS records at `_dnsaddr.bootstrap.execengine.com`: not provisioned.
 *   - The 10 PeerIDs below are PLACEHOLDERS. Real keys get minted at
 *     deploy time and committed back here in a single follow-up PR.
 *     Until that happens, this list is aspirational shape, not live config.
 *
 * See:
 * https://github.com/cabreraharry/SCS-Polaris/blob/main/docs/ipfs_bootstrap_new_peer_onboarding.md
 * § "Dual-stack via /dnsaddr/"
 */

/**
 * The DNS hostname under which the SCS-Polaris bootstrap fleet's TXT records
 * are published. The fleet's address family / transport set is reachable
 * via `_dnsaddr.<this-host>`.
 */
export const SCS_POLARIS_BOOTSTRAP_DOMAIN = 'bootstrap.execengine.com'

/**
 * Number of stable bootstrap nodes in the production fleet target.
 * Geographic distribution: aim for 3+ regions (e.g., 4 EU, 4 US, 2 APAC).
 */
export const SCS_POLARIS_FLEET_SIZE = 10

/**
 * Per-peer multiaddrs the client embeds in its Kubo Bootstrap config.
 *
 * One entry per fleet node. Each `/dnsaddr/` entry expands at resolve
 * time to up to 4 reachable multiaddrs (IPv4+IPv6 × TCP+QUIC) via TXT
 * records. So 10 client config entries → up to 40 dial paths.
 *
 * PeerIDs use Kubo's Ed25519 form (`12D3KooW...`) per the modern
 * libp2p convention. The strings below are PLACEHOLDERS (multihash-
 * shaped but not real keys) — they decode but won't dial. Replace
 * before any production release.
 */
export const SCS_POLARIS_BOOTSTRAP_MULTIADDRS: readonly string[] = [
  // 10 placeholder Ed25519 PeerIDs. Each is a real Ed25519 public-key
  // multihash format that libp2p accepts as syntactically valid; none
  // will produce a successful dial because no daemon holds the matching
  // private key. This lets the surrounding code be exercised end-to-end
  // (typecheck, multiaddr parse, JSON serialize) without ever connecting
  // anywhere.
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWAfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2d`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWBfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2e`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWCfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2f`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWDfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2g`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWEfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2h`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWFfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2i`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWGfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2j`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWHfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2k`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWJfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2m`,
  `/dnsaddr/${SCS_POLARIS_BOOTSTRAP_DOMAIN}/p2p/12D3KooWKfPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2n`
]

/**
 * Marker string burned into the placeholder PeerIDs above. Code that
 * attempts to use the bootstrap list at runtime can check for this to
 * detect an un-rekeyed install and refuse to dial — better to fail
 * loudly than to silently bootstrap-fail with timeouts.
 */
export const PLACEHOLDER_PEER_ID_MARKER = 'fPDpPRRRBrmqy9is2zjU5srQ4hKuZitiGmh4NTTpT2'

/**
 * Returns true if any entry in the supplied multiaddr list still uses a
 * placeholder PeerID (the synthetic Ed25519 keys above). Daemon-start
 * code in v2 should call this and refuse to start the daemon if it
 * returns true — better to surface a "fleet not yet provisioned" error
 * than to dial 10 non-existent peers and silently fall back to a
 * partially-functional swarm.
 *
 * Match is anchored to the `/p2p/<peerID>` tail so callers passing
 * peer-discovered or otherwise externally-sourced multiaddrs can't
 * trip the guard with the marker substring appearing elsewhere in
 * the address (e.g. inside a DNS label or transport metadata). Only
 * the actual PeerID component is compared.
 */
export function hasPlaceholderPeerIds(multiaddrs: readonly string[]): boolean {
  return multiaddrs.some((maddr) => {
    const idx = maddr.lastIndexOf('/p2p/')
    if (idx < 0) return false
    const peerId = maddr.slice(idx + '/p2p/'.length)
    return peerId.includes(PLACEHOLDER_PEER_ID_MARKER)
  })
}

/**
 * Build the JSON-serializable shape that Kubo's config `Bootstrap`
 * field expects. v2's daemon-start code reads this and writes it into
 * `%IPFS_PATH%\config` (after `ipfs init`, before `ipfs daemon` start)
 * so the daemon dials the fleet on first run instead of the public
 * libp2p bootstrap.
 *
 * Keep the return type narrow (string[]) — Kubo's schema accepts a
 * plain JSON array here, no extra wrapping.
 */
export function buildKuboBootstrapList(): string[] {
  return [...SCS_POLARIS_BOOTSTRAP_MULTIADDRS]
}
