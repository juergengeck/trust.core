# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**trust.core** is a platform-agnostic trust and identity management library for LAMA applications. It provides device identity, key management, and trust relationships built on the ONE platform.

## Directory Structure

```
trust.core/
├── packages/              # Build-time dependencies (symlinks to ../packages/)
│   ├── one.core/          # @refinio/one.core@0.6.1-beta-3
│   └── one.models/        # @refinio/one.models@14.1.0-beta-5
├── models/                # Trust models
│   └── TrustModel.ts      # Core trust management with ONE.core integration
├── types/                 # Type definitions
│   └── trust-types.ts     # Trust interfaces and types
├── recipes/               # ONE.core recipe definitions
│   ├── TrustRelationship.ts     # Versioned trust relationship objects
│   ├── GroupAttestation.ts      # Unversioned group membership certificates
│   └── CertificateRegistry.ts   # Versioned certificate storage
├── plans/                 # RPC-style plans
│   └── TrustPlan.ts       # Transport-agnostic trust plan
└── services/              # Future: high-level trust services
```

## Build System

**Dependencies Note**: package.json has file: references to `@refinio/one.core` and `@refinio/one.models` located in `../packages/`. TypeScript resolves these via tsconfig.json paths. Consuming projects should use their own instances at runtime to ensure a single shared instance across the application.

### Commands

```bash
npm install     # Install devDependencies only (TypeScript)
npm run build   # Compile TypeScript (output co-located with source)
npm run watch   # Watch mode for development
npm run clean   # Remove generated .js files (excluding node_modules and packages)
```

**Note**: No `dist/` directory - compiled JavaScript is co-located with source files.

## Core Components

### TrustModel (models/TrustModel.ts)

Main trust management model implementing the ONE.models Model interface with ONE.core storage:

**Features**:
- Device identity from ONE.core keychain (SHA256IdHash<Person>)
- Trust relationships stored as ONE.core versioned objects (TrustRelationship)
- Integration with TrustedKeysManager for certificate validation
- Combined trust evaluation (relationship status + certificate validation)
- Event-driven updates (onTrustChanged, onCredentialsUpdated)
- StateMachine lifecycle (Uninitialised → Initialised)

**Usage Pattern**:
```typescript
import { TrustModel } from '@trust/core/models/TrustModel.js';

// Create model with injected dependencies
const trustModel = new TrustModel(leuteModel, trustedKeysManager);
await trustModel.init();

// Set trust (stores TrustRelationship object in ONE.core)
await trustModel.setTrustStatus(peerPersonId, peerPublicKey, 'trusted', options);

// Evaluate trust (combines relationship + certificates)
const evaluation = await trustModel.evaluateTrust(peerPersonId, 'communication');
// Returns: { level: 0-1, confidence: 0-1, reason: string }
```

### Recipes (recipes/)

ONE.core recipe definitions for trust-related objects:

**TrustRelationship** (versioned):
- Stores trust status for a person/device
- Indexed by `peer` for fast lookups via reverse maps
- Can be posted to channels, signed to create certificates, exported as VCs
- Fields: peer, peerPublicKey, status, trustLevel, permissions, timestamps, verification metadata

**GroupAttestation** (unversioned certificate):
- Attests to group membership
- Created by group owner, distributed to members
- Fields: groupId, groupHash, members[], issuer, validity period

**CertificateRegistry** (versioned with id):
- Stores certificate hashes for audit trail
- Versioned for complete history
- Fields: id, certificates[]

### TrustPlan (plans/TrustPlan.ts)

RPC-style plan for transport-agnostic trust operations. Wraps TrustModel methods in request/response pattern for cross-platform use.

**Key Methods**: setTrustStatus, getTrustStatus, getTrustedDevices, verifyDeviceKey, evaluateTrust, getDeviceCredentials

### Types (types/trust-types.ts)

Core type definitions: DeviceCredentials, TrustStatus, TrustEntry, TrustLevel, TrustEvaluation, TrustPermissions

## Integration Architecture

### Storage Layer

TrustModel uses ONE.core's object storage:
- **storeVersionedObject()** - Store TrustRelationship objects
- **getAllEntries()** - Query relationships via reverse maps
- **Keychain** - Device credentials (SHA256IdHash<Person>, public/private keys)
- **Crypto API** - Sign/verify without exposing private keys

### Certificate Validation

TrustedKeysManager integration:
- **getKeyTrustInfo()** - Validate keys via TrustKeysCertificate chain
- Returns: { trusted: boolean, reason: string, certificates: [...] }
- Trust evaluation combines relationship status + certificate validation

### Recipe Registration

Recipes must be registered with ONE.core before use. Export from package:
```typescript
export { TrustRelationshipRecipe, TrustRelationshipReverseMap } from './recipes/TrustRelationship.js';
export { GroupAttestationRecipe, GroupAttestationReverseMap } from './recipes/GroupAttestation.js';
export { CertificateRegistryRecipe, CertificateRegistryReverseMap } from './recipes/CertificateRegistry.js';
```

## Trust Evaluation Algorithm

Trust scoring combines multiple factors:

1. **Status-based score**: trusted=0.9, pending=0.3, untrusted=0.1, revoked=0.0
2. **Certificate validation**: TrustedKeysManager checks TrustKeysCertificate (boosts confidence +0.2)
3. **Recency**: Recent verification (<7 days) boosts confidence +0.1, stale (>30 days) reduces -0.1
4. **Context modifiers**: 'file-transfer' requires higher threshold, 'communication' accepts standard
5. **Result**: { level: 0-1, confidence: 0-1, reason: string }

## Trust Establishment Methods

1. **QR Code Pairing** - Exchange keys, create TrustRelationship with status='trusted', issue certificate
2. **Mutual Contacts** - 3+ shared contacts enables automatic limited trust
3. **Organizational Policy** - Same domain/org with admin certificate chain
4. **Video Call Verification** - Human verification for high-confidence trust
5. **Certificate Only** - Valid TrustKeysCertificate from trusted issuer (requires user approval)

## Key Implementation Details

### Branded Types
SHA256Hash and SHA256IdHash are branded string types (strings with type safety). Don't treat them as regular strings in type annotations.

### StateMachine Lifecycle
TrustModel uses StateMachine: Uninitialised → init event → Initialised → shutdown event → Uninitialised

### Querying Trust Relationships
Use reverse maps: `getAllEntries(TrustRelationshipReverseMap, peerPersonId)` to find TrustRelationship objects by peer.

### Recipe Version Patterns
- **Versioned objects**: Have `$version$` field (TrustRelationship, CertificateRegistry)
- **Versioned with ID**: Have `id` field with `isId: true` (CertificateRegistry)
- **Unversioned**: No version field (GroupAttestation - certificates)

## Current Status

**Completed**: TrustRelationship, GroupAttestation, CertificateRegistry recipes; TrustModel with ONE.core storage; TrustPlan; Architecture docs

**In Progress**: Recipe registration, TrustedKeysManager method name fix (keyTrustInfo → getKeyTrustInfo), TypeScript build fixes, proper object querying pattern

**TODO**: VC generation (exportTrustChainAsVC), comprehensive testing, certificate issuance on trust establishment

See README.md for detailed status and ARCHITECTURE.md for complete design.

## Related Documentation

- `ARCHITECTURE.md` - Complete trust architecture and design patterns
- `README.md` - Project status, TODO items, integration points
- `../instance-trust.md` - App-to-app trust protocols
- `../lama.core/CLAUDE.md` - Lama core architecture
