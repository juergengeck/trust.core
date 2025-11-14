# Trust.core Documentation

**Complete documentation for the unified trust and certificate system**

---

## Quick Start

New to trust.core? Start here:

1. **[Unified Trust Architecture](./UNIFIED-TRUST-ARCHITECTURE.md)** - Overview of the entire system
2. **[Integration Guide](./INTEGRATION-GUIDE.md)** - How to use trust.core in your platform
3. **[API Reference](./API-REFERENCE.md)** - Complete API documentation

---

## Documentation Index

### Architecture & Design

**[Unified Trust Architecture](./UNIFIED-TRUST-ARCHITECTURE.md)**
- Complete system overview
- Core principles (VCs as presentation layer, local roots, decentralized CA)
- 6-layer architecture
- Trust relationships (device + social)
- Social graph & attribution
- Implementation roadmap

**[VC ↔ Certificate Bridge](./VC-CERTIFICATE-BRIDGE.md)**
- Bidirectional structural compatibility
- DID ↔ Hash conversion (did:one: method)
- Proof conversion (Ed25519 ↔ W3C)
- Complete VCBridge implementation spec
- Attestation bridge pattern
- ONE-specific extensions

**[CA Infrastructure](./CA-INFRASTRUCTURE.md)**
- Decentralized CA model
- Local root certificates (MAY be published to web)
- CAModel architecture
- Certificate issuance flows
- Certificate types (Identity, Device, Trust, Domain)
- Certificate chains
- Web publication (optional)
- Cross-CA trust via social graph

**[Certificate Versioning](./CERTIFICATE-VERSIONING.md)**
- Time-bound certificates with ONE.core versioning
- Extension, reduction, and revocation patterns
- Complete audit trail
- **Dual propagation**: ONE.core sync (CHUM) + External documents (VCs)
- Version queries and history
- Implementation patterns

### Reference

**[API Reference](./API-REFERENCE.md)**
- TrustModel API (device trust, social trust, attribution, licensing)
- CAModel API (root certificates, issuance, lifecycle, propagation)
- VCBridge API (bidirectional conversion)
- Services (VCPropagation, AuditTrailService)
- Plans (TrustPlan, CAPlan - RPC interfaces)
- Recipes (TrustRelationship, RootCertificate, TrustEdge, Attribution, License, Attestation)
- Complete type reference

**[Integration Guide](./INTEGRATION-GUIDE.md)**
- Integration patterns (direct, RPC, service layer)
- Platform-specific guides:
  - lama.cube (Electron with IPC)
  - lama.browser (Web Workers)
  - lama (React Native)
- Common tasks (pairing, certificate purchase, trust evaluation)
- Testing strategies
- Troubleshooting

---

## Key Concepts

### VCs as Presentation Layer

Verifiable Credentials (VCs) provide W3C-standard presentation of ONE platform certificates:

```
Certificate (Storage)  ←→  VC (Presentation)
     ↓                          ↓
ONE.core Objects        W3C Standard JSON-LD
TrustKeysCertificate    VerifiableCredential
```

**Bidirectionally compatible** - any certificate can be presented as VC, any VC can be stored as certificate.

### Local Root Certificates

Identity certificates are based on **local root certificates**:

- Authoritative source is local ONE.core instance
- Private key in secure keychain (never exported)
- MAY be published to web for external verification (optional)
- Not dependent on web infrastructure

### Decentralized CA

**Every ONE instance can be a Certificate Authority**:

- No central authority required
- Domain-based namespacing (optional)
- Cross-CA trust via social graph
- No single point of failure

### Dual Propagation

Certificate versions propagate via **two complementary mechanisms**:

1. **ONE.core Native Sync (CHUM)**
   - Automatic synchronization between connected instances
   - Efficient, real-time, built-in

2. **External Documents (VCs)**
   - Portable W3C Verifiable Credentials
   - Share via email, QR code, USB, web, etc.
   - Works offline and with external systems

### Time-Bound Versioning

Certificates use ONE.core versioning for lifecycle management:

- Extensions = new version with later validUntil
- Reductions = new version with earlier validUntil
- Revocation = new version with validUntil in past
- Complete audit trail (all versions preserved)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Applications & UI (lama.cube, lama.browser, lama)              │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ High-Level Services                                             │
│ - TrustPlan, CAPlan (RPC)                                      │
│ - VCPropagation, AuditTrailService                             │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Trust Orchestration                                             │
│ - TrustModel (unified trust management)                        │
│ - CAModel (certificate authority)                              │
│ - VCBridge (certificate ↔ VC translation)                      │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Trust Mechanisms                                                 │
│ - Device Trust (TrustRelationship)                             │
│ - Social Trust (TrustEdge, paths, graphs)                      │
│ - Attribution (content provenance)                             │
│ - Licensing (machine-readable rules)                           │
│ - Attestation (evidence-based verification)                    │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Certificate & VC Infrastructure                                  │
│ - TrustedKeysManager (certificate validation)                  │
│ - TrustKeysCertificate (ONE certificates)                      │
│ - VerifiableCredential (W3C VCs)                               │
│ - Versioning, issuance, revocation                             │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ ONE Platform Foundation                                          │
│ - ONE.core (storage, versioning, recipes)                      │
│ - Keychain (secure key storage)                                │
│ - Crypto API (Ed25519 signing)                                 │
│ - QUIC/CHUM (transport & sync)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### Why Local Root Certificates?

Traditional PKI requires central root authorities. Local roots provide:
- **Self-sovereign identity** - each instance controls its trust
- **No central dependency** - works offline, no infrastructure needed
- **Optional web publication** - can share publicly if desired
- **Decentralized trust** - trust via social graph, not authority

### Why Dual Propagation?

ONE.core sync works great for connected instances, but external documents enable:
- **Offline scenarios** - share certificates without network
- **External systems** - integrate with non-ONE systems
- **Portability** - email, QR codes, USB drives
- **Web compatibility** - W3C standard compliance

Both mechanisms work together for maximum flexibility.

### Why ONE.core Versioning for Certificates?

Traditional certificate revocation requires CRLs and OCSP. ONE.core versioning provides:
- **No special infrastructure** - versioning already built-in
- **Atomic updates** - version transitions are atomic
- **Complete audit trail** - all versions preserved
- **Distributed sync** - CHUM syncs automatically
- **Simple revocation** - just create version with past validUntil

### Why VCs as Presentation Layer?

ONE certificates are optimized for storage, VCs for interop:
- **Storage** - ONE certificates are compact, ONE.core-native
- **Presentation** - VCs are W3C standard, human-readable JSON-LD
- **Compatibility** - VCBridge ensures structural compatibility
- **Best of both** - ONE efficiency + W3C standards

---

## Migration from Old Systems

If you're migrating from:

### `lama/src/models/trust/TrustModel.ts` (AsyncStorage-based)

Old model stored trust in AsyncStorage, new model uses ONE.core:

```typescript
// Old (AsyncStorage)
await trustModel.setTrustStatus(peerId, 'trusted')

// New (trust.core)
await trustModel.setTrustStatus(peerId, publicKey, 'trusted', {
  reason: 'Migration from old trust model',
  context: 'migration'
})
```

**Benefits**: Cryptographically verifiable, shareable, versioned, integrated with certificates

### `packages/one.trust` (In-memory TrustGraph)

Old TrustGraph was in-memory only. New trust.core integrates social features into TrustModel:

```typescript
// Old (one.trust)
const trustGraph = new TrustGraph()
await trustGraph.establishTrustFromInvite(inviter, invitee, inviteId)

// New (trust.core)
await trustModel.establishTrustFromInvite(inviter, invitee, inviteId)
// Now stored in ONE.core, not just memory
```

**Benefits**: Persistent storage, certificate integration, unified API

---

## Implementation Status

### ✅ Completed
- Architecture documentation
- VC ↔ Certificate bridge design
- CA infrastructure design
- Certificate versioning design
- Dual propagation strategy
- API reference
- Integration guide

### 🚧 In Progress
- VCBridge implementation
- CAModel implementation
- Certificate versioning implementation

### 📋 Planned
- Social trust integration (merge from one.trust)
- Audit trail service
- Refinio CA reference implementation
- Comprehensive testing
- Migration tools

---

## Contributing

When contributing to trust.core:

1. **Follow platform-agnostic pattern** - No platform-specific imports
2. **Use dependency injection** - Pass dependencies via constructor
3. **Fail fast** - Don't mitigate problems, fix them
4. **Use ONE helpers** - Leverage existing ONE.core/ONE.models helpers
5. **Document decisions** - Update architecture docs for major changes
6. **Test thoroughly** - Unit tests + integration tests required

---

## Support

- **Documentation Issues**: Open issue on GitHub
- **Architecture Questions**: See [UNIFIED-TRUST-ARCHITECTURE.md](./UNIFIED-TRUST-ARCHITECTURE.md)
- **Integration Help**: See [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md)
- **API Questions**: See [API-REFERENCE.md](./API-REFERENCE.md)

---

**Version**: 1.0.0
**Last Updated**: 2025-01-09
**Status**: Architecture Complete, Implementation In Progress
