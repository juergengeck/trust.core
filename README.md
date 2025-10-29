# trust.core

**Platform-agnostic trust and identity management for LAMA applications**

## Status: 🚧 Work in Progress

Trust.core has been extracted from the lama app and architecturally redesigned to integrate with:
- **ONE.core object storage** (versioned objects, not AsyncStorage)
- **ONE.models TrustedKeysManager** (certificate-based key trust)
- **Verifiable Credentials** (exportable trust attestations)

## What We Built

### ✅ Completed

1. **TrustRelationship Recipe** (`recipes/TrustRelationship.ts`)
   - ONE.core versioned object for trust status
   - Stores: peer ID, public key, status, permissions, timestamps
   - Indexed by `peer` for fast lookups

2. **TrustModel with ONE.core Storage** (`models/TrustModel.ts`)
   - Device identity from secure keychain
   - Trust relationships stored as versioned ONE objects
   - Integration with TrustedKeysManager for certificate validation
   - Combined trust evaluation (relationships + certificates)

3. **Architecture Documentation** (`ARCHITECTURE.md`)
   - Complete design for trust + certificates + VC integration
   - Trust establishment flows
   - Trust evaluation algorithms
   - Permission model

4. **Type Definitions** (`types/trust-types.ts`)
   - DeviceCredentials, TrustStatus, TrustEntry
   - TrustLevel, TrustEvaluation, TrustPermissions
   - Platform adapters (now deprecated - using ONE.core)

5. **TrustHandler** (`handlers/TrustHandler.ts`)
   - RPC-style handler for platforms
   - Request/Response pattern

### 🚧 TODO: Remaining Work

1. **Fix Object Querying**
   - Current approach uses `getAllEntries` incorrectly
   - Need proper way to query all TrustRelationship objects
   - Options:
     - Post TrustRelationships to a channel and query channel
     - Use custom index pattern
     - Store in a Map object

2. **Recipe Registration**
   - Register TrustRelationship recipe with ONE.core
   - Add to recipe registry
   - Export from package

3. **TrustedKeysManager Integration**
   - Fix `keyTrustInfo` → `getKeyTrustInfo` method name
   - Test certificate validation flow
   - Issue TrustKeysCertificate on trust establishment

4. **Build Fixes**
   - Fix TypeScript errors in TrustHandler (async methods)
   - Fix recipe definition (proper types for idHash, hash, object)
   - Fix module augmentation

5. **VC Generation**
   - Implement `exportTrustChainAsVC()` method
   - Generate VCs from TrustRelationship objects
   - Include certificate proofs

6. **Testing**
   - Unit tests for TrustModel
   - Integration tests with ONE.core
   - Certificate validation tests

## Architecture

```
TrustModel (trust.core)
├── TrustRelationship (ONE.core versioned object)
│   └── Stores trust status, permissions, timestamps
├── TrustedKeysManager (ONE.models)
│   └── Validates keys via TrustKeysCertificate
└── Verifiable Credentials (future)
    └── Export trust chains for sharing
```

## Usage (Future - when complete)

```typescript
import { TrustModel } from '@trust/core/models/TrustModel.js';
import type { TrustStorageAdapter } from '@trust/core/types/trust-types.js';

// Platform-specific instantiation
const trustModel = new TrustModel(leuteModel, trustedKeysManager);
await trustModel.init();

// Set trust
await trustModel.setTrustStatus(
  peerPersonId,
  peerPublicKey,
  'trusted',
  {
    trustLevel: 'full',
    reason: 'qr-code-pairing',
    context: 'pairing',
    verificationMethod: 'qr-code'
  }
);

// Evaluate trust
const evaluation = await trustModel.evaluateTrust(
  peerPersonId,
  'communication'
);
// { level: 0.9, confidence: 0.9, reason: 'trusted' }

// Verify key (checks both relationship AND certificates)
const isValid = await trustModel.verifyDeviceKey(
  peerPersonId,
  peerPublicKey
);
```

## Integration Points

### ONE.core
- `storeVersionedObject()` - Store TrustRelationship
- `getAllEntries()` - Query relationships (needs fixing)
- Secure keychain for device credentials
- Crypto API for signing

### ONE.models
- `TrustedKeysManager.getKeyTrustInfo()` - Validate certificates
- `TrustKeysCertificate` - Key attestations
- `LeuteModel` - Identity management

### Platforms
- **lama** (React Native) - Will use trust.core via AppModel
- **lama.electron** - Will use trust.core + TrustHandler
- **lama.browser** - Will use trust.core + TrustHandler

## Why This Approach?

**Before:** Trust relationships stored in AsyncStorage
- ❌ Not cryptographically verifiable
- ❌ No integration with ONE platform
- ❌ Can't be shared or exported
- ❌ No certificate support

**After:** Trust relationships as ONE.core objects
- ✅ Cryptographically signed and verifiable
- ✅ Integrated with TrustedKeysManager certificates
- ✅ Can be posted to channels and shared
- ✅ Exportable as Verifiable Credentials
- ✅ Versioned (maintains history)
- ✅ Works across all LAMA platforms

## Next Steps

1. **Fix querying mechanism** - Decide on pattern for querying all TrustRelationship objects
2. **Register recipe** - Add TrustRelationship to ONE.core recipes
3. **Fix TypeScript** - Resolve compilation errors
4. **Test integration** - Verify with actual ONE.core storage
5. **Complete VC generation** - Implement trust chain export
6. **Update lama app** - Migrate from old TrustModel to trust.core

## Files

```
trust.core/
├── package.json              # Package definition
├── tsconfig.json             # TypeScript config
├── README.md                 # This file
├── ARCHITECTURE.md           # Complete architecture docs
├── CLAUDE.md                 # Development guidance
├── models/
│   └── TrustModel.ts        # Main trust model
├── types/
│   └── trust-types.ts       # Type definitions
├── recipes/
│   └── TrustRelationship.ts # ONE.core recipe
└── handlers/
    └── TrustHandler.ts      # RPC handler
```

## Related Documentation

- `ARCHITECTURE.md` - Full architecture and design
- `../instance-trust.md` - App-to-app trust protocols
- `../lama.core/packages/one.models/src/models/Leute/TrustedKeysManager.ts` - Certificate manager
- `../lama.core/packages/one.models/src/recipes/Certificates/TrustKeysCertificate.ts` - Key certificate

---

**Note:** This is a foundational package being actively developed. The architecture is solid, but implementation needs completion before integration into apps.
