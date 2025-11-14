# trust.core

**Trust, identity, and certificate system for the ONE platform**

## Status: 📖 Architecture Complete → Implementation Starting

Trust.core provides a comprehensive trust infrastructure with:
- **Device Trust** - Device-to-device trust and key verification
- **Social Trust** - Person-to-person trust relationships and social graphs
- **Certificate Authority** - Every ONE instance can issue and manage certificates
- **Verifiable Credentials** - W3C-compliant credential presentation layer
- **Attribution & Licensing** - Content provenance and machine-readable licensing
- **Attestations** - Evidence-based verification claims

---

## Quick Start

New to trust.core? Read the documentation:

📚 **[Complete Documentation](./docs/README.md)** - Start here for comprehensive guides

Key documents:
- **[Architecture Overview](./docs/UNIFIED-TRUST-ARCHITECTURE.md)** - Complete system design
- **[Integration Guide](./docs/INTEGRATION-GUIDE.md)** - How to use trust.core in your platform
- **[API Reference](./docs/API-REFERENCE.md)** - Complete API documentation

---

## Core Concepts

### VCs as Presentation Layer

Verifiable Credentials provide W3C-standard presentation of ONE platform certificates:

```
Certificate (Storage)  ←→  VC (Presentation)
ONE.core Objects      ←→  W3C Standard JSON-LD
```

**Bidirectionally compatible** - any certificate can be presented as VC, any VC can be stored as certificate.

### Local Root Certificates

Each CA has a **local root certificate**:
- Authoritative source is local ONE.core instance
- Private key in secure keychain (never exported)
- **MAY** be published to web for external verification (optional)
- Not dependent on web infrastructure

### Decentralized CA

**Every ONE instance can be a Certificate Authority**:
- No central authority required
- Domain-based namespacing (e.g., refinio.net)
- Cross-CA trust via social graph
- No single point of failure

### Dual Propagation

Certificate versions propagate via **two complementary mechanisms**:

1. **ONE.core Native Sync (CHUM)** - Automatic sync between connected instances
2. **External Documents (VCs)** - Portable credentials (email, QR, USB, web)

Both work together for maximum flexibility.

---

## Project Structure

```
trust.core/
├── docs/                        # Complete documentation
│   ├── README.md                # Documentation index
│   ├── UNIFIED-TRUST-ARCHITECTURE.md
│   ├── VC-CERTIFICATE-BRIDGE.md
│   ├── CA-INFRASTRUCTURE.md
│   ├── CERTIFICATE-VERSIONING.md
│   ├── API-REFERENCE.md
│   └── INTEGRATION-GUIDE.md
├── models/
│   ├── TrustModel.ts            # Trust orchestration (WIP)
│   ├── CAModel.ts               # Certificate authority (Planned)
│   └── VCBridge.ts              # VC ↔ Certificate (Planned)
├── recipes/
│   ├── TrustRelationship.ts     # Device trust (WIP)
│   ├── RootCertificate.ts       # CA root (Planned)
│   ├── TrustEdge.ts             # Social trust (from one.trust)
│   ├── Attribution.ts           # Provenance (from one.trust)
│   ├── License.ts               # Machine-readable licensing (from one.trust)
│   └── Attestation.ts           # Verification (from one.trust)
├── plans/
│   ├── TrustPlan.ts             # Trust RPC interface (WIP)
│   └── CAPlan.ts                # CA RPC interface (Planned)
├── services/
│   ├── VCPropagation.ts         # VC distribution (Planned)
│   └── AuditTrailService.ts     # Certificate usage tracking (Planned)
├── types/
│   └── trust-types.ts           # Type definitions (WIP)
└── packages/                    # Build-time deps (symlinks)
    ├── one.core/
    └── one.models/
```

---

## Implementation Status

### ✅ Completed - Documentation (Phase 1)

- **Architecture Design**: Complete system design documented
- **VC ↔ Certificate Bridge**: Bidirectional compatibility spec
- **CA Infrastructure**: Decentralized CA with local roots
- **Certificate Versioning**: Time-bound certificates via ONE.core versioning
- **Dual Propagation**: ONE.core sync + external documents
- **API Reference**: Complete API specification
- **Integration Guide**: Platform-specific integration patterns

### 🚧 In Progress - Foundation (Phase 2)

- **TrustModel**: Device trust implementation (needs completion)
  - ✅ Device identity from keychain
  - ✅ TrustRelationship storage
  - ⚠️ ONE.core querying (needs fixing)
  - ⚠️ Certificate validation integration

- **TrustRelationship Recipe**: ONE.core recipe definition (needs registration)
  - ✅ Recipe structure
  - ✅ Reverse map
  - ⚠️ Registration with ONE.core

- **TrustPlan**: RPC interface (needs completion)
  - ✅ Request/response types
  - ⚠️ Async method signatures

### 📋 Planned - Implementation

**Phase 2**: VC ↔ Certificate Bridge
- VCBridge implementation
- did:one: DID method
- Proof conversion (Ed25519 ↔ W3C)
- Round-trip testing

**Phase 3**: CA Infrastructure
- CAModel implementation
- RootCertificate recipe
- Certificate issuance
- Time-bound versioning
- Web publication (optional)

**Phase 4**: Propagation
- VCPropagation service
- CHUM integration
- External VC export (QR, email, download, web)
- VC import

**Phase 5**: Social Trust
- Merge TrustGraph from packages/one.trust
- Trust path calculation
- Social graph analysis
- Progressive trust levels

**Phase 6**: Attribution & Licensing
- Merge recipes from packages/one.trust
- Attribution tracking
- Machine-readable licensing
- Trust-based access control

**Phase 7**: Reference Implementation
- Refinio CA (identity certificates for sale)
- Certificate marketplace
- Payment integration

---

## Usage Examples

### Current (Device Trust)

```typescript
import { TrustModel } from '@trust/core/models/TrustModel.js'

// Initialize
const trustModel = new TrustModel(leuteModel, trustedKeysManager)
await trustModel.init()

// Set trust after pairing
await trustModel.setTrustStatus(
  peerPersonId,
  peerPublicKey,
  'trusted',
  {
    reason: 'QR code pairing',
    context: 'device_pairing',
    verificationMethod: 'qr-code'
  }
)

// Evaluate trust
const evaluation = await trustModel.evaluateTrust(peerPersonId, 'file-transfer')
if (evaluation.level >= 0.8) {
  // Sufficient trust for file transfer
}
```

### Future (CA Operations)

```typescript
import { CAModel } from '@trust/core/models/CAModel.js'

// Initialize CA
const ca = new CAModel(leuteModel, trustedKeysManager)
await ca.init()

// Create root certificate (once per CA)
const root = await ca.createRootCertificate({
  domain: 'refinio.net',
  name: 'Refinio Certificate Authority'
})

// Optionally publish to web
await ca.publishRootToWeb('https://refinio.net/.well-known/certificates/root')

// Issue identity certificate
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

// Export as VC for sharing
const vc = await ca.propagateViaExternalDocument(cert.certificateId, 1, {
  qrCode: true,
  webEndpoint: 'https://refinio.net/certs/alice-v1.json'
})
```

### Future (Social Trust)

```typescript
// Establish trust from invite
await trustModel.establishTrustFromInvite(inviter, invitee, inviteId)

// Calculate trust path
const path = await trustModel.calculateTrustPath(aliceId, charlieId)
if (path && path.bottleneck >= 0.7) {
  console.log(`Trust path found: ${path.pathLength} hops`)
}

// Build social graph
const graph = await trustModel.buildSocialGraph()
console.log(`Network: ${graph.nodes.length} people, ${graph.clusters.length} communities`)
```

---

## Integration

See **[Integration Guide](./docs/INTEGRATION-GUIDE.md)** for complete platform-specific instructions.

### lama.cube (Electron)

```typescript
// Main process - setup IPC
import { TrustPlan } from '@trust/core/plans/TrustPlan.js'

const trustPlan = new TrustPlan(trustModel)
ipcMain.handle('trust:setStatus', trustPlan.setTrustStatus)

// Renderer - use via IPC
await ipcRenderer.invoke('trust:setStatus', {
  deviceId: peerId,
  publicKey,
  status: 'trusted'
})
```

### lama.browser (Web)

```typescript
// Web Worker - run trust.core
const trustModel = new TrustModel(leuteModel)
await trustModel.init()

// Main thread - communicate via messages
worker.postMessage({ type: 'trust:setStatus', data: {...} })
```

### lama (React Native)

```typescript
// AppModel - direct usage
export class AppModel {
  public trustModel: TrustModel

  async init() {
    this.trustModel = new TrustModel(this.leuteModel)
    await this.trustModel.init()
  }
}

// React hook
const { trustStatus, trustDevice } = useTrust(deviceId)
```

---

## Architecture

```
Applications & UI
      ↓
Services (RPC)
      ↓
Trust Orchestration (TrustModel, CAModel, VCBridge)
      ↓
Trust Mechanisms (Device, Social, Attribution, Licensing, Attestation)
      ↓
Certificate & VC Infrastructure
      ↓
ONE Platform Foundation
```

See **[Architecture Overview](./docs/UNIFIED-TRUST-ARCHITECTURE.md)** for complete details.

---

## Key Features

### Time-Bound Certificates with Versioning

Certificates use ONE.core versioning for lifecycle management:
- **Extensions** - New version with later validUntil
- **Reductions** - New version with earlier validUntil
- **Revocation** - New version with validUntil in past
- **Complete audit trail** - All versions preserved

### Cross-Platform Propagation

Dual propagation ensures certificates reach all relevant parties:
- **CHUM (ONE.core)** - Automatic sync between connected instances
- **External VCs** - Portable credentials for offline/external sharing

### Trust Evaluation

Multi-factor trust scoring considers:
- Trust relationship status
- Certificate chain validation
- Social graph position
- Recency of verification
- Context-specific requirements

### Machine-Readable Licensing

RuleMapping-inspired licensing with:
- Formal rule specification
- Complex constraints (temporal, geographic, usage, trust-based)
- Automated compliance checking
- License compatibility analysis

---

## Migration from Old Systems

### From AsyncStorage-based TrustModel

Old system stored trust in AsyncStorage without cryptographic verification.

**Migration path**:
1. Read existing trust relationships from AsyncStorage
2. Create TrustRelationship objects in ONE.core
3. Optionally issue certificates for verified relationships
4. Remove AsyncStorage data

### From packages/one.trust

Social trust features from `packages/one.trust` will be merged into trust.core.

**Migration path**:
1. TrustEdge, Attribution, License, Attestation recipes copied to trust.core
2. TrustGraph functionality integrated into TrustModel
3. In-memory storage replaced with ONE.core persistence
4. packages/one.trust deprecated with migration guide

---

## Testing

See `test/` directory for integration tests.

```bash
# Unit tests (when implemented)
npm test

# Integration tests with ONE.core
npm run test:integration

# Platform-specific tests
cd lama.cube && npm test
cd lama.browser && npm test
cd lama && npm test
```

---

## Contributing

When contributing:

1. **Platform-agnostic** - No platform-specific imports in core
2. **Dependency injection** - Pass dependencies via constructor
3. **Fail fast** - Don't mitigate, fix problems
4. **Use ONE helpers** - Leverage existing ONE.core/ONE.models
5. **Document changes** - Update architecture docs
6. **Test thoroughly** - Unit + integration tests required

---

## Related Packages

- **@refinio/one.core** - Core ONE platform (storage, versioning, crypto)
- **@refinio/one.models** - Domain models (LeuteModel, TrustedKeysManager)
- **@refinio/one.verifiable** - W3C VC recipes
- **@refinio/one.vc** - Device identity credentials
- **packages/one.trust** - Social trust (to be merged)

---

## Support & Documentation

- **📚 Full Documentation**: [docs/README.md](./docs/README.md)
- **🏗️ Architecture**: [docs/UNIFIED-TRUST-ARCHITECTURE.md](./docs/UNIFIED-TRUST-ARCHITECTURE.md)
- **🔧 Integration**: [docs/INTEGRATION-GUIDE.md](./docs/INTEGRATION-GUIDE.md)
- **📖 API Reference**: [docs/API-REFERENCE.md](./docs/API-REFERENCE.md)
- **🐛 Issues**: Open issue on GitHub
- **💬 Questions**: See documentation or open discussion

---

**Version**: 1.0.0 (Architecture Complete)
**Status**: Documentation complete, implementation starting
**License**: MIT
**Maintainers**: LAMA Core Team
