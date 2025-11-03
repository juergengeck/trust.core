/**
 * TrustRelationship Recipe
 *
 * ONE.core recipe for storing trust relationships between devices/persons.
 * Integrates with ONE.models TrustedKeysManager and TrustKeysCertificate.
 */

import type { Recipe, OneObjectTypeNames, Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * Trust status values
 */
export type TrustStatus = 'trusted' | 'untrusted' | 'pending' | 'revoked';

/**
 * Trust level for app-to-app communication
 */
export type TrustLevel = 'full' | 'limited' | 'temporary';

/**
 * TrustRelationship - Versioned object storing trust status for a person/device
 *
 * This is stored as a ONE.core versioned object and can be:
 * - Posted to channels for sharing trust attestations
 * - Signed to create TrustKeysCertificate
 * - Exported as Verifiable Credentials
 *
 * Relationships:
 * - issuer (implicit from signature) - Who declares this trust
 * - subject (peer) - Who is trusted
 * - status - Current trust level
 * - permissions - Granted capabilities
 */
export interface TrustRelationship {
    $type$: 'TrustRelationship';
    $version$: 'v1';

    // Subject of trust (who is being trusted)
    peer: SHA256IdHash<Person>;
    peerPublicKey: string;  // Ed25519 public key for verification

    // Trust assessment
    status: TrustStatus;
    trustLevel?: TrustLevel;

    // Permissions granted
    permissions?: {
        chat?: boolean;
        voiceCall?: boolean;
        videoCall?: boolean;
        fileRead?: boolean;
        fileWrite?: boolean;
        syncData?: boolean;
        seeOnlineStatus?: boolean;
        seeLocation?: boolean;
        seeActivity?: boolean;
        addToGroups?: boolean;
        shareContacts?: boolean;
    };

    // Timestamps
    establishedAt: string;  // ISO 8601 date
    lastVerified?: string;  // ISO 8601 date
    validUntil?: string;    // ISO 8601 date (for temporary trust)

    // Trust reasoning
    reason?: string;  // Why this trust was established
    context?: string; // Context: 'pairing', 'mutual-contact', 'organizational', 'user-consent'

    // Verification metadata
    verificationMethod?: string;  // 'qr-code', 'video-call', 'shared-contacts', 'certificate'
    verificationProof?: SHA256Hash<any>;  // Link to certificate or other proof
}

/**
 * ONE.core recipe definition for TrustRelationship
 */
export const TrustRelationshipRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'TrustRelationship',
    rule: [
        {
            itemprop: 'peer',
            itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) }
        },
        {
            itemprop: 'peerPublicKey',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'status',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'trustLevel',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'permissions',
            itemtype: { type: 'stringifiable' },  // JSON-serializable object
            optional: true
        },
        {
            itemprop: 'establishedAt',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'lastVerified',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'validUntil',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'reason',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'context',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'verificationMethod',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'verificationProof',
            itemtype: { type: 'string' },  // Store hash as string
            optional: true
        }
    ]
};

/**
 * Reverse map for querying TrustRelationship objects
 */
export const TrustRelationshipReverseMap: [OneObjectTypeNames, Set<string>] = [
    'TrustRelationship',
    new Set(['peer'])  // Index by peer for fast lookups
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneVersionedObjectInterfaces {
        TrustRelationship: TrustRelationship;
    }
}
