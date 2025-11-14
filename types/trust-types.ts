/**
 * Trust Core Type Definitions
 *
 * Platform-agnostic types for trust relationships, device identity,
 * and credential management across LAMA applications.
 */

import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

/**
 * Device credentials for secure communication
 */
export interface DeviceCredentials {
    deviceId: SHA256IdHash<Person>;
    secretKey: string;  // Empty string when using crypto API
    publicKey: string;
}

/**
 * Trust relationship status
 */
export type TrustStatus = 'trusted' | 'untrusted' | 'pending' | 'revoked';

/**
 * Trust relationship entry
 */
export interface TrustEntry {
    deviceId: SHA256IdHash<Person>;
    publicKey: string;
    status: TrustStatus;
    establishedAt: Date;
    lastVerified?: Date;
}

/**
 * Trust level for app-to-app communication
 *
 * Levels:
 * - self: Trust assigned to own devices (highest trust)
 * - high: Manually verified contacts with strong authentication
 * - medium: Contacts added via invitation (default for accepted invites)
 * - low: Contacts with limited verification or indirect trust
 */
export type TrustLevel = 'self' | 'high' | 'medium' | 'low';

/**
 * Trust evaluation result with confidence score
 */
export interface TrustEvaluation {
    level: number;          // 0.0 to 1.0
    confidence: number;     // 0.0 to 1.0
    trustLevel?: TrustLevel;
    reason?: string;
}

/**
 * Trust permissions for peer-to-peer operations
 */
export interface TrustPermissions {
    // Communication
    chat: boolean;
    voiceCall: boolean;
    videoCall: boolean;

    // Data access
    fileRead: boolean;
    fileWrite: boolean;
    syncData: boolean;

    // Presence
    seeOnlineStatus: boolean;
    seeLocation: boolean;
    seeActivity: boolean;

    // Administrative
    addToGroups: boolean;
    shareContacts: boolean;
}

/**
 * Persisted trust relationship with cryptographic proof
 */
export interface PersistedTrust {
    personId: SHA256IdHash<Person>;
    trustLevel: TrustLevel;
    permissions: TrustPermissions;
    establishedAt: Date;
    validUntil?: Date;
    reason: string;
    trustProof?: {
        ourSignature: string;
        theirSignature: string;
        agreedPermissions: string;
    };
}

/**
 * Peer identity information for trust establishment
 */
export interface PeerIdentity {
    personId: SHA256IdHash<Person>;
    publicKey: string;
    name?: string;
    metadata?: Record<string, any>;
}

/**
 * Trust establishment result
 */
export interface TrustResult {
    trusted: boolean;
    reason: string;
    trustLevel?: TrustLevel;
    permissions?: TrustPermissions;
}

/**
 * Storage adapter interface for platform-specific persistence
 */
export interface TrustStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

/**
 * Trust chain node for visualizing trust relationships
 */
export interface TrustChainNode {
    personId: SHA256IdHash<Person>;
    name: string;
    trustLevel: TrustLevel;
    establishedAt: Date;
    establishedBy?: SHA256IdHash<Person>; // Who established this trust
    transitiveFrom?: SHA256IdHash<Person>[]; // Transitive trust path
    depth: number; // How many hops from root (self = 0)
}

/**
 * Trust chain tree for hierarchical visualization
 */
export interface TrustChain {
    root: TrustChainNode; // Starting point (usually self)
    nodes: TrustChainNode[]; // All nodes in the trust chain
    edges: Array<{
        from: SHA256IdHash<Person>;
        to: SHA256IdHash<Person>;
        trustLevel: TrustLevel;
    }>;
}
