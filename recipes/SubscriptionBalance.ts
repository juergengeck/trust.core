/**
 * SubscriptionBalance Recipe
 *
 * Tracks user's subscription balance and deposit history.
 * Stored as a versioned object keyed by user's Person ID.
 */

import type { Recipe, Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * SubscriptionBalance Object
 *
 * ONE.core versioned object that stores subscription balance information.
 */
export interface SubscriptionBalance {
    $type$: 'SubscriptionBalance';

    // ID: User's Person ID (makes this a versioned object)
    userId: SHA256IdHash<Person>;

    // Balance tracking
    balance: number;           // Current balance in EUR
    totalDeposited: number;    // Total amount deposited (all time)

    // Metadata
    lastUpdated: number;       // Timestamp of last update
    version: number;           // Version number for optimistic locking
}

/**
 * Extend ONE.core's type system
 */
declare module '@OneObjectInterfaces' {
    export interface OneVersionedObjectInterfaces {
        SubscriptionBalance: SubscriptionBalance;
    }
}

/**
 * SubscriptionBalance Recipe Definition
 */
export const SubscriptionBalanceRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'SubscriptionBalance',
    rule: [
        {
            itemprop: 'userId',
            isId: true,  // Makes this a versioned object
            itemtype: {
                type: 'referenceToId',
                allowedTypes: new Set(['Person'])
            }
        },
        {
            itemprop: 'balance',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'totalDeposited',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'lastUpdated',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'version',
            itemtype: { type: 'number' }
        }
    ]
};

/**
 * Reverse map for SubscriptionBalance (for querying by userId)
 */
export const SubscriptionBalanceReverseMap: [string, Set<string>] = [
    'SubscriptionBalance',
    new Set(['userId'])
];

export default SubscriptionBalanceRecipe;
