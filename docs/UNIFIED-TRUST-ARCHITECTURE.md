# Unified Trust Architecture

**Comprehensive trust, identity, and certificate system for the ONE platform**

Version: 1.0.0
Status: Architecture Design
Last Updated: 2025-01-09

---

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Architecture Layers](#architecture-layers)
4. [Certificate & VC Integration](#certificate--vc-integration)
5. [Certificate Authority (CA) Infrastructure](#certificate-authority-ca-infrastructure)
6. [Trust Relationships](#trust-relationships)
7. [Social Graph & Attribution](#social-graph--attribution)
8. [Implementation Roadmap](#implementation-roadmap)

---

## Overview

The unified trust system consolidates multiple trust mechanisms into a coherent architecture:

- **Device Trust**: Device-to-device trust and key verification
- **Social Trust**: Person-to-person trust relationships and social graphs
- **Certificate Authority**: Every ONE instance can issue and manage certificates
- **Verifiable Credentials**: W3C-compliant credential presentation layer
- **Attribution & Licensing**: Content provenance and machine-readable licensing
- **Attestations**: Evidence-based verification claims

### Design Goals

1. **Decentralized by Default**: No central authority required
2. **Standards Compliant**: W3C Verifiable Credentials v2.0
3. **Platform Agnostic**: Works across all ONE platform implementations
4. **Cryptographically Verifiable**: All trust relationships backed by cryptographic proofs
5. **Time-Bound**: Certificates and credentials expire and require renewal
6. **Versioned**: ONE.core versioning for certificate lifecycle management
7. **Auditable**: Complete audit trail for certificate usage and trust decisions

---

## Core Principles

### 1. VCs are Presentation Layer for Certificates

Verifiable Credentials (VCs) provide W3C-standard presentation of underlying ONE platform certificates. They must be **structurally compatible** in both directions:

```
Certificate (Storage) ←→ VC (Presentation)
     ↓                        ↓
ONE.core Objects      W3C Standard JSON-LD
TrustKeysCertificate  VerifiableCredential
Signed by ONE keys    Ed25519Signature2020
```

**Key Requirement**: Any certificate can be presented as a VC, and any VC can be stored as a certificate.

### 2. Local Root Certificates with Optional Web Publication

Identity certificates are based on **local root certificates**:

```
Local Root Certificate (Authoritative)
├── Stored in ONE.core instance
├── Private key in secure keychain
├── Source of truth for identity
└── MAY be published via web for external verification
    └── HTTPS endpoint (e.g., https://refinio.net/.well-known/certificates/root)
```

**Not a web-based PKI** - The local root is authoritative. Web publication is optional for broader trust and verification by parties who don't have direct peer connections.

### 3. Every ONE Instance Can Be a CA

Certificate Authority functionality is not centralized:

- Any ONE instance can issue certificates
- Domain-based namespacing (e.g., refinio.net, mycompany.com)
- Cross-CA trust via social graph and attestations
- No single point of failure

### 4. Time-Bound Certificates with Versioning

Certificates are valid for specific time periods:

- `validFrom` / `validUntil` timestamps
- Extensions = new versions (ONE.core versioning)
- Reductions = new versions with earlier expiry
- Revocation = new version with `validUntil` in the past
- Same certificate ID, different versions over time

### 5. Social Graphs Remain Core

Inter-instance trust relationships are critical and growing more important:

- Person-to-person trust (not just device-to-device)
- Trust path calculation across social graphs
- Progressive trust levels (invited → known → verified → trusted → core)
- Network analysis (centrality, clustering)

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 6: Applications & UI                                      │
│ - Chat apps, file sharing, identity verification               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 5: High-Level Services                                    │
│ - TrustPlan (RPC), CAPlan (RPC)                                │
│ - VCPropagation, AuditTrailService                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4: Trust Orchestration                                    │
│ - TrustModel: Unified trust management                         │
│ - CAModel: Certificate authority operations                    │
│ - VCBridge: Certificate ↔ VC translation                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: Trust Mechanisms                                       │
│ - Device Trust: TrustRelationship, device credentials          │
│ - Social Trust: TrustEdge, trust paths, social graphs          │
│ - Attribution: Content provenance tracking                     │
│ - Licensing: Machine-readable licensing & access control       │
│ - Attestation: Evidence-based verification claims              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: Certificate & VC Infrastructure                        │
│ - TrustedKeysManager: Certificate chain validation             │
│ - TrustKeysCertificate: ONE platform certificates              │
│ - VerifiableCredential: W3C VC presentation                    │
│ - Certificate versioning, issuance, revocation                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: ONE Platform Foundation                                │
│ - ONE.core: Storage, versioning, recipes, reverse maps         │
│ - Keychain: Secure key storage                                 │
│ - Crypto API: Ed25519 signing/verification                     │
│ - QUIC/CHUM: Transport for VC/certificate exchange             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Certificate & VC Integration

### Bidirectional Compatibility

The **VCBridge** ensures structural compatibility between certificates and VCs:

```typescript
// Certificate → VC Presentation
Certificate: TrustKeysCertificate {
  issuer: SHA256IdHash<Person>      → VC.issuer (DID or oneIssuer)
  subject: SHA256IdHash<Person>     → VC.credentialSubject.id
  subjectPublicKey: string          → VC.credentialSubject.publicKey
  validFrom: Date                   → VC.issuanceDate
  validUntil: Date                  → VC.expirationDate
  proof: Signature                  → VC.proof (Ed25519Signature2020)
}

// VC → Certificate Storage
VerifiableCredential {
  issuer: string                    → Certificate.issuer
  credentialSubject: {
    id: string                      → Certificate.subject
    publicKey: string               → Certificate.subjectPublicKey
  }
  issuanceDate: string              → Certificate.validFrom
  expirationDate: string            → Certificate.validUntil
  proof: W3CProof                   → Certificate.proof
}
```

### Attestation as Bridge Pattern

The **Attestation** recipe (from packages/one.trust) already demonstrates the bridge pattern:

```typescript
Attestation {
  subject: {
    type: string
    id: SHA256IdHash               // Certificate subject
  }
  issuer: SHA256IdHash<Person>     // Certificate issuer
  license: SHA256Hash<License>     // Certificate compliance marker
  claim: {
    statement: string
    confidence: number (0-1)
  }
  evidence: Evidence[]             // Verification evidence
  verification: {
    method: string
    verifiedBy: SHA256IdHash<Person>
    verifiedAt: Date
    expires: Date                  // Certificate validity
  }
  proof: W3CProof | Signature      // VC or Certificate proof
}
```

**Key Insight**: Attestations are already certificate-compliant and VC-compatible, showing the architectural pattern for the entire system.

---

## Certificate Authority (CA) Infrastructure

### Decentralized CA Model

Every ONE instance can function as a Certificate Authority:

```typescript
interface CertificateAuthority {
  // CA Identity
  caInstanceId: SHA256IdHash<Person>   // The CA's identity in ONE
  caDomain?: string                     // Optional domain (e.g., "refinio.net")
  caPublicKey: string                   // CA's signing public key
  rootCertificate: RootCertificate      // Local root certificate

  // Root Certificate Management
  createRootCertificate(): Promise<RootCertificate>
  publishRootToWeb?(url: string): Promise<void>  // Optional web publication
  getRootCertificate(): RootCertificate

  // Certificate Issuance
  issueCertificate(params: {
    subject: SHA256IdHash<Person>
    certificateType: CertificateType    // 'identity', 'device', 'trust', etc.
    validFor: Duration                  // e.g., "12 months"
    claims: Record<string, any>
  }): Promise<IssuedCertificate>

  // Time Management (versioning)
  extendCertificate(
    certId: SHA256Hash<TrustKeysCertificate>,
    additionalDuration: Duration
  ): Promise<CertificateVersion>

  reduceCertificate(
    certId: SHA256Hash<TrustKeysCertificate>,
    newValidUntil: Date
  ): Promise<CertificateVersion>

  revokeCertificate(
    certId: SHA256Hash<TrustKeysCertificate>,
    reason: string
  ): Promise<CertificateVersion>

  // Version Management
  getLatestVersion(
    certId: SHA256Hash<TrustKeysCertificate>
  ): Promise<CertificateVersion>

  getCertificateHistory(
    certId: SHA256Hash<TrustKeysCertificate>
  ): Promise<CertificateVersion[]>
}
```

### Local Root Certificate

The foundation of identity certificates:

```typescript
interface RootCertificate {
  $type$: 'RootCertificate'

  // Identity
  id: SHA256IdHash<RootCertificate>    // Root cert ID
  caInstanceId: SHA256IdHash<Person>   // CA's person ID
  domain?: string                       // Optional domain

  // Keys
  publicKey: string                     // Ed25519 public key
  keyType: 'Ed25519'                    // Key algorithm

  // Validity
  createdAt: Date
  validFrom: Date
  validUntil?: Date                     // Optional expiration

  // Web Publication (optional)
  webUrl?: string                       // HTTPS URL if published
  publishedAt?: Date                    // When published to web

  // Self-signature
  proof: {
    type: 'Ed25519Signature2020'
    created: Date
    verificationMethod: string          // Reference to public key
    proofPurpose: 'assertionMethod'
    proofValue: string                  // Signature
  }
}
```

**Key Points**:
- Stored in ONE.core as versioned object
- Private key in secure keychain (never exported)
- MAY be published to web at `domain/.well-known/certificates/root`
- Self-signed (root of trust)
- Can have optional expiration

### Identity Certificate Chain

Identity certificates chain to the local root:

```
Root Certificate (Local, authoritative)
    ↓ (signs)
Identity Certificate
    ↓ (signs)
Device Certificate
    ↓ (signs)
Trust Certificate / Attestation
```

Example flow:
```typescript
// 1. Create local root (done once per CA)
const root = await ca.createRootCertificate()

// 2. Optionally publish to web
await ca.publishRootToWeb('https://refinio.net/.well-known/certificates/root')

// 3. Issue identity certificate (chains to root)
const identityCert = await ca.issueCertificate({
  subject: alicePersonId,
  certificateType: 'identity',
  validFor: '12 months',
  claims: {
    name: 'Alice Smith',
    email: 'alice@refinio.net',
    verificationLevel: 'government_id'
  }
})

// 4. Identity cert references root in chain
identityCert.chainedTo = root.id

// 5. Verification checks chain back to root
const isValid = await verifyChain(identityCert, root)
```

### Certificate Versioning with ONE.core

Certificates use ONE.core versioning for time management:

```typescript
// Version 1: Initial issuance
CertificateV1 {
  id: 'cert-abc123'          // Same ID across versions
  $version$: 1
  validFrom: '2025-01-09'
  validUntil: '2026-01-09'   // 12 months
}

// Version 2: Extension (6 months)
CertificateV2 {
  id: 'cert-abc123'          // Same ID
  $version$: 2
  validFrom: '2025-01-09'    // Unchanged
  validUntil: '2026-07-09'   // Extended
}

// Version 3: Revocation
CertificateV3 {
  id: 'cert-abc123'          // Same ID
  $version$: 3
  validFrom: '2025-01-09'    // Unchanged
  validUntil: '2025-01-08'   // In the past = revoked
  revoked: true
  revocationReason: 'Key compromised'
}
```

**Benefits**:
- Complete audit trail (all versions preserved)
- Atomic updates (version transitions are atomic)
- Distributed sync (CHUM syncs versions automatically)
- No special revocation infrastructure needed

### Web Publication (Optional)

Root certificates MAY be published to web for external verification:

```
HTTPS Endpoint:
https://{domain}/.well-known/certificates/root

Response (JSON-LD):
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://w3id.org/security/v2"
  ],
  "id": "https://refinio.net/certificates/root/abc123",
  "type": "RootCertificate",
  "issuer": "did:one:abc123...",
  "publicKey": "...",
  "proof": { ... }
}
```

**Use Cases for Web Publication**:
1. External verification (parties outside ONE network)
2. Cross-platform trust (e.g., integrating with traditional PKI)
3. Public transparency (organization wants public verification)
4. Backup/recovery (web serves as canonical reference)

**Not Required**: ONE instances can fully operate with local-only roots.

---

## Trust Relationships

### Device Trust (Layer 1)

Device-to-device trust for communication and key verification:

```typescript
interface TrustRelationship {
  $type$: 'TrustRelationship'
  $version$: number

  // Peer Identity
  peer: SHA256IdHash<Person>         // Trusted peer
  peerPublicKey: string              // Peer's public key

  // Trust Status (device-level)
  status: 'trusted' | 'untrusted' | 'pending' | 'revoked'

  // Timestamps
  establishedAt: Date
  lastVerified: Date
  validUntil?: Date

  // Verification
  verificationMethod: string         // 'qr-code', 'invite', 'certificate'
  verificationProof?: SHA256Hash     // Certificate or evidence

  // Metadata
  reason?: string
  context?: string
}
```

**Usage**: Communication trust, file transfer approval, device pairing

### Social Trust (Layer 2)

Person-to-person trust with progressive levels:

```typescript
interface TrustEdge {
  $type$: 'TrustEdge'

  // Trust Relationship
  from: SHA256IdHash<Person>
  to: SHA256IdHash<Person>
  reciprocal: boolean                // Bidirectional trust?

  // Progressive Trust Level
  level: 'invited' | 'known' | 'verified' | 'trusted' | 'core'
  confidence: number                 // 0.6, 0.7, 0.85, 0.9, 0.95

  // Origin & Evolution
  origin: 'invite' | 'verification' | 'endorsement' | 'interaction' | 'imported'
  established: Date
  lastVerified: Date

  // Trust Chain
  chainDepth: number                 // Distance from root
  pathTrust: number                  // Accumulated trust

  // Metrics
  interactions: number
  endorsements: number
  disputes: number

  // Scope
  scope?: {
    domains?: string[]
    capabilities?: string[]
    contexts?: string[]
  }

  // Revocation
  revoked: boolean
  revokedAt?: Date
  revocationReason?: string
}
```

**Usage**: Social graph analysis, trust path calculation, content sharing decisions

### Trust Evaluation

Combines multiple factors for trust decisions:

```typescript
interface TrustEvaluation {
  // Base Score
  level: number                      // 0-1 trust score
  confidence: number                 // 0-1 confidence in score

  // Factors Contributing to Score
  factors: {
    relationshipStatus: number       // From TrustRelationship
    certificateValidation: number    // From TrustedKeysManager
    socialGraph: number              // From trust path
    recency: number                  // Time since last verification
    context: number                  // Context-specific modifiers
  }

  // Decision
  trustLevel: 'none' | 'limited' | 'standard' | 'elevated' | 'full'
  reason: string

  // Recommendations
  shouldUpgrade?: boolean
  upgradeActions?: string[]
  riskFactors?: string[]
}
```

### Trust Path Calculation

Finding trust chains through social graph:

```typescript
interface TrustPath {
  from: SHA256IdHash<Person>
  to: SHA256IdHash<Person>

  // Path Details
  path: Array<{
    edge: TrustEdge
    trustScore: number
  }>
  pathLength: number

  // Trust Metrics
  totalTrust: number                 // Accumulated trust
  bottleneck: number                 // Weakest link (min score)

  // Validity
  isValid: boolean
  expiresAt?: Date                   // When trust path expires
}
```

**Algorithm**: Dijkstra-like algorithm with trust decay and bottleneck analysis

---

## Social Graph & Attribution

### Social Graph Analysis

Network topology analysis for trust communities:

```typescript
interface SocialGraph {
  nodes: Array<{
    person: SHA256IdHash<Person>
    trustLevel: TrustLevel
    connections: number
    centrality: number               // Influence metric
  }>

  edges: TrustEdge[]

  clusters: Array<{
    id: string
    members: SHA256IdHash<Person>[]
    cohesion: number                 // Internal trust density
    trust: number                    // Average trust level
  }>

  // Metrics
  totalNodes: number
  totalEdges: number
  averageTrust: number
  density: number
}
```

**Features**: Centrality metrics, cluster detection, influence measurement

### Content Attribution

"Who said what about what" - complete provenance tracking:

```typescript
interface Attribution {
  $type$: 'Attribution'

  // Content
  content: {
    type: string                     // 'Message', 'File', 'Post', etc.
    id: SHA256Hash
    hash: SHA256Hash
    summary: string
  }

  // Author & Contributors
  author: SHA256IdHash<Person>
  contributors: Array<{
    person: SHA256IdHash<Person>
    role: string                     // 'co-author', 'editor', 'reviewer'
    contribution: string
    timestamp: Date
  }>

  // Subject (what it's about)
  subject: {
    type: string
    topics: string[]
    entities: Array<{
      name: string
      type: string
    }>
  }

  // Chain of Custody
  derivedFrom?: Array<{
    type: 'quote' | 'reference' | 'translation' | 'summary' | 'remix'
    source: SHA256Hash
    author: SHA256IdHash<Person>
  }>

  // Verification
  verified: boolean
  verifiedBy?: SHA256IdHash<Person>

  // Licensing
  license?: SHA256Hash<License>
  attributionRequired: boolean
}
```

### Licensing

Machine-readable licensing inspired by RuleMapping:

```typescript
interface License {
  $type$: 'License'

  // Basic Info
  name: string
  licensor: SHA256IdHash<Person>
  content: {
    type: string
    id: SHA256Hash
  }

  // Machine-Readable Rules
  rules: LicenseRule[]

  // Standard Categories
  permissions: Permission[]          // 'use', 'modify', 'distribute', etc.
  requirements: Requirement[]        // 'attribution', 'share-alike', etc.
  prohibitions: Prohibition[]        // 'commercial', 'modification', etc.

  // Complex Constraints
  constraints: {
    temporal?: {
      validFrom: Date
      validUntil: Date
      renewable: boolean
    }
    geographic?: {
      allowed: string[]              // Country codes
      prohibited: string[]
    }
    usage?: {
      maxUsers?: number
      purposes: string[]
      prohibitedPurposes: string[]
    }
    recipients?: {
      allowedTypes: string[]
      requiresApproval: boolean
      trustedOnly: boolean           // Trust integration!
      minTrustLevel: number          // 0-1 trust threshold
    }
  }

  // Attribution Requirements
  attribution?: {
    required: boolean
    text: string
    url?: string
    placement?: string
  }
}
```

**Key Feature**: Trust-based access control (`trustedOnly`, `minTrustLevel`)

---

## Implementation Roadmap

### Phase 1: Foundation & Documentation (Current)

**Goal**: Comprehensive architecture documentation

- [x] Create UNIFIED-TRUST-ARCHITECTURE.md
- [ ] Document VC ↔ Certificate bridge patterns
- [ ] Document CA infrastructure with local root certificates
- [ ] Document versioning strategy for time-bound certificates
- [ ] Document peer propagation architecture
- [ ] Create API reference documentation
- [ ] Create integration guides

### Phase 2: Certificate ↔ VC Bridge

**Goal**: Bidirectional compatibility between certificates and VCs

```typescript
// VCBridge implementation
class VCBridge {
  certificateToVC(cert: TrustKeysCertificate): VerifiableCredential
  vcToCertificate(vc: VerifiableCredential): TrustKeysCertificate
  validateCompatibility(cert, vc): boolean
}
```

**Deliverables**:
- VCBridge class implementation
- Structural mapping utilities
- Validation functions
- Unit tests for bidirectional conversion

### Phase 3: CA Infrastructure

**Goal**: Enable every ONE instance to be a CA

```typescript
// CAModel implementation
class CAModel implements Model {
  async createRootCertificate(): Promise<RootCertificate>
  async publishRootToWeb(url: string): Promise<void>
  async issueCertificate(params): Promise<IssuedCertificate>
  async extendCertificate(certId, duration): Promise<CertificateVersion>
  async revokeCertificate(certId, reason): Promise<CertificateVersion>
}
```

**Deliverables**:
- CAModel class
- RootCertificate recipe
- Certificate issuance logic
- Versioning implementation
- Optional web publication
- Integration with TrustedKeysManager

### Phase 4: Peer Propagation

**Goal**: Systematic VC/certificate distribution

```typescript
// VCPropagation service
class VCPropagation {
  async propagateToNetwork(cert, peers): Promise<void>
  async subscribeToUpdates(certId, callback): Promise<void>
  async fetchLatestVersion(certId, fromPeers): Promise<CertificateVersion>
}
```

**Deliverables**:
- VCPropagation service
- QUIC integration for VC transport
- Subscription mechanism for updates
- Eventual consistency handling
- Conflict resolution for concurrent updates

### Phase 5: Audit Trail

**Goal**: Track certificate usage and invalid attempts

```typescript
// AuditTrailService
class AuditTrailService {
  async recordUsageAttempt(audit: CertificateAudit): Promise<void>
  async queryAuditTrail(certId): Promise<CertificateAudit[]>
  async detectAnomalies(certId): Promise<SuspiciousActivity>
}
```

**Deliverables**:
- CertificateAudit recipe
- Audit recording logic
- Query API for audit trail
- Anomaly detection
- Reporting mechanisms

### Phase 6: Social Trust Integration

**Goal**: Merge packages/one.trust features into trust.core

**Tasks**:
- Migrate TrustEdge recipe
- Integrate trust path calculation into TrustModel
- Add social graph analysis
- Merge Attribution recipe
- Merge License recipe
- Merge Attestation recipe (already cert-compliant!)
- Update TrustPlan with social methods

**Deliverables**:
- Enhanced TrustModel with social features
- Consolidated recipes in trust.core/recipes/
- Deprecation of packages/one.trust
- Migration guide

### Phase 7: Reference Implementation

**Goal**: Refinio CA selling identity certificates

```typescript
// Example: Refinio as a CA
class RefinioCA extends CAModel {
  domain = 'refinio.net'

  async sellIdentityCertificate(
    buyer: SHA256IdHash<Person>,
    verificationEvidence: Evidence[],
    duration: Duration
  ): Promise<IdentityCertificateSale>

  async extendIdentityCertificate(
    certId: SHA256Hash<TrustKeysCertificate>,
    additionalDuration: Duration
  ): Promise<CertificateExtension>
}
```

**Deliverables**:
- Refinio CA implementation
- Payment integration (if needed)
- Identity verification workflow
- Certificate marketplace UI
- Analytics and reporting

---

## Appendices

### A. Existing Code Inventory

**Packages with VC/Trust Infrastructure**:
- `packages/one.verifiable/` - W3C VC recipes
- `packages/one.vc/` - Device identity credentials
- `packages/one.trust/` - Social trust, attribution, licensing
- `packages/refinio.cli/src/vc/` - VC authentication over QUIC
- `lama/src/models/credentials/` - Device credential management
- `lama/packages/one.vc/` - Alternative VC implementation

**See**: `docs/EXISTING-VC-INFRASTRUCTURE.md` for complete inventory

### B. Standards References

- W3C Verifiable Credentials Data Model v2.0
- W3C Decentralized Identifiers (DIDs)
- RuleMapping machine-readable licensing
- X.509 certificate chains (for comparison)
- OAuth 2.0 / OIDC (for interop)

### C. Security Considerations

- Private keys never leave secure keychain
- All certificates cryptographically signed
- Time-bound validity prevents indefinite trust
- Revocation via versioning (can't be hidden)
- Audit trail for accountability
- Trust decay over time without verification

### D. Migration Strategy

For existing code using fragmented trust systems:
1. Use VCBridge for compatibility layer
2. Gradually migrate to unified TrustModel API
3. Deprecate old implementations with clear timeline
4. Provide migration tools and documentation

---

**Document Status**: Architecture design in progress
**Next Review**: After Phase 2 implementation
**Maintainers**: LAMA Core Team
