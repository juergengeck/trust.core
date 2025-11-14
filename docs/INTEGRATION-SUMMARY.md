# Trust Level Integration Summary

## Overview

Implemented a four-level trust system (`self`, `high`, `medium`, `low`) with automatic assignment during invitation acceptance and support for chain of trust visualization.

## What Was Implemented

### 1. Trust Level Definitions (trust.core)

**Files Modified:**
- `types/trust-types.ts` - Added new trust levels and chain types
- `recipes/TrustRelationship.ts` - Updated trust level type
- `plans/TrustPlan.ts` - Added setTrustLevel, getTrustLevel, getTrustChain methods
- `models/TrustModel.ts` - Implemented trust level and chain of trust logic

**New Types:**
```typescript
type TrustLevel = 'self' | 'high' | 'medium' | 'low';

interface TrustChainNode {
  personId: SHA256IdHash<Person>;
  name: string;
  trustLevel: TrustLevel;
  establishedAt: Date;
  establishedBy?: SHA256IdHash<Person>;
  transitiveFrom?: SHA256IdHash<Person>[];
  depth: number;
}

interface TrustChain {
  root: TrustChainNode;
  nodes: TrustChainNode[];
  edges: Array<{
    from: SHA256IdHash<Person>;
    to: SHA256IdHash<Person>;
    trustLevel: TrustLevel;
  }>;
}
```

**New Methods:**
```typescript
// TrustPlan
await trustPlan.setTrustLevel({
  personId: SHA256IdHash<Person>,
  trustLevel: 'medium',
  establishedBy?: SHA256IdHash<Person>,
  reason?: string
});

await trustPlan.getTrustLevel({
  personId: SHA256IdHash<Person>
});

await trustPlan.getTrustChain({
  personId: SHA256IdHash<Person>,
  maxDepth?: number
});
```

### 2. Automatic Trust Assignment (connection.core)

**Files Modified:**
- `src/plans/ConnectionPlan.ts` - Added trust level assignment on invitation acceptance

**Behavior:**
- When an invitation is accepted (both sent and received), the contact is automatically assigned **medium** trust level
- Trust assignment is logged but non-blocking (pairing completes even if trust assignment fails)
- Optional integration - only assigns trust if `trustCorePlan` is provided to ConnectionPlan constructor

**Integration Example:**
```typescript
const connectionPlan = new ConnectionPlan(
  nodeOneCore,
  storageProvider,
  webUrl,
  discoveryConfig,
  trustDeps,
  pairingCallbacks,
  trustCorePlan  // Optional: trust.core's TrustPlan instance
);
```

### 3. Documentation

Created comprehensive documentation:
- `docs/TRUST-LEVELS.md` - Trust level definitions and use cases
- `docs/INTEGRATION-SUMMARY.md` - This file

## Trust Level Semantics

| Level | Description | Use Cases |
|-------|-------------|-----------|
| **self** | Highest trust - own devices | IoM device pairing, multi-device sync |
| **high** | Manually verified contacts | Face-to-face verification, strong authentication |
| **medium** | Invitation-based contacts | **Default for accepted invitations** |
| **low** | Limited verification | Transitive trust, indirect connections |

## Usage in Platforms

### Platform Integration Steps

1. **Install trust.core:**
   ```bash
   npm install @trust/core
   ```

2. **Initialize TrustPlan:**
   ```typescript
   import { TrustPlan } from '@trust/core/plans/TrustPlan';
   import { TrustModel } from '@trust/core/models/TrustModel';

   const trustModel = new TrustModel(nodeOneCore, leuteModel);
   await trustModel.init();

   const trustPlan = new TrustPlan(trustModel);
   ```

3. **Pass to ConnectionPlan:**
   ```typescript
   const connectionPlan = new ConnectionPlan(
     nodeOneCore,
     storageProvider,
     webUrl,
     discoveryConfig,
     trustDeps,
     pairingCallbacks,
     trustPlan  // Optional integration
   );
   ```

4. **Query trust levels:**
   ```typescript
   // Get trust level for a contact
   const result = await trustPlan.getTrustLevel({ personId });
   console.log('Trust level:', result.trustLevel); // 'medium', 'high', etc.

   // Get chain of trust for visualization
   const chain = await trustPlan.getTrustChain({
     personId,
     maxDepth: 3
   });
   console.log('Trust chain nodes:', chain.nodes);
   console.log('Trust chain edges:', chain.edges);
   ```

### Manual Trust Level Changes

Platforms can manually update trust levels (e.g., after face-to-face verification):

```typescript
await trustPlan.setTrustLevel({
  personId,
  trustLevel: 'high',
  establishedBy: ownerId,
  reason: 'Face-to-face verification'
});
```

## Next Steps: Chain of Trust Visualization

### UI Component Requirements

1. **Expandable Contact Cards**
   - Show trust level badge (self/high/medium/low)
   - Expand button to show chain of trust tree view

2. **Trust Chain Tree View**
   - Root node: "Self" (logged-in user)
   - Child nodes: Direct contacts with trust levels
   - Visual indicators: Color-coded by trust level
   - Interactive: Click nodes to navigate to contact details

3. **Example Structure:**
   ```
   Self (self)
   ├─ Alice (high) - Manually verified
   ├─ Bob (medium) - Accepted invitation
   │  └─ Charlie (low) - Transitive via Bob
   └─ Dave (medium) - Accepted invitation
   ```

### Recommended Libraries
- **react-d3-tree** - Hierarchical tree visualization
- **vis-network** - Graph visualization with physics
- **cytoscape.js** - Graph theory / network library

### API Contract for UI

```typescript
// Fetch trust chain for display
interface TrustChainRequest {
  personId: SHA256IdHash<Person>;
  maxDepth?: number; // Default: 3
}

interface TrustChainResponse {
  chain?: TrustChain;
  error?: string;
}

// Usage in UI
const { chain, error } = await model.trustPlan.getTrustChain({
  personId: selectedContact,
  maxDepth: 3
});

if (chain) {
  renderTrustTree(chain.root, chain.nodes, chain.edges);
}
```

## Implementation Notes

### Design Decisions

1. **Optional Integration**: connection.core doesn't require trust.core at build time, allowing platforms to opt-in
2. **Non-blocking**: Trust assignment failures don't block pairing completion
3. **Default to Medium**: All invitation-based connections get 'medium' trust (safe default)
4. **Chain Storage**: Trust chains are computed on-demand (not stored) from TrustRelationship objects
5. **Transitive Trust**: Currently stub implementation - full transitive trust calculation deferred to future phase

### Known Limitations

1. **IoM Detection**: ConnectionPlan doesn't yet distinguish IoM (Internet of Me) device pairing from regular invitations
   - TODO: IoM pairings should get 'self' trust level
   - Requires PairingPlan to expose pairing type

2. **Transitive Trust**: TrustModel.getTrustChain() has placeholder logic for transitive trust paths
   - Currently only shows direct connections
   - Full implementation requires iterating all trusted contacts recursively

3. **Person Names**: TrustModel uses truncated person IDs as names
   - TODO: Integrate with LeuteModel to fetch actual contact names

## Testing

### Manual Testing Steps

1. **Test Trust Assignment:**
   ```typescript
   // Accept an invitation
   await connectionPlan.acceptInvitation({ invitationId });

   // Verify trust level was assigned
   const result = await trustPlan.getTrustLevel({ personId });
   console.assert(result.trustLevel === 'medium', 'Should be medium trust');
   ```

2. **Test Chain Retrieval:**
   ```typescript
   const chain = await trustPlan.getTrustChain({
     personId: contactId,
     maxDepth: 2
   });

   console.log('Root:', chain.root);
   console.log('Nodes:', chain.nodes);
   console.log('Edges:', chain.edges);
   ```

3. **Test Manual Trust Update:**
   ```typescript
   await trustPlan.setTrustLevel({
     personId: contactId,
     trustLevel: 'high',
     reason: 'Manual verification'
   });

   const result = await trustPlan.getTrustLevel({ personId: contactId });
   console.assert(result.trustLevel === 'high', 'Should be high trust');
   ```

## Migration Notes

### For Existing Codebases

**No breaking changes** - this is additive functionality:
- Existing TrustRelationship objects without trustLevel property continue to work
- ConnectionPlan without trustCorePlan parameter continues to work (no trust assignment)
- Platforms can adopt incrementally

**Optional Migration Path:**
1. Install @trust/core as dependency
2. Initialize TrustPlan in platform initialization
3. Pass TrustPlan to ConnectionPlan constructor
4. Add UI components for trust level display
5. Add UI components for chain of trust visualization

## Version Compatibility

- **trust.core**: ^1.0.0
- **connection.core**: ^0.1.0 (with optional @trust/core peer dependency)
- **ONE.core**: ^0.6.1-beta-3
- **ONE.models**: ^14.1.0-beta-5

## Build Status

✅ trust.core builds successfully
✅ connection.core builds successfully (with optional trust.core integration)
✅ No breaking changes to existing APIs
