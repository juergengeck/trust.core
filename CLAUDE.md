# CLAUDE.md

This file provides guidance to Claude Code when working with trust.core.

## Overview

**trust.core** is a platform-agnostic trust and identity management library for LAMA applications. It provides device identity, key management, and trust relationships built on the ONE platform.

## Architecture: Build-Time vs Runtime Dependencies

### Key Principle

trust.core imports from `@refinio/one.core` and `@refinio/one.models` at **build-time only**. Consuming projects (lama, lama.electron, lama.browser) supply these dependencies at **runtime**.

```
BUILD TIME (TypeScript compilation):
  trust.core/tsconfig.json → @refinio/* resolves to ./packages/*
  → TypeScript compiles successfully using local types

RUNTIME:
  lama imports trust.core
  → lama's one.core/one.models instances are used
  → Single runtime instance (no duplicates)
```

### Directory Structure

```
trust.core/
├── packages/              # Build-time only (NOT included in runtime)
│   ├── one.core/          # @refinio/one.core@0.6.1-beta-3 (symlink)
│   └── one.models/        # @refinio/one.models@14.1.0-beta-5 (symlink)
├── models/                # Trust models
│   └── TrustModel.ts      # Core trust management
├── types/                 # Type definitions
│   └── trust-types.ts     # Trust interfaces and types
├── handlers/              # RPC-style handlers
│   └── TrustHandler.ts    # Transport-agnostic handler
├── services/              # Future: high-level trust services
└── package.json           # No dependencies on one.core/one.models
```

## Dependencies

### package.json

```json
{
  "dependencies": {}
  // NO @refinio/one.core or @refinio/one.models
  // Consuming projects supply these at runtime
}
```

### Why No Dependencies?

- **Avoid duplicate modules**: Consuming projects have their own one.core/one.models
- **Platform-agnostic**: trust.core doesn't choose which platform implementation to use
- **Single runtime instance**: Only the consuming project's instance is loaded

### TypeScript Resolution

**tsconfig.json**:
```json
{
  "paths": {
    "@refinio/*": ["./packages/*"]  // Build-time only
  }
}
```

TypeScript finds types in `./packages/*` during compilation, but these are NOT bundled or included at runtime.

## Core Components

### TrustModel

The main trust management model implementing the ONE.models Model interface:

**Features**:
- Device identity management with secure keychain integration
- Trust relationship database (trusted/untrusted/pending/revoked)
- Persistent storage via injected storage adapter
- Crypto API integration for signing operations
- Event-driven updates (onTrustChanged, onCredentialsUpdated)

**Usage Pattern** (in consuming apps):
```typescript
import { TrustModel } from '@trust/core/models/TrustModel.js';
import type { TrustStorageAdapter } from '@trust/core/types/trust-types.js';

// Platform-specific storage adapter
const storageAdapter: TrustStorageAdapter = {
  async getItem(key: string) { /* ... */ },
  async setItem(key: string, value: string) { /* ... */ },
  async removeItem(key: string) { /* ... */ }
};

// Create model with injected dependencies
const trustModel = new TrustModel(leuteModel, storageAdapter);
await trustModel.init();
```

### TrustHandler

RPC-style handler for transport-agnostic trust operations:

**Request/Response Pattern**:
```typescript
import { TrustHandler } from '@trust/core/handlers/TrustHandler.js';

const handler = new TrustHandler(trustModel);

// Set trust status
const result = await handler.setTrustStatus({
  deviceId: somePersonId,
  publicKey: 'ed25519_public_key',
  status: 'trusted'
});

// Evaluate trust
const evaluation = await handler.evaluateTrust({
  personId: somePersonId,
  context: 'communication'
});
```

**Methods**:
- `setTrustStatus()` - Add/update trust relationships
- `getTrustStatus()` - Query trust status
- `getTrustedDevices()` - List all trusted devices
- `verifyDeviceKey()` - Verify public key
- `evaluateTrust()` - Calculate trust level with confidence
- `getDeviceCredentials()` - Get own device credentials

### Trust Types

Comprehensive type definitions in `types/trust-types.ts`:

- **DeviceCredentials** - Device identity and keys
- **TrustStatus** - 'trusted' | 'untrusted' | 'pending' | 'revoked'
- **TrustEntry** - Trust relationship record
- **TrustLevel** - 'full' | 'limited' | 'temporary'
- **TrustEvaluation** - Trust score with confidence
- **TrustPermissions** - Fine-grained access control
- **TrustStorageAdapter** - Platform-specific persistence interface

## Building trust.core

```bash
npm install     # Installs devDependencies only
npm run build   # Compiles TypeScript using ./packages/* for types
npm run watch   # Watch mode for development
npm run clean   # Clean generated JS files
```

**Note**: Compiled output is co-located with source files (no dist/ directory).

## Consuming trust.core

Projects use trust.core via `file:` reference:

```json
// lama/package.json
{
  "dependencies": {
    "@trust/core": "file:../trust.core",
    "@refinio/one.core": "file:../lama.core/packages/one.core",
    "@refinio/one.models": "file:../lama.core/packages/one.models"
  }
}
```

At runtime:
- lama loads its own one.core/one.models
- trust.core models use those instances (single instance across app)

## Platform Integration Examples

### React Native (lama)

```typescript
// Adapter for AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrustStorageAdapter } from '@trust/core/types/trust-types.js';

const reactNativeStorageAdapter: TrustStorageAdapter = {
  async getItem(key: string) {
    return await AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  }
};

// Create trust model
import { TrustModel } from '@trust/core/models/TrustModel.js';
const trustModel = new TrustModel(leuteModel, reactNativeStorageAdapter);
```

### Electron (lama.electron)

```typescript
// Adapter for electron-store or localStorage
import type { TrustStorageAdapter } from '@trust/core/types/trust-types.js';

const electronStorageAdapter: TrustStorageAdapter = {
  async getItem(key: string) {
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    localStorage.removeItem(key);
  }
};
```

### Browser (lama.browser)

```typescript
// Adapter for IndexedDB or localStorage
const browserStorageAdapter: TrustStorageAdapter = {
  async getItem(key: string) {
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    localStorage.removeItem(key);
  }
};
```

## Trust Model Concepts

### Device Identity

Each device (app instance) has:
- **Device ID**: SHA256IdHash<Person> from ONE.core
- **Public Key**: Ed25519 signing key
- **Crypto API**: For signing without exposing private key

### Trust Relationships

Trust is tracked per device/person with:
- **Status**: trusted, untrusted, pending, revoked
- **Public Key**: Verified cryptographic identity
- **Timestamps**: When established and last verified
- **Persistence**: Saved to platform-specific storage

### Trust Evaluation

Sophisticated trust scoring considering:
- Trust status (trusted = 0.9, pending = 0.3, etc.)
- Verification recency (boost confidence for recent verifications)
- Context (general, file-transfer, communication)
- Returns level (0.0-1.0) and confidence (0.0-1.0)

## Version Synchronization

All projects use synchronized versions:

```
Current versions:
- @refinio/one.core:   0.6.1-beta-3
- @refinio/one.models: 14.1.0-beta-5
```

When updating:
1. Update trust.core/packages/ symlinks
2. Update all consuming projects
3. Test across all platforms

## Engineering Principles

From ~/.claude/CLAUDE.md:
- **No fallbacks**: Fail fast and throw - fix problems, don't mitigate
- **No delays**: Operations should be immediate or properly async
- **Use what you have**: Don't create redundant abstractions
- **Fix, do not mitigate**: Understand before implementing
- **SHA256Hash and SHA256IdHash are branded types**: Strings with type safety

## Related Documentation

- `../instance-trust.md` - Trust model architecture and protocols
- `../lama.core/CLAUDE.md` - Lama core architecture patterns
- `../chat.core/CLAUDE.md` - Chat core architecture patterns

## Future Enhancements

### Planned Features
- **TrustService** - High-level trust operations and policies
- **Trust chain verification** - Multi-hop trust paths
- **Organizational trust policies** - Domain-based automatic trust
- **External verifications** - Video calls, shared contacts, etc.
- **Time-based trust decay** - Reduce trust over time without interaction
- **Place-based trust** - Geographic verification (when implemented)

### Extensibility
- Custom trust evaluation algorithms
- Pluggable verification methods
- Trust certificate issuance
- Notary integration for trust chains
