# VC ↔ Certificate Bridge Architecture

**Bidirectional structural compatibility between ONE certificates and W3C Verifiable Credentials**

Version: 1.0.0
Last Updated: 2025-01-09

---

## Overview

The VCBridge provides seamless translation between:
- **ONE Platform Certificates** (internal storage format)
- **W3C Verifiable Credentials** (presentation/interop format)

**Core Principle**: Any certificate can be presented as a VC, and any VC can be stored as a certificate.

---

## Structural Mapping

### Certificate → VC

```typescript
// ONE Certificate (Storage)
TrustKeysCertificate {
  issuer: SHA256IdHash<Person>           → VC.issuer
  subject: SHA256IdHash<Person>          → VC.credentialSubject.id
  subjectPublicKey: string               → VC.credentialSubject.publicKey
  validFrom: Date                        → VC.issuanceDate
  validUntil: Date                       → VC.expirationDate
  certificateType: string                → VC.type[]
  claims: Record<string, any>            → VC.credentialSubject.*
  proof: Signature                       → VC.proof
}

// W3C Verifiable Credential (Presentation)
VerifiableCredential {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://w3id.org/security/v2",
    "https://one.refinio.net/contexts/trust/v1"
  ]
  "id": string                           ← Generated or from certificate
  "type": ["VerifiableCredential", ...]  ← From certificateType
  "issuer": string                       ← DID from issuer hash
  "issuanceDate": string                 ← ISO 8601 from validFrom
  "expirationDate": string               ← ISO 8601 from validUntil
  "credentialSubject": {
    "id": string                         ← DID from subject hash
    "publicKey": string                  ← From subjectPublicKey
    ...                                  ← Additional claims
  }
  "proof": {
    "type": "Ed25519Signature2020"
    "created": string
    "verificationMethod": string
    "proofPurpose": "assertionMethod"
    "proofValue": string                 ← From certificate signature
  }

  // ONE-specific extensions
  "oneIssuer": SHA256Hash                ← Original issuer hash
  "oneSubject": SHA256Hash               ← Original subject hash
  "oneProof": SHA256Hash                 ← Link to certificate object
}
```

### VC → Certificate

```typescript
// W3C Verifiable Credential (Input)
VerifiableCredential {
  issuer: string | {id: string}          → Extract to issuer hash
  credentialSubject: {
    id: string                           → Extract to subject hash
    publicKey: string                    → subjectPublicKey
    ...                                  → Extract to claims
  }
  issuanceDate: string                   → Parse to validFrom
  expirationDate: string                 → Parse to validUntil
  type: string[]                         → Extract certificateType
  proof: W3CProof                        → Convert to Signature
}

// ONE Certificate (Storage)
TrustKeysCertificate {
  issuer: SHA256IdHash<Person>           ← From VC.issuer (or oneIssuer)
  subject: SHA256IdHash<Person>          ← From VC.credentialSubject.id (or oneSubject)
  subjectPublicKey: string               ← From VC.credentialSubject.publicKey
  validFrom: Date                        ← Parse from issuanceDate
  validUntil: Date                       ← Parse from expirationDate
  certificateType: string                ← From VC.type (filter standard types)
  claims: Record<string, any>            ← From credentialSubject (excluding standard fields)
  proof: Signature                       ← Convert from VC.proof
}
```

---

## DID ↔ Hash Conversion

### ONE DIDs

ONE platform uses a custom DID method for content-addressed identities:

```
did:one:<SHA256IdHash>

Examples:
did:one:abc123def456...  (Person)
did:one:xyz789ghi012...  (Device)
```

### Conversion Functions

```typescript
// Hash → DID
function hashToDID(hash: SHA256IdHash<Person>): string {
  return `did:one:${hash}`
}

// DID → Hash
function didToHash(did: string): SHA256IdHash<Person> {
  if (!did.startsWith('did:one:')) {
    throw new Error('Not a ONE DID')
  }
  return did.substring(8) as SHA256IdHash<Person>
}

// Support other DID methods
function parseIssuer(issuer: string | {id: string}): SHA256IdHash<Person> {
  const didString = typeof issuer === 'string' ? issuer : issuer.id

  if (didString.startsWith('did:one:')) {
    return didToHash(didString)
  } else if (didString.startsWith('did:web:')) {
    // Resolve did:web to find ONE hash (cached)
    return await resolveDIDWeb(didString)
  } else if (didString.startsWith('did:key:')) {
    // Convert public key to Person hash
    return await keyToPerson(didString)
  } else {
    throw new Error(`Unsupported DID method: ${didString}`)
  }
}
```

---

## Proof Conversion

### Certificate Signature → W3C Proof

```typescript
// Certificate has raw Ed25519 signature
Certificate.proof: {
  signature: Uint8Array        // 64 bytes
  signer: SHA256IdHash<Person>
  signedAt: Date
}

// Convert to W3C Ed25519Signature2020
VC.proof: {
  type: "Ed25519Signature2020"
  created: "2025-01-09T12:00:00Z"             // From signedAt
  verificationMethod: "did:one:abc123#key-1"  // From signer + key reference
  proofPurpose: "assertionMethod"
  proofValue: "z3jG4f5h6..."                  // Base58-btc encoded signature
}
```

### Conversion Implementation

```typescript
function certificateProofToW3C(
  certProof: CertificateSignature,
  issuerPublicKey: string
): W3CProof {
  return {
    type: 'Ed25519Signature2020',
    created: certProof.signedAt.toISOString(),
    verificationMethod: `did:one:${certProof.signer}#key-1`,
    proofPurpose: 'assertionMethod',
    proofValue: base58btc.encode(certProof.signature)
  }
}

function w3cProofToCertificate(
  vcProof: W3CProof
): CertificateSignature {
  // Extract signer from verificationMethod
  const signer = extractSignerFromVerificationMethod(vcProof.verificationMethod)

  return {
    signature: base58btc.decode(vcProof.proofValue),
    signer: signer,
    signedAt: new Date(vcProof.created)
  }
}

function extractSignerFromVerificationMethod(vm: string): SHA256IdHash<Person> {
  // Parse: "did:one:abc123#key-1" → "abc123"
  const match = vm.match(/did:one:([^#]+)/)
  if (!match) {
    throw new Error('Invalid verification method format')
  }
  return match[1] as SHA256IdHash<Person>
}
```

---

## VCBridge Implementation

### Core Class

```typescript
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { Person } from '@refinio/one.core/lib/recipes.js'
import type { TrustKeysCertificate } from '@refinio/one.models/lib/recipes/Certificates/TrustKeysCertificate.js'
import type { VerifiableCredential, W3CProof } from '@refinio/one.verifiable/lib/recipes/VerifiableCredential.js'

export class VCBridge {
  /**
   * Convert ONE certificate to W3C Verifiable Credential
   */
  public certificateToVC(
    certificate: TrustKeysCertificate
  ): VerifiableCredential {
    // Generate VC ID
    const vcId = `urn:uuid:${generateUUID()}`

    // Build credential subject
    const credentialSubject: any = {
      id: hashToDID(certificate.subject),
      publicKey: certificate.subjectPublicKey,
      ...certificate.claims
    }

    // Build VC
    const vc: VerifiableCredential = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://w3id.org/security/v2',
        'https://one.refinio.net/contexts/trust/v1'
      ],
      id: vcId,
      type: ['VerifiableCredential', certificate.certificateType || 'TrustCertificate'],
      issuer: hashToDID(certificate.issuer),
      issuanceDate: certificate.validFrom.toISOString(),
      expirationDate: certificate.validUntil?.toISOString(),
      credentialSubject,
      proof: this.certificateProofToW3C(certificate.proof, certificate.subjectPublicKey),

      // ONE-specific extensions
      oneIssuer: certificate.issuer,
      oneSubject: certificate.subject,
      oneProof: await hashObject(certificate)
    }

    return vc
  }

  /**
   * Convert W3C Verifiable Credential to ONE certificate
   */
  public async vcToCertificate(
    vc: VerifiableCredential
  ): Promise<TrustKeysCertificate> {
    // Extract issuer (prefer oneIssuer if present)
    const issuer = vc.oneIssuer || await this.parseIssuer(vc.issuer)

    // Extract subject (prefer oneSubject if present)
    const subject = vc.oneSubject || await this.parseSubject(vc.credentialSubject.id)

    // Extract claims (exclude standard fields)
    const { id, publicKey, ...claims } = vc.credentialSubject

    // Determine certificate type (remove standard VC types)
    const certificateType = vc.type
      .filter(t => t !== 'VerifiableCredential')
      .join(',') || 'TrustCertificate'

    // Build certificate
    const certificate: TrustKeysCertificate = {
      $type$: 'TrustKeysCertificate',
      issuer,
      subject,
      subjectPublicKey: publicKey,
      validFrom: new Date(vc.issuanceDate),
      validUntil: vc.expirationDate ? new Date(vc.expirationDate) : undefined,
      certificateType,
      claims,
      proof: this.w3cProofToCertificate(vc.proof)
    }

    return certificate
  }

  /**
   * Validate structural compatibility between certificate and VC
   */
  public validateCompatibility(
    certificate: TrustKeysCertificate,
    vc: VerifiableCredential
  ): boolean {
    try {
      // Check issuer matches
      const vcIssuer = vc.oneIssuer || await this.parseIssuer(vc.issuer)
      if (vcIssuer !== certificate.issuer) {
        return false
      }

      // Check subject matches
      const vcSubject = vc.oneSubject || await this.parseSubject(vc.credentialSubject.id)
      if (vcSubject !== certificate.subject) {
        return false
      }

      // Check public key matches
      if (vc.credentialSubject.publicKey !== certificate.subjectPublicKey) {
        return false
      }

      // Check validity dates match (within 1 second tolerance)
      const validFromMatch = Math.abs(
        new Date(vc.issuanceDate).getTime() - certificate.validFrom.getTime()
      ) < 1000

      if (!validFromMatch) {
        return false
      }

      // Check proof signature matches
      const certProofValue = base58btc.encode(certificate.proof.signature)
      if (vc.proof.proofValue !== certProofValue) {
        return false
      }

      return true

    } catch (error) {
      console.error('[VCBridge] Validation error:', error)
      return false
    }
  }

  /**
   * Round-trip test: Certificate → VC → Certificate
   */
  public async testRoundTrip(
    certificate: TrustKeysCertificate
  ): Promise<boolean> {
    // Convert to VC
    const vc = await this.certificateToVC(certificate)

    // Convert back to certificate
    const certificate2 = await this.vcToCertificate(vc)

    // Validate they match
    return this.validateCompatibility(certificate, vc) &&
           this.validateCompatibility(certificate2, vc)
  }

  // Private helper methods

  private certificateProofToW3C(
    certProof: CertificateSignature,
    issuerPublicKey: string
  ): W3CProof {
    return {
      type: 'Ed25519Signature2020',
      created: certProof.signedAt.toISOString(),
      verificationMethod: `did:one:${certProof.signer}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: base58btc.encode(certProof.signature)
    }
  }

  private w3cProofToCertificate(vcProof: W3CProof): CertificateSignature {
    const signer = this.extractSignerFromVerificationMethod(vcProof.verificationMethod)

    return {
      signature: base58btc.decode(vcProof.proofValue),
      signer,
      signedAt: new Date(vcProof.created)
    }
  }

  private async parseIssuer(issuer: string | {id: string}): Promise<SHA256IdHash<Person>> {
    const didString = typeof issuer === 'string' ? issuer : issuer.id

    if (didString.startsWith('did:one:')) {
      return didToHash(didString)
    }

    // Support other DID methods (future)
    throw new Error(`Unsupported DID method: ${didString}`)
  }

  private async parseSubject(subjectId: string): Promise<SHA256IdHash<Person>> {
    if (subjectId.startsWith('did:one:')) {
      return didToHash(subjectId)
    }

    throw new Error(`Unsupported subject DID: ${subjectId}`)
  }

  private extractSignerFromVerificationMethod(vm: string): SHA256IdHash<Person> {
    const match = vm.match(/did:one:([^#]+)/)
    if (!match) {
      throw new Error('Invalid verification method format')
    }
    return match[1] as SHA256IdHash<Person>
  }
}
```

---

## Extension: Attestation Bridge

Attestations (from packages/one.trust) already follow this pattern:

```typescript
// Attestation is certificate-compliant
Attestation {
  subject: {
    type: string
    id: SHA256IdHash              // Certificate subject
  }
  issuer: SHA256IdHash<Person>    // Certificate issuer
  license: SHA256Hash<License>    // Certificate compliance
  claim: {
    statement: string
    confidence: number
  }
  evidence: Evidence[]
  verification: {
    verifiedBy: SHA256IdHash<Person>
    verifiedAt: Date
    expires: Date                 // Certificate validity
  }
  proof: W3CProof | Signature     // Dual-mode proof
}

// Attestation → VC is straightforward
function attestationToVC(attestation: Attestation): VerifiableCredential {
  return {
    '@context': [...],
    type: ['VerifiableCredential', 'Attestation', attestation.attestationType],
    issuer: hashToDID(attestation.issuer),
    issuanceDate: attestation.verification.verifiedAt.toISOString(),
    expirationDate: attestation.verification.expires?.toISOString(),
    credentialSubject: {
      id: hashToDID(attestation.subject.id),
      claim: attestation.claim.statement,
      confidence: attestation.claim.confidence,
      evidence: attestation.evidence,
      license: attestation.license
    },
    proof: attestation.proof  // Already W3C-compatible!
  }
}
```

**Key Insight**: Attestations demonstrate the bridge pattern in action.

---

## Usage Examples

### Example 1: Issue Certificate, Present as VC

```typescript
const vcBridge = new VCBridge()

// 1. Issue certificate via CA
const certificate = await ca.issueCertificate({
  subject: alicePersonId,
  certificateType: 'IdentityCertificate',
  validFor: '12 months',
  claims: {
    name: 'Alice Smith',
    email: 'alice@refinio.net'
  }
})

// 2. Convert to VC for presentation
const vc = await vcBridge.certificateToVC(certificate)

// 3. Send VC to external party
await sendVC(vc, externalParty)

// 4. External party can verify using W3C tools
const isValid = await verifyVC(vc)
```

### Example 2: Receive VC, Store as Certificate

```typescript
// 1. Receive VC from external source
const vc = await receiveVCFromPeer(peerId)

// 2. Convert to certificate for storage
const certificate = await vcBridge.vcToCertificate(vc)

// 3. Validate certificate
const isValid = await trustedKeysManager.validateCertificate(certificate)

// 4. Store in ONE.core
if (isValid) {
  await storeVersionedObject(certificate)
}
```

### Example 3: Validate Compatibility

```typescript
// Ensure certificate and VC are structurally compatible
const certificate = await getCertificate(certId)
const vc = await vcBridge.certificateToVC(certificate)

const isCompatible = vcBridge.validateCompatibility(certificate, vc)
if (!isCompatible) {
  throw new Error('Certificate and VC are not compatible!')
}
```

### Example 4: Round-Trip Test

```typescript
// Test bidirectional conversion
const certificate = await getCertificate(certId)

const success = await vcBridge.testRoundTrip(certificate)
if (success) {
  console.log('✓ Round-trip successful: Certificate → VC → Certificate')
} else {
  console.error('✗ Round-trip failed: Data loss or corruption detected')
}
```

---

## ONE-Specific Extensions

### Context Definition

```json
{
  "@context": {
    "@version": 1.1,
    "@protected": true,

    "oneIssuer": {
      "@id": "https://one.refinio.net/vocab#issuer",
      "@type": "@id"
    },
    "oneSubject": {
      "@id": "https://one.refinio.net/vocab#subject",
      "@type": "@id"
    },
    "oneProof": {
      "@id": "https://one.refinio.net/vocab#proof",
      "@type": "@id"
    },
    "shareScope": {
      "@id": "https://one.refinio.net/vocab#shareScope",
      "@type": "https://one.refinio.net/vocab#ShareScope"
    },
    "federationPolicy": {
      "@id": "https://one.refinio.net/vocab#federationPolicy",
      "@type": "https://one.refinio.net/vocab#FederationPolicy"
    }
  }
}
```

Host at: `https://one.refinio.net/contexts/trust/v1`

### ShareScope Extension

```typescript
// Add to VC for ONE-aware clients
vc.shareScope = 'private' | 'trusted' | 'public'

// Controls visibility in ONE network
// - private: Only issuer and subject
// - trusted: Trusted contacts can view
// - public: Anyone can view
```

### FederationPolicy Extension

```typescript
// Control cross-instance replication
vc.federationPolicy = {
  allowReplication: boolean      // Can replicate to other instances?
  trustedInstances: string[]     // Whitelist of instance DIDs
  syncStrategy: 'eager' | 'lazy' // Replication strategy
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('VCBridge', () => {
  it('should convert certificate to VC', async () => {
    const cert = createTestCertificate()
    const vc = await vcBridge.certificateToVC(cert)

    expect(vc.issuer).toBe(`did:one:${cert.issuer}`)
    expect(vc.credentialSubject.id).toBe(`did:one:${cert.subject}`)
  })

  it('should convert VC to certificate', async () => {
    const vc = createTestVC()
    const cert = await vcBridge.vcToCertificate(vc)

    expect(cert.issuer).toBeDefined()
    expect(cert.subject).toBeDefined()
  })

  it('should validate compatibility', async () => {
    const cert = createTestCertificate()
    const vc = await vcBridge.certificateToVC(cert)

    expect(vcBridge.validateCompatibility(cert, vc)).toBe(true)
  })

  it('should pass round-trip test', async () => {
    const cert = createTestCertificate()
    const success = await vcBridge.testRoundTrip(cert)

    expect(success).toBe(true)
  })
})
```

### Integration Tests

```typescript
describe('VCBridge Integration', () => {
  it('should work with TrustedKeysManager', async () => {
    const cert = await ca.issueCertificate({...})
    const vc = await vcBridge.certificateToVC(cert)
    const cert2 = await vcBridge.vcToCertificate(vc)

    const isValid = await trustedKeysManager.validateCertificate(cert2)
    expect(isValid).toBe(true)
  })

  it('should preserve signature validity', async () => {
    const cert = await ca.issueCertificate({...})
    const vc = await vcBridge.certificateToVC(cert)

    // Verify VC signature using W3C tools
    const vcValid = await verifyVCSignature(vc)
    expect(vcValid).toBe(true)
  })
})
```

---

## Performance Considerations

### Caching

```typescript
class VCBridge {
  private vcCache = new Map<SHA256Hash, VerifiableCredential>()
  private certCache = new Map<string, TrustKeysCertificate>()

  public async certificateToVC(cert: TrustKeysCertificate): Promise<VerifiableCredential> {
    const certHash = await hashObject(cert)

    // Check cache
    if (this.vcCache.has(certHash)) {
      return this.vcCache.get(certHash)!
    }

    // Convert and cache
    const vc = this.convertCertToVC(cert)
    this.vcCache.set(certHash, vc)

    return vc
  }
}
```

### Batch Conversion

```typescript
class VCBridge {
  public async certificatesToVCs(
    certificates: TrustKeysCertificate[]
  ): Promise<VerifiableCredential[]> {
    return Promise.all(
      certificates.map(cert => this.certificateToVC(cert))
    )
  }
}
```

---

## Security Considerations

1. **Signature Preservation**: Ensure signatures remain valid through conversion
2. **No Private Key Exposure**: Never include private keys in VCs
3. **Proof Verification**: Always verify proofs after conversion
4. **DID Resolution Security**: Validate DIDs before trusting them
5. **Context Validation**: Ensure @context URLs point to legitimate schemas

---

## Future Extensions

### Support for Additional DID Methods

- `did:web:` - Web-based DIDs
- `did:key:` - Cryptographic key-based DIDs
- `did:peer:` - Peer-to-peer DIDs

### Selective Disclosure

Using BBS+ signatures for privacy-preserving credentials:

```typescript
// Issue credential with BBS+ signature
const vc = await vcBridge.certificateToVC(cert, {
  proofType: 'BbsBlsSignature2020',
  selectiveDisclosure: true
})

// Holder can selectively reveal claims
const presentation = await vc.deriveProof({
  reveal: ['name'],  // Reveal only name, hide email
  nonce: challenge
})
```

### Zero-Knowledge Proofs

Future support for ZKP-based age verification, credential aggregation, etc.

---

**Status**: Design complete, ready for implementation
**Dependencies**: packages/one.verifiable, packages/one.models
**Next Steps**: Implement VCBridge class with unit tests
