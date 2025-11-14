/**
 * Certificate Recipe
 *
 * Base certificate type for the trust system.
 * Time-bound with ONE.core versioning for lifecycle management.
 */

import type { Recipe, OneObjectTypeNames, Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * Certificate Type
 */
export type CertificateType =
    | 'identity'          // Identity certificate (root or intermediate)
    | 'device'            // Device certificate
    | 'service'           // Service certificate (e.g., API access)
    | 'attestation'       // Attestation certificate (claims about other entities)
    | 'delegation'        // Delegation certificate (transfer of authority)
    | 'revocation';       // Revocation certificate

/**
 * Certificate Status
 */
export type CertificateStatus =
    | 'valid'             // Currently valid
    | 'expired'           // Past validUntil
    | 'revoked'           // Explicitly revoked
    | 'suspended';        // Temporarily suspended

/**
 * Base Certificate
 *
 * Versioned object with ID property for lifecycle management:
 * - Extensions: New version with later validUntil
 * - Reductions: New version with earlier validUntil
 * - Revocation: New version with status='revoked' and validUntil in past
 *
 * Each certificate has a stable ID (SHA256IdHash), and versions represent
 * the certificate's lifecycle. Same certificate, different time bounds.
 */
export interface Certificate {
    $type$: 'Certificate';

    // Stable ID for versioning (e.g., "cert:identity:alice@example.com")
    id: string;

    // Certificate metadata
    certificateType: CertificateType;
    status: CertificateStatus;

    // Subject (who/what this certificate is about)
    subject: SHA256IdHash<Person> | string;  // Person ID or other identifier
    subjectPublicKey: string;  // Ed25519 public key (hex)

    // Issuer (who issued this certificate)
    issuer: SHA256IdHash<Person>;
    issuerPublicKey: string;  // Ed25519 public key (hex)

    // Validity period (time-bound)
    validFrom: number;   // Unix timestamp (milliseconds)
    validUntil: number;  // Unix timestamp (milliseconds)

    // Certificate chain
    issuedBy?: SHA256Hash<Certificate>;  // Parent certificate (if not root)
    chainDepth: number;  // 0 = root, 1 = first-level, etc.

    // Claims/attributes (extensible)
    claims?: {
        // Identity claims
        name?: string;
        email?: string;
        domain?: string;

        // Capability claims
        canSign?: boolean;
        canIssue?: boolean;
        canRevoke?: boolean;

        // Purpose/scope
        purposes?: string[];  // e.g., ['authentication', 'signing', 'encryption']
        scope?: string;       // e.g., 'domain:example.com', 'service:api'

        // Additional claims (extensible)
        [key: string]: any;
    };

    // Metadata
    issuedAt: number;     // When certificate was created
    serialNumber: string;  // Unique serial number
    version: number;       // Version number (increments with each update)

    // Signature (computed by ONE.core when signed)
    signature?: string;    // Ed25519 signature (hex)
}

/**
 * ONE.core recipe definition for Certificate
 */
export const CertificateRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'Certificate',
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
            itemtype: { type: 'string' }  // Can be Person ID or other identifier
        },
        {
            itemprop: 'subjectPublicKey',
            itemtype: { type: 'string' }
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
            itemprop: 'claims',
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
            itemprop: 'signature',
            itemtype: { type: 'string' },
            optional: true
        }
    ]
};

/**
 * Reverse map for querying Certificate objects
 */
export const CertificateReverseMap: [OneObjectTypeNames, Set<string>] = [
    'Certificate',
    new Set(['id', 'subject', 'issuer', 'certificateType'])
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneIdObjectInterfaces {
        Certificate: Pick<Certificate, 'id' | '$type$'>;
    }

    export interface OneVersionedObjectInterfaces {
        Certificate: Certificate;
    }
}
