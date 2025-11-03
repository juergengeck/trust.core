/**
 * CertificateRegistry Recipe
 *
 * ONE.core recipe for storing certificate registries.
 * Certificates are versioned so they can be revoked by creating new versions
 * with updated validity periods. The registry itself is versioned for auditability.
 */

import type { Recipe, OneObjectTypeNames } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * CertificateRegistry - Versioned object storing certificates
 *
 * This is stored as a ONE.core versioned object and can be:
 * - Updated to add/revoke certificates
 * - Versioned for complete audit trail
 * - Shared via CHUM for synchronization
 *
 * The registry uses an ID property to enable versioning - each update
 * creates a new version while maintaining the history for auditing.
 */
export interface CertificateRegistry {
    $type$: 'CertificateRegistry';

    // ID property for versioning (required for versioned objects)
    id: string;  // e.g., "CertificateRegistry" or user-specific ID

    // Certificates in this registry
    certificates: SHA256Hash<any>[];  // Array of certificate hashes
}

/**
 * ONE.core recipe definition for CertificateRegistry
 */
export const CertificateRegistryRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'CertificateRegistry',
    rule: [
        {
            itemprop: 'id',
            isId: true,  // Makes this a versioned object
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'certificates',
            itemtype: {
                type: 'set',  // Use set to avoid duplicates
                item: {
                    type: 'string'  // Store certificate hashes as strings
                }
            }
        }
    ]
};

/**
 * Reverse map for querying CertificateRegistry objects
 */
export const CertificateRegistryReverseMap: [OneObjectTypeNames, Set<string>] = [
    'CertificateRegistry',
    new Set(['id'])  // Index by id for fast lookups
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneIdObjectInterfaces {
        CertificateRegistry: Pick<CertificateRegistry, 'id' | '$type$'>;
    }

    export interface OneVersionedObjectInterfaces {
        CertificateRegistry: CertificateRegistry;
    }
}
