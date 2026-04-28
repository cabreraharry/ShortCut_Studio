/**
 * ExecEngine V2 Consumer Peer ↔ Agent Hub message-type contracts.
 *
 * These types mirror the documented Queue protocol (see
 * `D:/ExecEngine/V2/docu_V2/Consumer_Peer_Integration.md` v3.1.0). The wire
 * format is TSV-encoded over raw TCP on ports 44998 / 44999, with
 * request/response correlation via PackageID. None of these messages are
 * actually sent by the current client — the queue transport is a future
 * deliverable. Defining the types now keeps the contract stable so when the
 * transport lands, every adapter knows the exact shape it needs to encode.
 *
 * Field naming follows the protocol docs verbatim (e.g. `pkgId`, `peerId`,
 * `docId`, `docId2`) rather than camelcase variants we'd typically prefer —
 * the docs and the Python backend already agree on those names; aligning
 * avoids a translation layer.
 *
 * ⚠ Do NOT use these types for IPC payloads or DB writes. They model the
 * SCL inter-peer protocol only.
 */

// ---------- Outbound: Consumer Peer → Agent Hub ----------

export interface ConsumerPeerEnvelope {
  /** Caller-generated correlation id; Agent Hub echoes this on the response. */
  pkgId: string
  /** This peer's identity (matches LLM_Provider's cp_id / SIS-issued cpId). */
  peerId: string
  /** Epoch seconds. */
  timestamp: number
}

/** **CBR** — CP-to-Backend Report. Sent when this peer has just produced
 *  metadata for a document and wants Agent Hub to record it. Response: `RBC`. */
export interface CBRMessage extends ConsumerPeerEnvelope {
  contentType: 'CBR'
  docId: string
  docId2: string
  fileSize: number
  fileType: string
  pageNum: number
  title: string
  titleId: string
}

/** **CBRM** — CP MasterID lookup request. Asks Agent Hub which MasterID owns
 *  a given DocID/DocID2 pair (de-duplication). Response: `RBCM`. */
export interface CBRMMessage extends ConsumerPeerEnvelope {
  contentType: 'CBRM'
  docId: string
  docId2: string
  masterId: string
}

/** **CDREQ** — CP Document CID request. Asks Agent Hub for the IPFS CID of a
 *  specific document. Response: `CDRESP`. */
export interface CDREQMessage extends ConsumerPeerEnvelope {
  contentType: 'CDREQ'
  docId: string
  docId2: string
}

/** **CMREQ** — CP Master CID request. Asks Agent Hub for the IPFS CID of a
 *  master document. Response: `CMRESP`. */
export interface CMREQMessage extends ConsumerPeerEnvelope {
  contentType: 'CMREQ'
  masterId: string
}

/** **CSCT** — CP task assignment request. Asks the Scheduler for the next
 *  task this peer should work on. Response: `TRSC`. */
export interface CSCTMessage extends ConsumerPeerEnvelope {
  contentType: 'CSCT'
  /** Task category the peer is asking for (e.g. 'topic-generation'). */
  taskType: string
}

/** **CSMC** — CP MasterID CID request via Support_M. Used when CMREQ is
 *  bypassed for support paths. Response: `CRSC`. */
export interface CSMCMessage extends ConsumerPeerEnvelope {
  contentType: 'CSMC'
  masterId: string
}

/** **CSMS** — CP statistics request. Asks Agent Hub for this peer's
 *  contribution stats (files reported, queued, etc). Response: `MSCS`. */
export interface CSMSMessage extends ConsumerPeerEnvelope {
  contentType: 'CSMS'
}

/** **CPSR** — CP peer seed request. Asks Agent Hub for a list of peers this
 *  peer should connect to / mirror. Response: `CPSRESP`. */
export interface CPSRMessage extends ConsumerPeerEnvelope {
  contentType: 'CPSR'
}

export type OutboundMessage =
  | CBRMessage
  | CBRMMessage
  | CDREQMessage
  | CMREQMessage
  | CSCTMessage
  | CSMCMessage
  | CSMSMessage
  | CPSRMessage

// ---------- Inbound: Agent Hub → Consumer Peer ----------

export interface AgentHubEnvelope {
  /** Echoes the pkgId from the request that triggered this response. */
  pkgId: string
  peerId: string
  timestamp: number
}

/** **RBC** — Response to CBR. Confirms ingestion + reports how many other
 *  peers have already submitted this document (de-dup count). */
export interface RBCMessage extends AgentHubEnvelope {
  contentType: 'RBC'
  docId: string
  docId2: string
  masterId: string
  numReported: number
}

/** **RBCM** — Response to CBRM. Returns the canonical MasterID and a status. */
export interface RBCMMessage extends AgentHubEnvelope {
  contentType: 'RBCM'
  masterId: string
  status: string
}

/** **CDRESP** — Response to CDREQ. Returns the document's IPFS CID. */
export interface CDRESPMessage extends AgentHubEnvelope {
  contentType: 'CDRESP'
  docId: string
  docId2: string
  cid: string
  /** Mirrored content type for routing (e.g. 'document'). */
  docContentType: string
  status: string
}

/** **CMRESP** — Response to CMREQ. Returns a master's IPFS CID. */
export interface CMRESPMessage extends AgentHubEnvelope {
  contentType: 'CMRESP'
  masterId: string
  cid: string
  docContentType: string
  status: string
}

/** **TRSC** — Response to CSCT. Returns a task assignment. */
export interface TRSCMessage extends AgentHubEnvelope {
  contentType: 'TRSC'
  taskId: string
  status: string
}

/** **CRSC** — Response to CSMC. Returns master CID via support path. */
export interface CRSCMessage extends AgentHubEnvelope {
  contentType: 'CRSC'
  masterId: string
  cid: string
  docContentType: string
  status: string
}

/** **MSCS** — Response to CSMS. Returns this peer's statistics dict. */
export interface MSCSMessage extends AgentHubEnvelope {
  contentType: 'MSCS'
  /** Free-form statistics blob; shape TBD when stats endpoint is finalized. */
  stats: Record<string, unknown>
}

/** **CPSRESP** — Response to CPSR. Returns the seed-peer list. */
export interface CPSRESPMessage extends AgentHubEnvelope {
  contentType: 'CPSRESP'
  seeds: Array<{ peerId: string; address?: string }>
}

export type InboundMessage =
  | RBCMessage
  | RBCMMessage
  | CDRESPMessage
  | CMRESPMessage
  | TRSCMessage
  | CRSCMessage
  | MSCSMessage
  | CPSRESPMessage

// ---------- Errors ----------

/**
 * Thrown by `RealExecEngineClient` methods that have a documented
 * Queue-protocol mapping but no implementation yet. Caller (typically the
 * factory in client.ts) catches this and falls back to the local/mock impl
 * so feature code keeps working.
 */
export class BackendNotReady extends Error {
  constructor(
    /** Method name (e.g. 'getProgressSummary'). */
    public readonly method: string,
    /** Documented protocol mapping (e.g. 'CBR + RBC poll'). */
    public readonly protocol: string
  ) {
    super(`ExecEngine ${method}: ${protocol} not yet implemented in client`)
    this.name = 'BackendNotReady'
  }
}
