# Trust.core Architecture

## Overview

trust.core provides trust and identity management for LAMA applications by integrating three complementary systems:

1. **TrustedKeysManager** (ONE.models) - Cryptographic key trust via certificates
2. **TrustRelationship** (trust.core) - Device/person trust status and permissions
3. **Verifiable Credentials** (ONE.vc) - Exportable trust attestations

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (lama, lama.electron, lama.browser - UI and workflows)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   TrustModel (trust.core)                   │
│  • Trust relationship lifecycle                             │
│  • Permission management                                    │
│  • Trust evaluation algorithms                              │
│  • Integration orchestration                                │
└──────────┬──────────────────────┬───────────────────────────┘
           │                      │
    ┌──────▼─────────┐    ┌──────▼─────────────────────────┐
    │ TrustedKeys    │    │  TrustRelationship (Recipe)    │
    │ Manager        │    │  • ONE.core versioned object   │
    │ (ONE.models)   │    │  • Trust status & permissions  │
    │                │    │  • Timestamps & verification   │
    │ • Key trust    │    │  • Stored in ONE object DB     │
    │ • Certificates │    │  • Queryable via reverse maps  │
    │ • Validation   │    └────────────────────────────────┘
    └────────────────┘
           │
    ┌──────▼──────────────────────────────────────────────────┐
    │  TrustKeysCertificate (ONE.models recipe)             │
    │  • Cryptographic attestation that keys belong to person │
    │  • Signed by issuer                                     │
    │  • Verifiable chain of trust                            │
    └─────────────────────────────────────────────────────────┘
           │
    ┌──────▼──────────────────────────────────────────────────┐
    │         ONE.core (Storage & Crypto)                     │
    │  • Object storage (versioned & unversioned)             │
    │  • Secure keychain                                      │
    │  • Crypto API (sign/verify without key exposure)        │
    │  • Reverse maps for queries                             │
    └─────────────────────────────────────────────────────────┘
```

## Component Interactions

### 1. Trust Establishment Flow

```
User initiates trust
       │
       ▼
TrustModel.setTrustStatus()
       │
       ├──► Create TrustRelationship object
       │    (store in ONE.core with storeVersionedObject)
       │
       ├──► Issue TrustKeysCertificate
       │    (via TrustedKeysManager)
       │
       └──► Generate VC (optional)
            (export for sharing)
```

### 2. Trust Verification Flow

```
Verify peer trust
       │
       ▼
TrustModel.evaluateTrust()
       │
       ├──► Query TrustRelationship objects
       │    (reverse map lookup by peer ID)
       │
       ├──► Validate keys via TrustedKeysManager
       │    (check certificates)
       │
       └──► Calculate trust score
            (status + recency + certificates)
```

### 3. Storage Architecture

**TrustRelationship Objects:**
- **Type**: Versioned ONE objects
- **Storage**: ONE.core object database
- **Indexing**: Reverse map on `peer` field
- **Querying**: `getAllEntries(TrustRelationshipReverseMap, peerPersonId)`
- **Updates**: Create new version (maintains history)
- **Signing**: Can be signed to create certificates
- **Channels**: Can be posted to channels for sharing

**Key Trust via Certificates:**
- **Type**: Unversioned ONE objects (TrustKeysCertificate)
- **Storage**: ONE.core with signature
- **Validation**: TrustedKeysManager verifies certificate chain
- **Issuer**: Person with RightToDeclareTrustedKeys

## Data Model

### TrustRelationship (Versioned Object)

Stores the current trust assessment for a peer:

```typescript
{
  $type$: 'TrustRelationship',
  $version$: 'v1',
  peer: SHA256IdHash<Person>,           // Who is trusted
  peerPublicKey: string,                // Their public key
  status: 'trusted' | 'untrusted' | 'pending' | 'revoked',
  trustLevel: 'full' | 'limited' | 'temporary',
  permissions: { ... },                 // Fine-grained access control
  establishedAt: ISO8601,
  lastVerified: ISO8601,
  reason: string,                       // Why trust was established
  context: 'pairing' | 'mutual-contact' | 'organizational' | 'user-consent',
  verificationMethod: 'qr-code' | 'video-call' | 'certificate',
  verificationProof: SHA256Hash         // Link to certificate
}
```

### TrustKeysCertificate (ONE.models)

Cryptographic attestation that keys belong to a person:

```typescript
{
  $type$: 'TrustKeysCertificate',
  profile: SHA256Hash<Profile>,         // Profile containing keys
  license: SHA256Hash<License>          // TrustKeysLicense
  // + Signature from issuer
}
```

### Trust Evaluation Algorithm

```typescript
evaluateTrust(personId, context) → { level: 0-1, confidence: 0-1 }
  1. Load TrustRelationship for personId
  2. Check status: trusted=0.9, pending=0.3, untrusted=0.1, revoked=0
  3. Validate keys via TrustedKeysManager
     - If keys have valid certificates: boost confidence +0.2
     - If keys are self-signed only: reduce confidence -0.1
  4. Check recency:
     - Verified within 7 days: boost confidence +0.1
     - Not verified in 30+ days: reduce confidence -0.1
  5. Apply context modifiers:
     - 'file-transfer': require higher trust threshold
     - 'communication': standard trust acceptable
  6. Return { level, confidence, reason }
```

## Integration Points

### ONE.models TrustedKeysManager

```typescript
// Check if key is trusted via certificates
const trustInfo = await trustedKeysManager.keyTrustInfo(personId, publicKey);
// trustInfo.trusted - boolean
// trustInfo.reason - 'certificate' | 'main-id' | 'untrusted'
// trustInfo.certificates - array of TrustKeysCertificate
```

### ONE.core Object Storage

```typescript
// Store trust relationship
const trustRelationship: TrustRelationship = { ... };
const result = await storeVersionedObject(trustRelationship);
// result: { hash, idHash, versionHash }

// Query by peer
const relationships = await getAllEntries(
  TrustRelationshipReverseMap,
  peerPersonId
);

// Update (creates new version)
const updated: TrustRelationship = { ...existing, status: 'revoked' };
await storeVersionedObject(updated);
```

### Verifiable Credentials

```typescript
// Export trust chain as VC
const vc = await trustModel.exportTrustChainAsVC(personId);
// VC contains:
// - TrustRelationship claims
// - TrustKeysCertificate proofs
// - Signature from issuer
// - Shareable with notaries/third parties
```

## Permission Model

Permissions are stored in TrustRelationship and enforced by TrustModel:

```typescript
permissions: {
  // Communication
  chat: boolean,
  voiceCall: boolean,
  videoCall: boolean,

  // Data access
  fileRead: boolean,
  fileWrite: boolean,
  syncData: boolean,

  // Presence
  seeOnlineStatus: boolean,
  seeLocation: boolean,
  seeActivity: boolean,

  // Administrative
  addToGroups: boolean,
  shareContacts: boolean
}
```

**Trust Levels → Default Permissions:**
- **full**: All permissions enabled
- **limited**: Communication only (chat, calls)
- **temporary**: Communication + time-bound expiration

## Trust Contexts

Different contexts require different trust thresholds:

1. **Communication** - Chat, messaging
   - Threshold: 0.5 (moderate trust)
   - Certificates: Optional but recommended

2. **File Transfer** - Sharing files
   - Threshold: 0.7 (high trust)
   - Certificates: Required

3. **Data Sync** - Cross-device sync
   - Threshold: 0.9 (very high trust)
   - Certificates: Required + same owner verification

## Trust Establishment Methods

### 1. QR Code Pairing
- User scans QR code
- Exchange public keys
- Create TrustRelationship with status='trusted'
- Issue TrustKeysCertificate
- Trust level: full (if same owner) or limited (if different owner)

### 2. Mutual Contacts
- Check for shared contacts
- If 3+ mutual contacts: automatic trust
- Create TrustRelationship with status='trusted'
- Trust level: limited

### 3. Organizational Policy
- Same domain/organization
- Organizational admin has RightToDeclareTrustedKeysForEverybody
- Trust via certificate chain
- Trust level: limited or full (policy-dependent)

### 4. Video Call Verification
- Real-time video interaction
- Human verification
- High confidence trust
- Trust level: full

### 5. Certificates Only
- Person has valid TrustKeysCertificate from trusted issuer
- No direct interaction
- Trust level: limited
- Status: pending (requires user approval)

## Security Considerations

### Key Management
- Private keys never leave ONE.core keychain
- Crypto API used for all signing operations
- Public keys stored in TrustRelationship for verification

### Certificate Validation
- TrustedKeysManager validates certificate chains
- Only persons with RightToDeclareTrustedKeys can issue certificates
- Revoked certificates are not trusted

### Trust Revocation
- Create new TrustRelationship version with status='revoked'
- All permissions immediately denied
- Cannot re-establish without user intervention

### Time-Based Trust
- Temporary trust has validUntil timestamp
- TrustModel checks expiration before granting access
- Auto-revokes after expiration

## Future Enhancements

### 1. Trust Decay
- Reduce trust level over time without interaction
- Require periodic re-verification
- Formula: `newTrust = oldTrust * exp(-λ * daysSinceVerification)`

### 2. Reputation System
- Track trust violations
- Aggregate trust across network
- Web of trust algorithms

### 3. Place-Based Trust
- Geographic verification
- Meeting in person detection
- Shared physical spaces

### 4. Context-Aware Permissions
- Dynamic permissions based on context
- Time-of-day restrictions
- Location-based access control

### 5. Trust Chain Export
- Generate comprehensive VCs with full trust history
- Share trust attestations with notaries
- Enable external trust verification

## Migration Path

### Phase 1: Core Infrastructure (Current)
- ✅ TrustRelationship recipe
- ✅ TrustModel with ONE.core storage
- ✅ Integration with TrustedKeysManager

### Phase 2: Certificate Integration
- Issue TrustKeysCertificate on trust establishment
- Validate certificates in trust evaluation
- Certificate-based trust discovery

### Phase 3: VC Generation
- Export trust chains as VCs
- Notary integration
- External trust verification

### Phase 4: Advanced Features
- Trust decay algorithms
- Reputation system
- Context-aware permissions
- Place-based trust
