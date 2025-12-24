/**
 * ConnectionAckCertificate Recipe
 *
 * Issued after verifying an encrypted nonce from ProfileResponse.
 * The decrypted nonce proves key ownership, establishing trust.
 */

import type { Recipe, OneObjectTypeNames, Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { License } from '@refinio/one.models/lib/recipes/Certificates/License.js';
import type { ProfileResponse } from './ProfileResponse.js';

/**
 * ConnectionAckCertificate
 *
 * Versioned certificate proving successful handshake completion.
 * Contains the decrypted nonce as proof of key ownership.
 */
export interface ConnectionAckCertificate {
    $type$: 'ConnectionAckCertificate';

    /** Stable ID for versioning (format: "connack:{responder}:{challenger}:{timestamp}") */
    id: string;

    /** Who responded (initiated the connection) */
    responder: SHA256IdHash<Person>;

    /** Who acknowledged (proved key ownership) */
    challenger: SHA256IdHash<Person>;

    /** Decrypted nonce proving key ownership (hex) */
    nonce: string;

    /** Reference to the ProfileResponse being acknowledged */
    profileResponse: SHA256Hash<ProfileResponse>;

    /** When this certificate was issued (Unix timestamp ms) */
    created: number;

    /** Certificate status */
    status: 'valid' | 'expired' | 'revoked';

    /** License for this certificate */
    license: SHA256Hash<License>;

    /** Validity period end (Unix timestamp ms) */
    validUntil: number;

    /** Certificate version (increments with updates) */
    version: number;
}

/**
 * ONE.core recipe definition for ConnectionAckCertificate
 */
export const ConnectionAckCertificateRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'ConnectionAckCertificate',
    rule: [
        {
            itemprop: 'id',
            isId: true,
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'responder',
            itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) }
        },
        {
            itemprop: 'challenger',
            itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) }
        },
        {
            itemprop: 'nonce',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'profileResponse',
            itemtype: { type: 'referenceToObj', allowedTypes: new Set(['ProfileResponse']) }
        },
        {
            itemprop: 'created',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'status',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'license',
            itemtype: { type: 'referenceToObj', allowedTypes: new Set(['License']) }
        },
        {
            itemprop: 'validUntil',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'version',
            itemtype: { type: 'number' }
        }
    ]
};

/**
 * Reverse map for querying ConnectionAckCertificate objects
 */
export const ConnectionAckCertificateReverseMap: [OneObjectTypeNames, Set<string>] = [
    'ConnectionAckCertificate',
    new Set(['id', 'responder', 'challenger', 'profileResponse'])
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneIdObjectInterfaces {
        ConnectionAckCertificate: Pick<ConnectionAckCertificate, 'id' | '$type$'>;
    }

    export interface OneVersionedObjectInterfaces {
        ConnectionAckCertificate: ConnectionAckCertificate;
    }
}
