/**
 * ProfileResponse Recipe
 *
 * Sent when a user selects a discovered peer to initiate connection.
 * Contains an encrypted nonce that proves the responder can encrypt
 * to the challenger's public key.
 */

import type { Recipe, OneObjectTypeNames, Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Profile } from '@refinio/one.models/lib/recipes/Leute/Profile.js';

/**
 * ProfileResponse
 *
 * Unversioned object representing intent to connect.
 * The encryptedNonce field contains a random nonce encrypted with
 * the challenger's public key, proving the responder can encrypt to them.
 */
export interface ProfileResponse {
    $type$: 'ProfileResponse';

    /** Who is responding (wants to connect) */
    responder: SHA256IdHash<Person>;

    /** Who we're responding to (the challenger) */
    challenger: SHA256IdHash<Person>;

    /** The challenger's public profile we're responding to */
    challengerProfile: SHA256Hash<Profile>;

    /** Random nonce encrypted with challenger's public key (hex) */
    encryptedNonce: string;

    /** When this response was created (Unix timestamp ms) */
    created: number;
}

/**
 * ONE.core recipe definition for ProfileResponse
 */
export const ProfileResponseRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'ProfileResponse',
    rule: [
        {
            itemprop: 'responder',
            itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) }
        },
        {
            itemprop: 'challenger',
            itemtype: { type: 'referenceToId', allowedTypes: new Set(['Person']) }
        },
        {
            itemprop: 'challengerProfile',
            itemtype: { type: 'referenceToObj', allowedTypes: new Set(['Profile']) }
        },
        {
            itemprop: 'encryptedNonce',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'created',
            itemtype: { type: 'number' }
        }
    ]
};

/**
 * Reverse map for querying ProfileResponse objects
 */
export const ProfileResponseReverseMap: [OneObjectTypeNames, Set<string>] = [
    'ProfileResponse',
    new Set(['responder', 'challenger', 'challengerProfile'])
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneUnversionedObjectInterfaces {
        ProfileResponse: ProfileResponse;
    }
}
