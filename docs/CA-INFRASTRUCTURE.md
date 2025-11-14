# Certificate Authority Infrastructure

**Decentralized CA model where every ONE instance can issue and manage certificates**

Version: 1.0.0
Last Updated: 2025-01-09

---

## Table of Contents

1. [Overview](#overview)
2. [Local Root Certificate](#local-root-certificate)
3. [CAModel Architecture](#camodel-architecture)
4. [Certificate Issuance](#certificate-issuance)
5. [Certificate Types](#certificate-types)
6. [Certificate Chains](#certificate-chains)
7. [Web Publication](#web-publication)
8. [Trust Between CAs](#trust-between-cas)
9. [Implementation Details](#implementation-details)

---

## Overview

### Decentralized CA Model

Unlike traditional PKI with centralized root authorities, the ONE platform enables **every instance to be a Certificate Authority**:

```
Traditional PKI               ONE Platform CA
─────────────────            ─────────────────
     Root CA                  Local Root (Instance A)
        │                            │
   ┌────┴────┐                  ┌────┴────┐
  CA1       CA2                Cert1    Cert2
   │         │
Cert1      Cert2              Local Root (Instance B)
                                     │
                                ┌────┴────┐
                               Cert3    Cert4
```

**Key Differences**:
- **No central authority** - Each instance is sovereign
- **Domain-based namespacing** - Optional domains (e.g., refinio.net)
- **Cross-CA trust via social graph** - Trust between CAs through attestations
- **Local root is authoritative** - Web publication is optional

### Design Principles

1. **Self-Sovereign**: Each instance controls its own root of trust
2. **Decentralized**: No dependency on central infrastructure
3. **Cryptographically Verifiable**: All certificates signed with Ed25519
4. **Time-Bound**: All certificates have validity periods
5. **Versioned**: Certificate lifecycle managed via ONE.core versions
6. **Optional Web**: Can publish to web for external verification, but not required

---

## Local Root Certificate

### Purpose

The **RootCertificate** is the foundation of an instance's certificate authority:

- Self-signed (root of trust)
- Stored in ONE.core as versioned object
- Private key in secure keychain (never exported)
- MAY be published to web for external verification
- Can have optional expiration (or perpetual)

### Recipe Definition

```typescript
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { Person } from '@refinio/one.core/lib/recipes.js'
import { Recipe } from '@refinio/one.core/lib/recipes.js'

export interface RootCertificateData {
  $type$: 'RootCertificate'

  // Identity
  id: SHA256IdHash<RootCertificate>    // Root cert ID (isId: true)
  caInstanceId: SHA256IdHash<Person>   // CA's person ID
  domain?: string                       // Optional domain (e.g., "refinio.net")

  // Keys
  publicKey: string                     // Ed25519 public key (hex or base58)
  keyType: 'Ed25519'                    // Algorithm

  // Validity
  createdAt: string                     // ISO 8601 timestamp
  validFrom: string                     // ISO 8601 timestamp
  validUntil?: string                   // Optional expiration (ISO 8601)

  // Web Publication (optional)
  webUrl?: string                       // HTTPS URL if published
  publishedAt?: string                  // ISO 8601 timestamp

  // Metadata
  name?: string                         // Human-readable CA name
  description?: string                  // CA description

  // Self-signature
  proof: {
    type: 'Ed25519Signature2020'
    created: string                     // ISO 8601
    verificationMethod: string          // Reference to publicKey
    proofPurpose: 'assertionMethod'
    proofValue: string                  // Base58-btc signature
  }
}

export const RootCertificate = Recipe<RootCertificateData>('RootCertificate', {
  $type$: 'recipe',
  name: 'RootCertificate',
  rule: [
    { itemprop: 'id', isId: true, itemtype: { type: 'string' } },
    { itemprop: 'caInstanceId', itemtype: { type: 'idHash', object: 'Person' } },
    { itemprop: 'domain', optional: true, itemtype: { type: 'string' } },
    { itemprop: 'publicKey', itemtype: { type: 'string' } },
    { itemprop: 'keyType', itemtype: { type: 'string' } },
    { itemprop: 'createdAt', itemtype: { type: 'string' } },
    { itemprop: 'validFrom', itemtype: { type: 'string' } },
    { itemprop: 'validUntil', optional: true, itemtype: { type: 'string' } },
    { itemprop: 'webUrl', optional: true, itemtype: { type: 'string' } },
    { itemprop: 'publishedAt', optional: true, itemtype: { type: 'string' } },
    { itemprop: 'name', optional: true, itemtype: { type: 'string' } },
    { itemprop: 'description', optional: true, itemtype: { type: 'string' } },
    { itemprop: 'proof', itemtype: { type: 'object' } }
  ]
})

// Reverse map for querying
export const RootCertificateReverseMap = Recipe('RootCertificateReverseMap', {
  $type$: 'reverseMap',
  name: 'RootCertificateReverseMap',
  idHash: 'RootCertificate',
  reverseMapIdHash: 'caInstanceId'
})

// Module augmentation
declare module '@OneObjectInterfaces' {
  export interface OneVersionedObjectInterfaces {
    RootCertificate: RootCertificateData
  }
}
```

### Root Certificate Creation

```typescript
// Step 1: Generate keys (or use existing person keys)
const { publicKey, privateKey } = await generateEd25519KeyPair()

// Step 2: Create root certificate data
const rootCertData: RootCertificateData = {
  $type$: 'RootCertificate',
  id: generateRootCertId(),
  caInstanceId: await getLocalInstanceOfPerson(),
  domain: 'refinio.net',  // Optional
  publicKey: encodePublicKey(publicKey),
  keyType: 'Ed25519',
  createdAt: new Date().toISOString(),
  validFrom: new Date().toISOString(),
  validUntil: undefined,  // Perpetual
  name: 'Refinio Certificate Authority',
  description: 'Official Refinio CA for identity verification',
  proof: null  // Will be added after signing
}

// Step 3: Self-sign
const signature = await sign(privateKey, canonicalize(rootCertData))

rootCertData.proof = {
  type: 'Ed25519Signature2020',
  created: new Date().toISOString(),
  verificationMethod: `did:one:${rootCertData.caInstanceId}#key-1`,
  proofPurpose: 'assertionMethod',
  proofValue: base58btc.encode(signature)
}

// Step 4: Store in ONE.core
await storeVersionedObject(rootCertData)

// Step 5: Optionally publish to web
await publishRootToWeb(rootCertData, 'https://refinio.net/.well-known/certificates/root')
```

### Root Certificate Verification

```typescript
async function verifyRootCertificate(
  rootCert: RootCertificateData
): Promise<boolean> {
  // 1. Check self-signature
  const { proof, ...dataToSign } = rootCert
  const signature = base58btc.decode(proof.proofValue)
  const publicKey = decodePublicKey(rootCert.publicKey)

  const isValidSignature = await verify(
    publicKey,
    signature,
    canonicalize(dataToSign)
  )

  if (!isValidSignature) {
    return false
  }

  // 2. Check validity period
  const now = new Date()
  const validFrom = new Date(rootCert.validFrom)
  const validUntil = rootCert.validUntil ? new Date(rootCert.validUntil) : null

  if (now < validFrom) {
    return false  // Not yet valid
  }

  if (validUntil && now > validUntil) {
    return false  // Expired
  }

  return true
}
```

---

## CAModel Architecture

### Model Interface

```typescript
import { Model } from '@refinio/one.models/lib/models/Model.js'
import { StateMachine } from '@refinio/one.models/lib/misc/StateMachine.js'
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js'
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { Person } from '@refinio/one.core/lib/recipes.js'
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js'
import type TrustedKeysManager from '@refinio/one.models/lib/models/Leute/TrustedKeysManager.js'

export class CAModel implements Model {
  public readonly onUpdated = new OEvent<() => void>()
  public readonly onCertificateIssued = new OEvent<(cert: IssuedCertificate) => void>()
  public readonly onCertificateRevoked = new OEvent<(certId: SHA256Hash) => void>()
  public readonly onRootCreated = new OEvent<(root: RootCertificateData) => void>()

  public state: StateMachine<
    'Uninitialised' | 'Initialised' | 'CAReady',
    'init' | 'createRoot' | 'shutdown'
  >

  private leuteModel: LeuteModel
  private trustedKeysManager?: TrustedKeysManager
  private rootCertificate?: RootCertificateData
  private caInstanceId?: SHA256IdHash<Person>

  constructor(
    leuteModel: LeuteModel,
    trustedKeysManager?: TrustedKeysManager
  ) {
    this.leuteModel = leuteModel
    this.trustedKeysManager = trustedKeysManager

    // Setup state machine
    this.state = new StateMachine()
    this.state.addState('Uninitialised')
    this.state.addState('Initialised')
    this.state.addState('CAReady')
    this.state.setInitialState('Uninitialised')
    this.state.addEvent('init')
    this.state.addEvent('createRoot')
    this.state.addEvent('shutdown')
    this.state.addTransition('init', 'Uninitialised', 'Initialised')
    this.state.addTransition('createRoot', 'Initialised', 'CAReady')
    this.state.addTransition('shutdown', 'CAReady', 'Uninitialised')
  }

  async init(): Promise<void>
  async shutdown(): Promise<void>

  // Root certificate management
  async createRootCertificate(params: CreateRootParams): Promise<RootCertificateData>
  async getRootCertificate(): Promise<RootCertificateData | null>
  async publishRootToWeb(url: string): Promise<void>

  // Certificate issuance
  async issueCertificate(params: IssueCertificateParams): Promise<IssuedCertificate>

  // Certificate lifecycle
  async extendCertificate(
    certId: SHA256Hash<TrustKeysCertificate>,
    additionalDuration: Duration
  ): Promise<CertificateVersion>

  async reduceCertificate(
    certId: SHA256Hash<TrustKeysCertificate>,
    newValidUntil: Date
  ): Promise<CertificateVersion>

  async revokeCertificate(
    certId: SHA256Hash<TrustKeysCertificate>,
    reason: string
  ): Promise<CertificateVersion>

  // Version management
  async getLatestVersion(
    certId: SHA256Hash<TrustKeysCertificate>
  ): Promise<CertificateVersion>

  async getCertificateHistory(
    certId: SHA256Hash<TrustKeysCertificate>
  ): Promise<CertificateVersion[]>

  // Verification
  async verifyCertificate(
    cert: TrustKeysCertificate
  ): Promise<VerificationResult>

  async verifyCertificateChain(
    cert: TrustKeysCertificate,
    rootCert?: RootCertificateData
  ): Promise<ChainVerificationResult>
}
```

### Initialization

```typescript
async init(): Promise<void> {
  if (this.state.currentState !== 'Uninitialised') {
    return
  }

  // Get CA instance ID (this instance's person ID)
  this.caInstanceId = await this.leuteModel.getLocalInstanceOfPerson()

  // Check for existing root certificate
  this.rootCertificate = await this.loadRootCertificate()

  // Transition to Initialised
  this.state.triggerEvent('init')

  // If root exists, transition to CAReady
  if (this.rootCertificate) {
    this.state.triggerEvent('createRoot')
  }
}

private async loadRootCertificate(): Promise<RootCertificateData | null> {
  const entries = await getAllEntries(
    RootCertificateReverseMap,
    this.caInstanceId
  )

  if (entries.length === 0) {
    return null
  }

  // Get latest version if multiple exist
  return entries[0].obj as RootCertificateData
}
```

---

## Certificate Issuance

### Issuance Parameters

```typescript
interface IssueCertificateParams {
  // Subject
  subject: SHA256IdHash<Person>
  subjectPublicKey?: string              // Optional, can fetch from Person

  // Certificate type
  certificateType: CertificateType

  // Validity period
  validFor: Duration                     // e.g., "12 months", "1 year", "90 days"
  validFrom?: Date                       // Default: now

  // Claims
  claims: Record<string, any>

  // Chaining (optional)
  chainTo?: SHA256Hash<TrustKeysCertificate>  // Parent certificate
}

type CertificateType =
  | 'IdentityCertificate'
  | 'DeviceCertificate'
  | 'TrustCertificate'
  | 'AttestationCertificate'
  | 'DomainCertificate'
  | 'OrganizationCertificate'

type Duration = string  // ISO 8601 duration or human-readable
```

### Issuance Flow

```typescript
async issueCertificate(
  params: IssueCertificateParams
): Promise<IssuedCertificate> {
  // 1. Ensure CA is ready
  if (this.state.currentState !== 'CAReady') {
    throw new Error('CA not initialized with root certificate')
  }

  // 2. Get subject's public key if not provided
  const subjectPublicKey = params.subjectPublicKey ||
    await this.getPublicKeyForPerson(params.subject)

  // 3. Calculate validity period
  const validFrom = params.validFrom || new Date()
  const validUntil = this.calculateValidUntil(validFrom, params.validFor)

  // 4. Build certificate
  const certificate: TrustKeysCertificate = {
    $type$: 'TrustKeysCertificate',
    issuer: this.caInstanceId!,
    subject: params.subject,
    subjectPublicKey,
    validFrom,
    validUntil,
    certificateType: params.certificateType,
    claims: params.claims,
    chainedTo: params.chainTo,  // Optional parent cert
    proof: null  // Will be added after signing
  }

  // 5. Sign certificate
  const cryptoApi = await this.leuteModel.getCryptoApi()
  const dataToSign = canonicalize({
    ...certificate,
    proof: undefined
  })
  const signature = await cryptoApi.sign(dataToSign)

  certificate.proof = {
    signature,
    signer: this.caInstanceId!,
    signedAt: new Date()
  }

  // 6. Store certificate (version 1)
  await storeVersionedObject(certificate)

  // 7. Optionally issue TrustKeysCertificate via TrustedKeysManager
  if (this.trustedKeysManager) {
    await this.trustedKeysManager.issueCertificate(certificate)
  }

  // 8. Emit event
  const issued: IssuedCertificate = {
    certificate,
    version: 1,
    issuedAt: new Date(),
    expiresAt: validUntil
  }
  this.onCertificateIssued.emit(issued)

  return issued
}

private calculateValidUntil(validFrom: Date, duration: Duration): Date {
  // Parse duration (ISO 8601 or human-readable)
  const ms = parseDuration(duration)  // e.g., "12 months" → ms
  return new Date(validFrom.getTime() + ms)
}

// Helper: Parse duration strings
function parseDuration(duration: Duration): number {
  // Support ISO 8601: "P1Y" (1 year), "P6M" (6 months), "P90D" (90 days)
  // Support human: "12 months", "1 year", "90 days"

  const patterns = {
    years: /(\d+)\s*years?/i,
    months: /(\d+)\s*months?/i,
    weeks: /(\d+)\s*weeks?/i,
    days: /(\d+)\s*days?/i,
    hours: /(\d+)\s*hours?/i
  }

  let totalMs = 0

  for (const [unit, pattern] of Object.entries(patterns)) {
    const match = duration.match(pattern)
    if (match) {
      const value = parseInt(match[1])
      totalMs += convertToMs(value, unit)
    }
  }

  if (totalMs === 0) {
    throw new Error(`Invalid duration: ${duration}`)
  }

  return totalMs
}
```

### Issued Certificate Result

```typescript
interface IssuedCertificate {
  certificate: TrustKeysCertificate
  version: number                        // Initial version (1)
  issuedAt: Date
  expiresAt: Date
  certificateId: SHA256Hash<TrustKeysCertificate>
  vcPresentation?: VerifiableCredential  // Optional VC
}
```

---

## Certificate Types

### Identity Certificate

Verifies a person's identity with claims:

```typescript
await ca.issueCertificate({
  subject: alicePersonId,
  certificateType: 'IdentityCertificate',
  validFor: '12 months',
  claims: {
    name: 'Alice Smith',
    email: 'alice@refinio.net',
    dateOfBirth: '1990-01-15',
    nationality: 'US',
    verificationLevel: 'government_id',  // Level of verification
    verificationMethod: 'passport',
    verifiedAt: new Date().toISOString(),
    verifiedBy: verifierPersonId
  }
})
```

### Device Certificate

Certifies a device belongs to a person:

```typescript
await ca.issueCertificate({
  subject: devicePersonId,
  certificateType: 'DeviceCertificate',
  validFor: '90 days',
  claims: {
    deviceType: 'smartphone',
    manufacturer: 'Apple',
    model: 'iPhone 15',
    osVersion: 'iOS 17',
    ownership: 'owner',
    registeredAt: new Date().toISOString(),
    macAddress: 'AA:BB:CC:DD:EE:FF'
  }
})
```

### Trust Certificate

Attests to trust relationship:

```typescript
await ca.issueCertificate({
  subject: bobPersonId,
  certificateType: 'TrustCertificate',
  validFor: '6 months',
  claims: {
    trustLevel: 'verified',
    trustEstablished: new Date().toISOString(),
    verificationMethod: 'video_call',
    trustScope: ['communication', 'file_sharing'],
    mutualContacts: 5
  }
})
```

### Domain Certificate

Certifies control of a domain:

```typescript
await ca.issueCertificate({
  subject: organizationPersonId,
  certificateType: 'DomainCertificate',
  validFor: '1 year',
  claims: {
    domain: 'refinio.net',
    verificationMethod: 'dns_txt_record',
    txtRecord: 'one-verification=abc123...',
    verifiedAt: new Date().toISOString()
  }
})
```

---

## Certificate Chains

### Chain Structure

Certificates can chain to parent certificates:

```
Root Certificate
    ↓ (issues)
Domain Certificate (refinio.net)
    ↓ (issues)
Organization Certificate (Refinio GmbH)
    ↓ (issues)
Identity Certificate (Alice @ Refinio)
    ↓ (issues)
Device Certificate (Alice's iPhone)
```

### Chain Verification

```typescript
async verifyCertificateChain(
  cert: TrustKeysCertificate,
  rootCert?: RootCertificateData
): Promise<ChainVerificationResult> {
  const chain: TrustKeysCertificate[] = []
  let currentCert = cert

  // Build chain by following chainedTo references
  while (currentCert) {
    chain.push(currentCert)

    if (!currentCert.chainedTo) {
      break  // Reached end of chain
    }

    // Fetch parent certificate
    currentCert = await loadVersionedObject<TrustKeysCertificate>(
      currentCert.chainedTo
    )
  }

  // Verify each link in chain
  for (let i = 0; i < chain.length; i++) {
    const cert = chain[i]
    const parentCert = chain[i + 1]

    // Verify certificate signature
    const isValidSignature = await this.verifyCertificateSignature(
      cert,
      parentCert || rootCert
    )

    if (!isValidSignature) {
      return {
        valid: false,
        reason: `Invalid signature at chain level ${i}`,
        chain,
        failedAt: i
      }
    }

    // Verify validity period
    const isValidPeriod = this.isWithinValidityPeriod(cert)
    if (!isValidPeriod) {
      return {
        valid: false,
        reason: `Certificate expired at chain level ${i}`,
        chain,
        failedAt: i
      }
    }
  }

  // Verify root certificate
  if (rootCert) {
    const isValidRoot = await verifyRootCertificate(rootCert)
    if (!isValidRoot) {
      return {
        valid: false,
        reason: 'Invalid root certificate',
        chain,
        failedAt: chain.length
      }
    }
  }

  return {
    valid: true,
    chain,
    rootCert: rootCert || null
  }
}
```

---

## Web Publication

### Publishing Root Certificate

Optional: Publish root certificate to web for external verification:

```typescript
async publishRootToWeb(url: string): Promise<void> {
  if (!this.rootCertificate) {
    throw new Error('No root certificate to publish')
  }

  // 1. Convert to W3C VC format
  const vcBridge = new VCBridge()
  const vc = await vcBridge.certificateToVC(this.rootCertificate)

  // 2. Publish to HTTPS endpoint
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/ld+json'
    },
    body: JSON.stringify(vc, null, 2)
  })

  if (!response.ok) {
    throw new Error(`Failed to publish root: ${response.statusText}`)
  }

  // 3. Update root certificate with web URL
  const updatedRoot = {
    ...this.rootCertificate,
    webUrl: url,
    publishedAt: new Date().toISOString()
  }

  // 4. Store new version
  await storeVersionedObject(updatedRoot)
  this.rootCertificate = updatedRoot
}
```

### .well-known URL Pattern

Standard location for root certificates:

```
https://{domain}/.well-known/certificates/root

Examples:
https://refinio.net/.well-known/certificates/root
https://mycompany.com/.well-known/certificates/root
https://alice-personal.one/.well-known/certificates/root
```

### Fetching Root from Web

```typescript
async fetchRootFromWeb(domain: string): Promise<RootCertificateData | null> {
  const url = `https://${domain}/.well-known/certificates/root`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const vc = await response.json() as VerifiableCredential

    // Convert VC back to RootCertificate
    const vcBridge = new VCBridge()
    const rootCert = await vcBridge.vcToCertificate(vc) as RootCertificateData

    // Verify it's a valid root
    const isValid = await verifyRootCertificate(rootCert)
    if (!isValid) {
      throw new Error('Invalid root certificate from web')
    }

    return rootCert

  } catch (error) {
    console.error(`Failed to fetch root from ${url}:`, error)
    return null
  }
}
```

---

## Trust Between CAs

### Cross-CA Trust via Social Graph

CAs trust each other through the social graph:

```
CA Alice                    CA Bob
   ↓                           ↓
Trust Edge                Trust Edge
(Alice → Bob)             (Bob → Charlie)
   ↓                           ↓
Trust Path Calculation
(Alice → Bob → Charlie)
```

### Trust Decision for External Certificate

```typescript
async shouldTrustExternalCertificate(
  cert: TrustKeysCertificate,
  issuerCA: RootCertificateData
): Promise<TrustDecision> {
  // 1. Verify certificate chain to issuer's root
  const chainResult = await this.verifyCertificateChain(cert, issuerCA)
  if (!chainResult.valid) {
    return {
      trust: false,
      reason: `Invalid certificate chain: ${chainResult.reason}`
    }
  }

  // 2. Check if we have direct trust to issuer CA
  const directTrust = await trustModel.getTrustStatus(issuerCA.caInstanceId)
  if (directTrust?.status === 'trusted') {
    return {
      trust: true,
      reason: 'Directly trusted CA',
      trustLevel: 'direct'
    }
  }

  // 3. Calculate trust path to issuer CA via social graph
  const trustPath = await trustModel.calculateTrustPath(
    this.caInstanceId!,
    issuerCA.caInstanceId
  )

  if (trustPath && trustPath.totalTrust >= 0.7) {
    return {
      trust: true,
      reason: `Trust path via ${trustPath.pathLength} intermediaries`,
      trustLevel: 'indirect',
      trustScore: trustPath.totalTrust
    }
  }

  // 4. Check for attestations
  const attestations = await this.findAttestationsFor(issuerCA.caInstanceId)
  if (attestations.length > 0) {
    const avgConfidence = attestations.reduce((sum, a) => sum + a.claim.confidence, 0) / attestations.length

    if (avgConfidence >= 0.8) {
      return {
        trust: true,
        reason: `Attested by ${attestations.length} trusted parties`,
        trustLevel: 'attested',
        trustScore: avgConfidence
      }
    }
  }

  // 5. Fallback: Require user approval
  return {
    trust: false,
    reason: 'Unknown CA - requires user approval',
    requiresApproval: true
  }
}
```

### Importing External Root

```typescript
async importExternalRoot(
  rootCert: RootCertificateData,
  trustLevel: TrustStatus
): Promise<void> {
  // 1. Verify root certificate
  const isValid = await verifyRootCertificate(rootCert)
  if (!isValid) {
    throw new Error('Invalid external root certificate')
  }

  // 2. Store root certificate
  await storeVersionedObject(rootCert)

  // 3. Create trust relationship to CA
  await trustModel.setTrustStatus(
    rootCert.caInstanceId,
    rootCert.publicKey,
    trustLevel,
    {
      reason: 'Imported external CA root',
      context: 'ca_import',
      verificationMethod: 'manual_import'
    }
  )
}
```

---

## Implementation Details

### State Management

```typescript
// States
Uninitialised → init → Initialised → createRoot → CAReady
                                       ↓
                                   shutdown
                                       ↓
                                 Uninitialised

// State invariants
- Uninitialised: No root certificate
- Initialised: Can load/create root
- CAReady: Can issue certificates
```

### Error Handling

```typescript
class CAError extends Error {
  constructor(
    message: string,
    public code: CAErrorCode,
    public details?: any
  ) {
    super(message)
    this.name = 'CAError'
  }
}

enum CAErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  ROOT_NOT_FOUND = 'ROOT_NOT_FOUND',
  INVALID_DURATION = 'INVALID_DURATION',
  SIGNING_FAILED = 'SIGNING_FAILED',
  STORAGE_FAILED = 'STORAGE_FAILED',
  WEB_PUBLISH_FAILED = 'WEB_PUBLISH_FAILED',
  INVALID_CERTIFICATE = 'INVALID_CERTIFICATE',
  CHAIN_VERIFICATION_FAILED = 'CHAIN_VERIFICATION_FAILED'
}
```

### Logging

```typescript
// Structured logging for CA operations
async issueCertificate(params: IssueCertificateParams): Promise<IssuedCertificate> {
  console.log('[CAModel] Issuing certificate:', {
    subject: params.subject,
    type: params.certificateType,
    validFor: params.validFor
  })

  try {
    const cert = await this.performIssuance(params)

    console.log('[CAModel] Certificate issued successfully:', {
      certId: await hashObject(cert.certificate),
      version: cert.version,
      expiresAt: cert.expiresAt
    })

    return cert

  } catch (error) {
    console.error('[CAModel] Certificate issuance failed:', {
      subject: params.subject,
      error: error.message
    })
    throw error
  }
}
```

---

## Security Considerations

1. **Private Key Protection**: Root private key never leaves secure keychain
2. **Signature Verification**: Always verify signatures before trusting certificates
3. **Validity Checks**: Enforce validity periods strictly
4. **Chain Validation**: Verify entire chain back to trusted root
5. **Revocation Checks**: Check for revoked versions before trusting
6. **Web Publication Security**: Use HTTPS only, validate TLS certificates
7. **Cross-CA Trust**: Require high trust scores for automatic acceptance

---

## Testing Strategy

### Unit Tests

```typescript
describe('CAModel', () => {
  it('should create root certificate', async () => {
    const root = await ca.createRootCertificate({...})
    expect(root.caInstanceId).toBeDefined()
    expect(await verifyRootCertificate(root)).toBe(true)
  })

  it('should issue identity certificate', async () => {
    const cert = await ca.issueCertificate({
      subject: aliceId,
      certificateType: 'IdentityCertificate',
      validFor: '12 months',
      claims: { name: 'Alice' }
    })
    expect(cert.version).toBe(1)
  })

  it('should verify certificate chain', async () => {
    const result = await ca.verifyCertificateChain(cert, root)
    expect(result.valid).toBe(true)
  })
})
```

### Integration Tests

```typescript
describe('CAModel Integration', () => {
  it('should work with TrustedKeysManager', async () => {
    const cert = await ca.issueCertificate({...})
    const trustInfo = await trustedKeysManager.getKeyTrustInfo(cert.subjectPublicKey)
    expect(trustInfo.trusted).toBe(true)
  })

  it('should publish and fetch root from web', async () => {
    await ca.publishRootToWeb('https://test.com/.well-known/certificates/root')
    const fetched = await fetchRootFromWeb('test.com')
    expect(fetched).toEqual(ca.getRootCertificate())
  })
})
```

---

**Status**: Design complete, ready for implementation
**Dependencies**: LeuteModel, TrustedKeysManager, VCBridge
**Next**: Implement CAModel class with root certificate management
