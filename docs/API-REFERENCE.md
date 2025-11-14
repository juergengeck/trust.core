# Trust.core API Reference

**Complete API documentation for the unified trust system**

Version: 1.0.0
Last Updated: 2025-01-09

---

## Table of Contents

1. [Models](#models)
   - [TrustModel](#trustmodel)
   - [CAModel](#camodel)
   - [VCBridge](#vcbridge)
2. [Services](#services)
   - [VCPropagation](#vcpropagation)
   - [AuditTrailService](#audittrailservice)
3. [Plans (RPC)](#plans-rpc)
   - [TrustPlan](#trustplan)
   - [CAPlan](#caplan)
4. [Recipes](#recipes)
5. [Types](#types)

---

## Models

### TrustModel

**Purpose**: Unified trust management combining device trust, social trust, and certificate validation.

#### Constructor

```typescript
constructor(
  leuteModel: LeuteModel,
  trustedKeysManager?: TrustedKeysManager
)
```

#### Lifecycle Methods

```typescript
async init(): Promise<void>
```
Initialize the TrustModel. Loads device credentials from keychain and existing trust relationships.

**Throws**: `Error` if initialization fails

**Example**:
```typescript
const trustModel = new TrustModel(leuteModel, trustedKeysManager)
await trustModel.init()
```

---

```typescript
async shutdown(): Promise<void>
```
Shutdown the TrustModel and clean up resources.

---

#### Device Trust Methods

```typescript
async setTrustStatus(
  peerPersonId: SHA256IdHash<Person>,
  peerPublicKey: string,
  status: TrustStatus,
  options?: {
    trustLevel?: TrustLevel
    reason?: string
    context?: string
    verificationMethod?: string
    verificationProof?: SHA256Hash
    permissions?: TrustPermissions
  }
): Promise<void>
```

Set or update trust status for a peer device.

**Parameters**:
- `peerPersonId`: Person ID of the peer
- `peerPublicKey`: Peer's Ed25519 public key (hex)
- `status`: Trust status ('trusted', 'untrusted', 'pending', 'revoked')
- `options.trustLevel`: Optional trust level ('full', 'limited', 'temporary')
- `options.reason`: Why trust was established
- `options.context`: Context of trust (e.g., 'pairing', 'file-transfer')
- `options.verificationMethod`: How trust was verified (e.g., 'qr-code', 'certificate')
- `options.verificationProof`: Hash of verification certificate/evidence
- `options.permissions`: Fine-grained permissions

**Example**:
```typescript
await trustModel.setTrustStatus(
  bobPersonId,
  bobPublicKey,
  'trusted',
  {
    trustLevel: 'full',
    reason: 'QR code pairing',
    context: 'device_pairing',
    verificationMethod: 'qr-code'
  }
)
```

---

```typescript
async getTrustStatus(
  peerPersonId: SHA256IdHash<Person>
): Promise<TrustEntry | null>
```

Get current trust status for a peer.

**Returns**: Trust entry or null if no relationship exists

**Example**:
```typescript
const trust = await trustModel.getTrustStatus(bobPersonId)
if (trust?.status === 'trusted') {
  // Proceed with trusted operation
}
```

---

```typescript
async getTrustedDevices(): Promise<TrustEntry[]>
```

Get all trusted devices.

**Returns**: Array of trust entries with status 'trusted'

---

```typescript
async verifyDeviceKey(
  peerPersonId: SHA256IdHash<Person>,
  peerPublicKey: string
): Promise<boolean>
```

Verify a device's public key against trust relationship AND certificates.

**Returns**: true if key is verified via relationship or certificates

**Example**:
```typescript
const isValid = await trustModel.verifyDeviceKey(bobPersonId, bobPublicKey)
if (!isValid) {
  throw new Error('Invalid or unverified key')
}
```

---

```typescript
async evaluateTrust(
  peerPersonId: SHA256IdHash<Person>,
  context?: string
): Promise<TrustEvaluation>
```

Evaluate trust for a peer considering multiple factors:
- Trust relationship status
- Certificate validation
- Social graph position
- Recency of verification
- Context-specific requirements

**Returns**: Trust evaluation with level (0-1), confidence (0-1), and reason

**Example**:
```typescript
const evaluation = await trustModel.evaluateTrust(bobPersonId, 'file-transfer')
if (evaluation.level >= 0.8 && evaluation.confidence >= 0.7) {
  // Sufficient trust for file transfer
}
```

---

#### Social Trust Methods

```typescript
async establishTrustFromInvite(
  inviter: SHA256IdHash<Person>,
  invitee: SHA256IdHash<Person>,
  inviteId: SHA256IdHash<Invite>
): Promise<TrustEdge>
```

Establish initial trust relationship from profile invite (progressive trust system).

**Returns**: Trust edge with level 'invited' and confidence 0.6

---

```typescript
async upgradeTrust(
  edgeId: string,
  newLevel: TrustLevel,
  verificationMethod: string
): Promise<TrustEdge>
```

Upgrade trust level after additional verification.

**Trust progression**: invited (0.6) → known (0.7) → verified (0.85) → trusted (0.9) → core (0.95)

---

```typescript
async calculateTrustPath(
  from: SHA256IdHash<Person>,
  to: SHA256IdHash<Person>,
  maxDepth?: number
): Promise<TrustPath | null>
```

Calculate trust path between two persons through social graph.

**Parameters**:
- `from`: Starting person
- `to`: Target person
- `maxDepth`: Maximum path length (default: 6)

**Returns**: Trust path with bottleneck analysis, or null if no path exists

**Example**:
```typescript
const path = await trustModel.calculateTrustPath(aliceId, charlieId)
if (path && path.bottleneck >= 0.7) {
  console.log(`Trust path found with ${path.pathLength} hops`)
  console.log(`Weakest link: ${path.bottleneck}`)
}
```

---

```typescript
async buildSocialGraph(): Promise<SocialGraph>
```

Build social graph from all trust relationships.

**Returns**: Social graph with nodes, edges, clusters, and metrics

---

#### Attribution Methods

```typescript
async addAttribution(
  data: AttributionData
): Promise<Attribution>
```

Track content attribution ("who said what about what").

---

#### Licensing Methods

```typescript
async grantLicense(
  data: LicenseData
): Promise<License>
```

Grant license for content with machine-readable rules.

---

```typescript
async canAccess(
  person: SHA256IdHash<Person>,
  contentId: SHA256Hash,
  purpose: string
): Promise<AccessResult>
```

Check if person can access content based on licenses and trust.

**Returns**: Access result with allowed/denied and applicable licenses

---

#### Attestation Methods

```typescript
async createAttestation(
  data: AttestationData
): Promise<Attestation>
```

Create verification attestation with evidence.

---

#### Device Credentials Methods

```typescript
async getDeviceCredentials(): Promise<DeviceCredentials>
```

Get current device's credentials (person ID and public key).

---

```typescript
async setDeviceIdentity(
  deviceId: SHA256IdHash<Person>,
  publicKey: string
): Promise<void>
```

Set device identity (for external systems).

---

#### Events

```typescript
readonly onUpdated: OEvent<() => void>
readonly onTrustChanged: OEvent<(deviceId: SHA256IdHash<Person>, status: TrustStatus) => void>
readonly onCredentialsUpdated: OEvent<(deviceId: SHA256IdHash<Person>) => void>
readonly onTrustEstablished: OEvent<(edge: TrustEdge) => void>
readonly onTrustRevoked: OEvent<(edgeId: string, reason: string) => void>
readonly onGraphUpdated: OEvent<(graph: SocialGraph) => void>
```

---

### CAModel

**Purpose**: Certificate Authority operations - issue, manage, and verify certificates.

#### Constructor

```typescript
constructor(
  leuteModel: LeuteModel,
  trustedKeysManager?: TrustedKeysManager
)
```

#### Lifecycle Methods

```typescript
async init(): Promise<void>
```
Initialize CA. Loads existing root certificate if present.

**States**: Uninitialised → Initialised (→ CAReady if root exists)

---

```typescript
async shutdown(): Promise<void>
```

---

#### Root Certificate Methods

```typescript
async createRootCertificate(params: {
  domain?: string
  name?: string
  description?: string
  validUntil?: Date
}): Promise<RootCertificateData>
```

Create local root certificate for this CA instance.

**Example**:
```typescript
const root = await ca.createRootCertificate({
  domain: 'refinio.net',
  name: 'Refinio Certificate Authority',
  validUntil: undefined  // Perpetual
})
```

**State transition**: Initialised → CAReady

---

```typescript
async getRootCertificate(): Promise<RootCertificateData | null>
```

Get current root certificate for this CA.

---

```typescript
async publishRootToWeb(url: string): Promise<void>
```

Publish root certificate to web for external verification (optional).

**Parameters**:
- `url`: HTTPS URL (typically `https://domain/.well-known/certificates/root`)

**Example**:
```typescript
await ca.publishRootToWeb('https://refinio.net/.well-known/certificates/root')
```

---

#### Certificate Issuance Methods

```typescript
async issueCertificate(params: {
  subject: SHA256IdHash<Person>
  subjectPublicKey?: string
  certificateType: CertificateType
  validFor: Duration
  validFrom?: Date
  claims: Record<string, any>
  chainTo?: SHA256Hash<TrustKeysCertificate>
}): Promise<IssuedCertificate>
```

Issue a new certificate.

**Parameters**:
- `subject`: Person receiving the certificate
- `subjectPublicKey`: Subject's public key (fetched if not provided)
- `certificateType`: Type of certificate ('IdentityCertificate', 'DeviceCertificate', etc.)
- `validFor`: Validity duration (e.g., "12 months", "1 year")
- `validFrom`: Start date (default: now)
- `claims`: Certificate claims/attributes
- `chainTo`: Optional parent certificate (for chaining)

**Returns**: Issued certificate with version 1

**Example**:
```typescript
const cert = await ca.issueCertificate({
  subject: alicePersonId,
  certificateType: 'IdentityCertificate',
  validFor: '12 months',
  claims: {
    name: 'Alice Smith',
    email: 'alice@refinio.net',
    verificationLevel: 'government_id'
  }
})
```

**Requires**: CA must be in CAReady state (root certificate exists)

---

#### Certificate Lifecycle Methods

```typescript
async extendCertificate(
  certId: SHA256Hash<TrustKeysCertificate>,
  additionalDuration: Duration
): Promise<CertificateVersion>
```

Extend certificate validity by creating new version.

**Parameters**:
- `certId`: Certificate to extend
- `additionalDuration`: Additional time (e.g., "6 months")

**Returns**: New certificate version with extended validUntil

**Example**:
```typescript
const v2 = await ca.extendCertificate(certId, '6 months')
console.log(`Extended to version ${v2.version}`)
```

---

```typescript
async reduceCertificate(
  certId: SHA256Hash<TrustKeysCertificate>,
  newValidUntil: Date
): Promise<CertificateVersion>
```

Reduce certificate validity by creating new version.

**Parameters**:
- `certId`: Certificate to reduce
- `newValidUntil`: New expiration date (must be earlier than current, but still in future)

---

```typescript
async revokeCertificate(
  certId: SHA256Hash<TrustKeysCertificate>,
  reason: string
): Promise<CertificateVersion>
```

Revoke certificate by creating new version with validUntil in past.

**Parameters**:
- `certId`: Certificate to revoke
- `reason`: Revocation reason (e.g., 'Key compromised', 'Policy violation')

**Example**:
```typescript
const revoked = await ca.revokeCertificate(certId, 'Key compromised')
// Automatically propagates revocation urgently
```

---

#### Version Query Methods

```typescript
async getLatestVersion(
  certId: SHA256Hash<TrustKeysCertificate>
): Promise<CertificateVersion>
```

Get latest version of certificate.

---

```typescript
async getCertificateHistory(
  certId: SHA256Hash<TrustKeysCertificate>
): Promise<CertificateHistory>
```

Get complete version history of certificate.

**Returns**: All versions, transitions, and audit trail

**Example**:
```typescript
const history = await ca.getCertificateHistory(certId)
console.log(`Total versions: ${history.totalVersions}`)
console.log(`Current status: ${history.currentStatus}`)
history.transitions.forEach(t => {
  console.log(`  v${t.fromVersion} → v${t.toVersion}: ${t.type}`)
})
```

---

#### Verification Methods

```typescript
async verifyCertificate(
  cert: TrustKeysCertificate
): Promise<VerificationResult>
```

Verify a single certificate (signature and validity).

**Returns**: Verification result with valid/invalid and reason

---

```typescript
async verifyCertificateChain(
  cert: TrustKeysCertificate,
  rootCert?: RootCertificateData
): Promise<ChainVerificationResult>
```

Verify certificate chain back to root.

**Parameters**:
- `cert`: Certificate to verify
- `rootCert`: Optional root certificate (uses own root if not provided)

**Returns**: Chain verification result with all certificates in chain

---

#### Propagation Methods

```typescript
async propagateViaONECore(
  certId: SHA256Hash<TrustKeysCertificate>,
  version: number
): Promise<void>
```

Propagate certificate version via ONE.core native sync (CHUM).

---

```typescript
async propagateViaExternalDocument(
  certId: SHA256Hash<TrustKeysCertificate>,
  version: number,
  options?: {
    qrCode?: boolean
    email?: string
    download?: string
    webEndpoint?: string
    method?: string
  }
): Promise<ExportedVC>
```

Export certificate as portable W3C VC for external distribution.

**Returns**: Exported VC with various formats (JSON, QR code, URL)

**Example**:
```typescript
const exported = await ca.propagateViaExternalDocument(certId, 2, {
  qrCode: true,
  webEndpoint: 'https://refinio.net/certs/cert-abc-v2.json'
})

// Display QR code
displayQRCode(exported.formats.qrCode)
```

---

```typescript
async importExternalVC(
  vcDocument: string | VerifiableCredential
): Promise<ImportResult>
```

Import certificate from external W3C VC document.

**Parameters**:
- `vcDocument`: VC as JSON string or parsed object

**Returns**: Import result with success/failure and version info

**Example**:
```typescript
const imported = await ca.importExternalVC(vcJSON)
if (imported.imported) {
  console.log(`Imported version ${imported.version}`)
}
```

---

#### Events

```typescript
readonly onUpdated: OEvent<() => void>
readonly onCertificateIssued: OEvent<(cert: IssuedCertificate) => void>
readonly onCertificateRevoked: OEvent<(certId: SHA256Hash) => void>
readonly onRootCreated: OEvent<(root: RootCertificateData) => void>
```

---

### VCBridge

**Purpose**: Bidirectional conversion between ONE certificates and W3C Verifiable Credentials.

#### Constructor

```typescript
constructor()
```

#### Conversion Methods

```typescript
certificateToVC(
  certificate: TrustKeysCertificate
): VerifiableCredential
```

Convert ONE certificate to W3C Verifiable Credential.

**Example**:
```typescript
const vcBridge = new VCBridge()
const vc = vcBridge.certificateToVC(certificate)

// VC can now be shared with external systems
await sendVCToExternalParty(vc)
```

---

```typescript
async vcToCertificate(
  vc: VerifiableCredential
): Promise<TrustKeysCertificate>
```

Convert W3C Verifiable Credential to ONE certificate.

**Example**:
```typescript
const vc = await receiveVCFromExternal()
const certificate = await vcBridge.vcToCertificate(vc)

// Store in ONE.core
await storeVersionedObject(certificate)
```

---

```typescript
validateCompatibility(
  certificate: TrustKeysCertificate,
  vc: VerifiableCredential
): boolean
```

Validate structural compatibility between certificate and VC.

**Returns**: true if certificate and VC represent same data

---

```typescript
async testRoundTrip(
  certificate: TrustKeysCertificate
): Promise<boolean>
```

Test round-trip conversion: Certificate → VC → Certificate

**Returns**: true if round-trip preserves all data

---

## Services

### VCPropagation

**Purpose**: Manage certificate/VC propagation across network and external systems.

```typescript
class VCPropagation {
  async propagateToNetwork(
    cert: TrustKeysCertificate,
    peers: SHA256IdHash<Person>[]
  ): Promise<void>

  async subscribeToUpdates(
    certId: SHA256Hash<TrustKeysCertificate>,
    callback: (newVersion: CertificateVersion) => void
  ): Promise<void>

  async fetchLatestVersion(
    certId: SHA256Hash<TrustKeysCertificate>,
    fromPeers: SHA256IdHash<Person>[]
  ): Promise<CertificateVersion>
}
```

---

### AuditTrailService

**Purpose**: Track certificate usage and detect suspicious activity.

```typescript
class AuditTrailService {
  async recordUsageAttempt(
    audit: CertificateAudit
  ): Promise<void>

  async queryAuditTrail(
    certId: SHA256Hash<TrustKeysCertificate>
  ): Promise<CertificateAudit[]>

  async detectAnomalies(
    certId: SHA256Hash<TrustKeysCertificate>
  ): Promise<{
    suspiciousAttempts: number
    flaggedActors: SHA256IdHash<Person>[]
  }>
}
```

---

## Plans (RPC)

### TrustPlan

**Purpose**: Transport-agnostic RPC interface for trust operations (used by platforms).

All methods follow request/response pattern:

```typescript
// Request
{
  deviceId: SHA256IdHash<Person>
  publicKey: string
  status: TrustStatus
  options?: TrustOptions
}

// Response
{
  success: boolean
  error?: string
  data?: any
}
```

#### Methods

```typescript
async setTrustStatus(event: IpcMainInvokeEvent, request: SetTrustStatusRequest): Promise<SetTrustStatusResponse>
async getTrustStatus(event: IpcMainInvokeEvent, request: GetTrustStatusRequest): Promise<GetTrustStatusResponse>
async getTrustedDevices(event: IpcMainInvokeEvent): Promise<GetTrustedDevicesResponse>
async verifyDeviceKey(event: IpcMainInvokeEvent, request: VerifyDeviceKeyRequest): Promise<VerifyDeviceKeyResponse>
async evaluateTrust(event: IpcMainInvokeEvent, request: EvaluateTrustRequest): Promise<EvaluateTrustResponse>
async getDeviceCredentials(event: IpcMainInvokeEvent): Promise<GetDeviceCredentialsResponse>
```

**Usage** (in Electron main process):
```typescript
import { TrustPlan } from '@trust/core/plans/TrustPlan.js'

const trustPlan = new TrustPlan(trustModel)

ipcMain.handle('trust:setStatus', trustPlan.setTrustStatus)
ipcMain.handle('trust:getStatus', trustPlan.getTrustStatus)
```

---

### CAPlan

**Purpose**: Transport-agnostic RPC interface for CA operations.

#### Methods

```typescript
async createRoot(event: IpcMainInvokeEvent, request: CreateRootRequest): Promise<CreateRootResponse>
async issueCertificate(event: IpcMainInvokeEvent, request: IssueCertificateRequest): Promise<IssueCertificateResponse>
async extendCertificate(event: IpcMainInvokeEvent, request: ExtendCertificateRequest): Promise<ExtendCertificateResponse>
async revokeCertificate(event: IpcMainInvokeEvent, request: RevokeCertificateRequest): Promise<RevokeCertificateResponse>
async getHistory(event: IpcMainInvokeEvent, request: GetHistoryRequest): Promise<GetHistoryResponse>
```

---

## Recipes

### TrustRelationship

**Versioned object** for device-level trust relationships.

```typescript
interface TrustRelationshipData {
  $type$: 'TrustRelationship'
  $version$: number

  peer: SHA256IdHash<Person>
  peerPublicKey: string
  status: 'trusted' | 'untrusted' | 'pending' | 'revoked'
  trustLevel?: 'full' | 'limited' | 'temporary'
  establishedAt: string  // ISO 8601
  lastVerified: string
  validUntil?: string
  verificationMethod?: string
  verificationProof?: SHA256Hash
  reason?: string
  context?: string
  permissions?: TrustPermissions
}
```

**Reverse Map**: Indexed by `peer` for fast lookups

---

### RootCertificate

**Versioned object with ID** for CA root certificates.

```typescript
interface RootCertificateData {
  $type$: 'RootCertificate'

  id: SHA256IdHash<RootCertificate>  // isId: true
  caInstanceId: SHA256IdHash<Person>
  domain?: string
  publicKey: string
  keyType: 'Ed25519'
  createdAt: string
  validFrom: string
  validUntil?: string
  webUrl?: string
  publishedAt?: string
  name?: string
  description?: string
  proof: W3CProof
}
```

---

### TrustEdge

**Unversioned** social trust relationship.

```typescript
interface TrustEdgeData {
  $type$: 'TrustEdge'

  from: SHA256IdHash<Person>
  to: SHA256IdHash<Person>
  reciprocal: boolean
  level: 'invited' | 'known' | 'verified' | 'trusted' | 'core'
  confidence: number  // 0-1
  origin: 'invite' | 'verification' | 'endorsement' | 'interaction' | 'imported'
  established: string
  lastVerified: string
  chainDepth: number
  pathTrust: number
  interactions: number
  endorsements: number
  disputes: number
  scope?: {
    domains?: string[]
    capabilities?: string[]
    contexts?: string[]
  }
  revoked: boolean
  revokedAt?: string
  revocationReason?: string
}
```

---

### Attribution

**Versioned** content attribution tracking.

```typescript
interface AttributionData {
  $type$: 'Attribution'

  content: {
    type: string
    id: SHA256Hash
    hash: SHA256Hash
    summary: string
  }
  author: SHA256IdHash<Person>
  contributors: Array<{
    person: SHA256IdHash<Person>
    role: string
    contribution: string
    timestamp: string
  }>
  subject: {
    type: string
    topics: string[]
    entities: Array<{name: string, type: string}>
  }
  derivedFrom?: Array<{
    type: 'quote' | 'reference' | 'translation' | 'summary' | 'remix'
    source: SHA256Hash
    author: SHA256IdHash<Person>
  }>
  verified: boolean
  verifiedBy?: SHA256IdHash<Person>
  license?: SHA256Hash<License>
  attributionRequired: boolean
}
```

---

### License

**Versioned** machine-readable licensing.

```typescript
interface LicenseData {
  $type$: 'License'

  name: string
  licensor: SHA256IdHash<Person>
  content: {
    type: string
    id: SHA256Hash
  }
  rules: LicenseRule[]
  permissions: Permission[]
  requirements: Requirement[]
  prohibitions: Prohibition[]
  constraints?: {
    temporal?: {
      validFrom: string
      validUntil: string
      renewable: boolean
    }
    geographic?: {
      allowed: string[]
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
      trustedOnly: boolean
      minTrustLevel: number
    }
  }
  attribution?: {
    required: boolean
    text: string
    url?: string
    placement?: string
  }
}
```

---

### Attestation

**Versioned** verification claims (certificate-compliant).

```typescript
interface AttestationData {
  $type$: 'Attestation'

  subject: {
    type: string
    id: SHA256IdHash
    property?: string
  }
  issuer: SHA256IdHash<Person>
  license: SHA256Hash<License>  // Required for certificate compliance
  attestationType: 'identity' | 'correctness' | 'expertise' | 'quality' | 'completion' | 'authenticity'
  claim: {
    statement: string
    confidence: number  // 0-1
    context?: string
    conditions?: string[]
  }
  evidence: Evidence[]
  verification: {
    method: string
    verifiedBy: SHA256IdHash<Person>
    verifiedAt: string
    expires?: string
    renewable?: boolean
  }
  scope?: {
    domains?: string[]
    temporal?: {
      validFrom: string
      validUntil: string
    }
    limitations?: string[]
  }
  qualityMetrics?: {
    accuracy?: number
    precision?: number
    reliability?: number
    coverage?: number
  }
  proof: W3CProof
}
```

---

## Types

### Core Types

```typescript
type SHA256Hash<T = any> = string & { __brand: 'SHA256Hash', __type: T }
type SHA256IdHash<T> = string & { __brand: 'SHA256IdHash', __type: T }

type TrustStatus = 'trusted' | 'untrusted' | 'pending' | 'revoked'
type TrustLevel = 'invited' | 'known' | 'verified' | 'trusted' | 'core'
type CertificateType = 'IdentityCertificate' | 'DeviceCertificate' | 'TrustCertificate' | 'AttestationCertificate' | 'DomainCertificate'
type Duration = string  // "12 months", "1 year", "90 days", or ISO 8601 duration
```

---

**Status**: Complete API documentation
**Next**: Integration guide for platforms
