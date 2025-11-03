/**
 * GroupAttestation Recipe
 *
 * ONE.core recipe for group membership attestation certificates.
 * These certificates attest that a group exists and who its members are.
 */

import type { Recipe, OneObjectTypeNames, Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * GroupAttestation - Unversioned certificate attesting to group membership
 *
 * This certificate is created by the group owner and distributed to members.
 * It serves as proof of group existence and membership list.
 */
export interface GroupAttestation {
    $type$: 'GroupAttestation';

    // Group information
    groupId: string;  // IdHash of the Group object
    groupHash: SHA256Hash<any>;  // Hash of the Group object data

    // Membership
    members: SHA256IdHash<Person>[];  // List of group member person IDs

    // Issuer (group creator/owner)
    issuer: SHA256IdHash<Person>;

    // Validity period
    issuedAt: number;  // Timestamp
    validUntil: number;  // Timestamp
}

/**
 * ONE.core recipe definition for GroupAttestation
 */
export const GroupAttestationRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'GroupAttestation',
    rule: [
        {
            itemprop: 'groupId',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'groupHash',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'members',
            itemtype: {
                type: 'set',
                item: {
                    type: 'referenceToId',
                    allowedTypes: new Set(['Person'])
                }
            }
        },
        {
            itemprop: 'issuer',
            itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) }
        },
        {
            itemprop: 'issuedAt',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'validUntil',
            itemtype: { type: 'number' }
        }
    ]
};

/**
 * Reverse map for querying GroupAttestation objects
 */
export const GroupAttestationReverseMap: [OneObjectTypeNames, Set<string>] = [
    'GroupAttestation',
    new Set(['groupId', 'issuer'])
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneUnversionedObjectInterfaces {
        GroupAttestation: GroupAttestation;
    }
}
