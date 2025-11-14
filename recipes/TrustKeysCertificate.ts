/**
 * TrustKeysCertificate Recipe
 *
 * Device trust certificate compatible with ONE.models TrustedKeysManager.
 * Extends Certificate with device-specific trust information.
 */

import type { Recipe, OneObjectTypeNames, Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * TrustKeysCertificate
 *
 * Device trust certificate that integrates with TrustedKeysManager.
 * Versioned object with time-bound validity and revocation support.
 *
 * This extends the base Certificate with device-specific fields:
 * - Device public key validation
 * - Trust relationship linkage
 * - Device-to-device trust chains
 */
export interface TrustKeysCertificate {
    $type$: 'TrustKeysCertificate';

    // Stable ID for versioning
    id: string;

    // Certificate type (always 'device' for TrustKeysCertificate)
    certificateType: 'device';
    status: 'valid' | 'expired' | 'revoked' | 'suspended';

    // Subject device
    subject: SHA256IdHash<Person>;  // Device owner's person ID
    subjectPublicKey: string;  // Ed25519 public key (hex)
    deviceName?: string;  // Optional device name

    // Issuer (trusting device)
    issuer: SHA256IdHash<Person>;
    issuerPublicKey: string;  // Ed25519 public key (hex)

    // Validity period
    validFrom: number;   // Unix timestamp (milliseconds)
    validUntil: number;  // Unix timestamp (milliseconds)

    // Certificate chain
    issuedBy?: SHA256Hash<TrustKeysCertificate>;  // Parent certificate (if chained)
    chainDepth: number;  // 0 = direct trust, 1 = one hop, etc.

    // Trust metadata
    trustLevel: 'full' | 'limited' | 'temporary';
    trustReason?: string;  // Why this device is trusted
    verificationMethod?: string;  // How trust was verified (e.g., 'qr-code', 'video-call')

    // Permissions (device capabilities)
    permissions?: {
        chat?: boolean;
        voiceCall?: boolean;
        videoCall?: boolean;
        fileRead?: boolean;
        fileWrite?: boolean;
        syncData?: boolean;
        seeOnlineStatus?: boolean;
    };

    // Metadata
    issuedAt: number;     // When certificate was created
    serialNumber: string;  // Unique serial number
    version: number;       // Version number (increments with each update)

    // Link to TrustRelationship (for backward compatibility)
    trustRelationship?: SHA256Hash<any>;  // Hash of TrustRelationship object

    // Signature (computed by ONE.core when signed)
    signature?: string;    // Ed25519 signature (hex)
}

/**
 * ONE.core recipe definition for TrustKeysCertificate
 */
export const TrustKeysCertificateRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'TrustKeysCertificate',
    rule: [
        {
            itemprop: 'id',
            isId: true,  // Makes this versioned with stable ID
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'certificateType',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'status',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'subject',
            itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) }
        },
        {
            itemprop: 'subjectPublicKey',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'deviceName',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'issuer',
            itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) }
        },
        {
            itemprop: 'issuerPublicKey',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'validFrom',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'validUntil',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'issuedBy',
            itemtype: { type: 'string' },  // Hash of parent certificate
            optional: true
        },
        {
            itemprop: 'chainDepth',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'trustLevel',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'trustReason',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'verificationMethod',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'permissions',
            itemtype: { type: 'stringifiable' },  // JSON-serializable object
            optional: true
        },
        {
            itemprop: 'issuedAt',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'serialNumber',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'version',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'trustRelationship',
            itemtype: { type: 'string' },  // Hash of TrustRelationship
            optional: true
        },
        {
            itemprop: 'signature',
            itemtype: { type: 'string' },
            optional: true
        }
    ]
};

/**
 * Reverse map for querying TrustKeysCertificate objects
 */
export const TrustKeysCertificateReverseMap: [OneObjectTypeNames, Set<string>] = [
    'TrustKeysCertificate',
    new Set(['id', 'subject', 'issuer', 'subjectPublicKey'])
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneIdObjectInterfaces {
        TrustKeysCertificate: Pick<TrustKeysCertificate, 'id' | '$type$'>;
    }

    export interface OneVersionedObjectInterfaces {
        TrustKeysCertificate: TrustKeysCertificate;
    }
}
