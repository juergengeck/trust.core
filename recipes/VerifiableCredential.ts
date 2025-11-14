/**
 * VerifiableCredential Recipe
 *
 * W3C Verifiable Credentials v2.0 compatible credential storage.
 * Stores VCs as ONE.core objects for synchronization and persistence.
 */

import type { Recipe, OneObjectTypeNames } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * W3C Verifiable Credential
 *
 * Standard-compliant credential that can be presented externally.
 * Stored as versioned object in ONE.core, can be exported as JSON-LD.
 *
 * This is the presentation layer for Certificate objects - any Certificate
 * can be converted to a VC and vice versa using VCBridge.
 */
export interface VerifiableCredential {
    $type$: 'VerifiableCredential';

    // W3C VC required fields
    '@context': string[];  // JSON-LD context (e.g., ["https://www.w3.org/2018/credentials/v1"])
    id: string;            // Unique credential ID (e.g., "urn:uuid:..." or "did:one:...")
    type: string[];        // VC types (e.g., ["VerifiableCredential", "DeviceTrustCredential"])

    // Issuer (who created this credential)
    issuer: string | {     // DID or issuer object
        id: string;        // DID (e.g., "did:one:sha256:...")
        name?: string;     // Optional issuer name
    };

    // Issuance date
    issuanceDate: string;  // ISO 8601 date-time (e.g., "2025-01-09T10:00:00Z")

    // Expiration (optional but recommended)
    expirationDate?: string;  // ISO 8601 date-time

    // Credential subject (what this VC attests to)
    credentialSubject: {
        id: string;        // Subject DID (e.g., "did:one:sha256:...")
        [key: string]: any;  // Claims about the subject (extensible)
    };

    // Proof (cryptographic signature)
    proof?: {
        type: string;      // Signature type (e.g., "Ed25519Signature2020")
        created: string;   // ISO 8601 date-time when proof was created
        proofPurpose: string;  // Purpose (e.g., "assertionMethod")
        verificationMethod: string;  // DID URL of verification method
        proofValue: string;  // Base64-encoded signature
    };

    // Additional standard fields
    credentialStatus?: {   // Revocation status
        id: string;        // Status list URL or DID
        type: string;      // Status type (e.g., "RevocationList2020")
    };

    // ONE.core specific metadata (not part of W3C standard)
    _oneMetadata?: {
        certificateHash?: SHA256Hash<any>;  // Link to underlying Certificate
        version?: number;   // Version number (for tracking updates)
        syncedAt?: number;  // Last sync timestamp
    };
}

/**
 * ONE.core recipe definition for VerifiableCredential
 */
export const VerifiableCredentialRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'VerifiableCredential',
    rule: [
        {
            itemprop: '@context',
            itemtype: {
                type: 'set',
                item: { type: 'string' }
            }
        },
        {
            itemprop: 'id',
            isId: true,  // Makes this versioned with stable ID
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'type',
            itemtype: {
                type: 'set',
                item: { type: 'string' }
            }
        },
        {
            itemprop: 'issuer',
            itemtype: { type: 'stringifiable' }  // Can be string or object
        },
        {
            itemprop: 'issuanceDate',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'expirationDate',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'credentialSubject',
            itemtype: { type: 'stringifiable' }  // JSON-serializable object
        },
        {
            itemprop: 'proof',
            itemtype: { type: 'stringifiable' },  // JSON-serializable object
            optional: true
        },
        {
            itemprop: 'credentialStatus',
            itemtype: { type: 'stringifiable' },  // JSON-serializable object
            optional: true
        },
        {
            itemprop: '_oneMetadata',
            itemtype: { type: 'stringifiable' },  // JSON-serializable object
            optional: true
        }
    ]
};

/**
 * Reverse map for querying VerifiableCredential objects
 */
export const VerifiableCredentialReverseMap: [OneObjectTypeNames, Set<string>] = [
    'VerifiableCredential',
    new Set(['id'])
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneIdObjectInterfaces {
        VerifiableCredential: Pick<VerifiableCredential, 'id' | '$type$'>;
    }

    export interface OneVersionedObjectInterfaces {
        VerifiableCredential: VerifiableCredential;
    }
}
