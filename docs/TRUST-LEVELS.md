# Trust Levels

## Overview

LAMA uses a four-level trust system to categorize relationships and determine permissions for data access and communication.

Trust levels follow the **lama logo gradient spectrum**: white (low) → pink (medium) → blue (high) → dark blue (self)

## Trust Level Definitions

### `self` - Highest Trust (Dark Blue)
- **Color**: Dark blue (`#1e3a8a`) - Bottom of lama logo gradient
- **Purpose**: Trust assigned to own devices
- **Use Case**: Internet of Me (IoM) - multiple devices owned by the same person
- **Auto-assigned**: Yes, during device pairing within same identity
- **Permissions**: Full access to all resources
- **Examples**: Your phone, laptop, tablet when paired to same identity

### `high` - Manually Verified (Blue)
- **Color**: Blue (`#3b82f6`) - Lower-middle of lama logo gradient
- **Purpose**: Contacts with strong authentication and manual verification
- **Use Case**: Close collaborators, family members, business partners
- **Auto-assigned**: No, requires explicit user action
- **Permissions**: Extensive but can be customized
- **Examples**: Verified via video call, in-person QR code scan, or certificate exchange
- **Verification Methods**:
  - QR code scan in person
  - Video call verification
  - Shared trusted certificate authority
  - Multi-factor verification

### `medium` - Default for Invitations (Pink/Magenta)
- **Color**: Pink/Magenta (`#ec4899`) - Middle of lama logo gradient
- **Purpose**: Contacts added via invitation system
- **Use Case**: New connections, collaborators, casual contacts
- **Auto-assigned**: **Yes**, when invitation is accepted (send or receive)
- **Permissions**: Standard communication permissions (chat, basic file sharing)
- **Examples**: Someone you invited via link, someone who invited you
- **Upgrade Path**: Can be manually upgraded to `high` after additional verification

### `low` - Limited Verification (Light/White)
- **Color**: Light gray/white (`#f3f4f6`) - Top of lama logo gradient
- **Purpose**: Contacts with minimal or indirect trust
- **Use Case**: Transitive trust, temporary contacts, limited interactions
- **Auto-assigned**: May be assigned for transitive trust scenarios
- **Permissions**: Minimal (typically view-only, no file access)
- **Examples**: Friend-of-friend, temporary collaboration, guest access
- **Downgrade**: Contacts may be downgraded to `low` if trust is questioned

## Trust Level Assignment

### Automatic Assignment

| Event | Trust Level | Notes |
|-------|-------------|-------|
| Device pairing (IoM) | `self` | Own devices within same identity |
| Accept invitation | `medium` | Default for P2P connections via invitation |
| Send invitation (accepted) | `medium` | Default when your invitation is accepted |

### Manual Assignment

Users can manually set trust levels through:
- Contact settings UI
- TrustPlan API: `setTrustLevel({ personId, trustLevel, reason })`
- Certificate-based verification flows

## Permissions by Trust Level

| Permission | self | high | medium | low |
|------------|------|------|--------|-----|
| Chat | ✅ | ✅ | ✅ | ✅ |
| Voice/Video Call | ✅ | ✅ | ✅ | ❌ |
| File Read | ✅ | ✅ | ✅ | ❌ |
| File Write | ✅ | ✅ | ❌ | ❌ |
| Sync Data | ✅ | ✅ | ✅ | ❌ |
| See Online Status | ✅ | ✅ | ✅ | ❌ |
| See Location | ✅ | ✅ | ❌ | ❌ |
| See Activity | ✅ | ✅ | ❌ | ❌ |
| Add to Groups | ✅ | ✅ | ✅ | ❌ |
| Share Contacts | ✅ | ✅ | ❌ | ❌ |

*Note: Permissions can be customized per-contact basis*

## Visual Design

### Color Gradient Mapping

Trust levels are color-coded following the lama logo gradient:

```
      low (Light/White #f3f4f6)
       ↓
    medium (Pink/Magenta #ec4899)
       ↓
     high (Blue #3b82f6)
       ↓
     self (Dark Blue #1e3a8a)
```

The gradient creates a natural visual hierarchy:
- **Darker colors** = **Higher trust**
- **Lighter colors** = **Lower trust**

This makes trust levels immediately recognizable in the UI.

## Chain of Trust

Trust levels enable chain-of-trust visualization:
- **Direct trust**: Contacts you directly established trust with
- **Transitive trust**: Contacts trusted by your trusted contacts
- **Trust path**: Visual tree showing how trust was established

See `TrustChain` and `TrustChainNode` types for implementation details.

## API Usage

### Setting Trust Level

```typescript
import { TrustPlan } from '@trust/core/plans/TrustPlan.js';

// Set trust level when accepting invitation
await trustPlan.setTrustLevel({
  personId: contactPersonId,
  trustLevel: 'medium',
  reason: 'Accepted invitation'
});

// Upgrade to high trust after verification
await trustPlan.setTrustLevel({
  personId: contactPersonId,
  trustLevel: 'high',
  reason: 'Verified via video call'
});
```

### Getting Trust Level

```typescript
const response = await trustPlan.getTrustLevel({
  personId: contactPersonId
});

console.log(`Trust level: ${response.trustLevel}`); // 'medium', 'high', etc.
```

### Getting Trust Chain

```typescript
const response = await trustPlan.getTrustChain({
  personId: contactPersonId,
  maxDepth: 3 // How many hops to traverse
});

// Visualize the trust chain
console.log('Trust chain:', response.chain);
// chain.root - Starting point (self)
// chain.nodes - All nodes in chain
// chain.edges - Connections between nodes with trust levels
```

## Storage

Trust levels are stored in `TrustRelationship` ONE.core versioned objects:

```typescript
interface TrustRelationship {
  $type$: 'TrustRelationship';
  peer: SHA256IdHash<Person>;
  status: TrustStatus; // 'trusted', 'untrusted', 'pending', 'revoked'
  trustLevel?: TrustLevel; // 'self', 'high', 'medium', 'low'
  establishedAt: string;
  reason?: string;
  context?: string;
  // ... other fields
}
```

## Migration from Previous System

Previous system used `'full' | 'limited' | 'temporary'` trust levels. These map to the new system as:

- `'full'` → `'high'` (manually verified, extensive permissions)
- `'limited'` → `'medium'` (standard permissions)
- `'temporary'` → `'low'` (minimal permissions, may expire)

No automatic migration is performed. Existing relationships will need to be re-established or manually updated.

## Future Enhancements

- **Automatic trust degradation**: Reduce trust level after period of inactivity
- **Trust scoring**: Numerical confidence scores (already implemented in `TrustEvaluation`)
- **Contextual trust**: Different trust levels for different contexts (file-transfer vs communication)
- **Trust revocation**: Explicit trust removal with audit trail
- **Certificate-based trust**: Integration with X.509/VC certificates for organizational trust
