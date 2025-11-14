/**
 * SubscriptionCertificate Recipe
 *
 * Certificate for identity subscription service on lama.one domains.
 *
 * IMPORTANT: This is NOT a software license - LAMA software is free and open.
 * This is an IDENTITY ATTESTATION service - a ROOT OF TRUST for 3rd parties.
 *
 * What you're buying: Time-bound proof that you own a specific identity
 * Example: claude@glue.one for 1€/month or 10€/year
 *
 * Use case: When interacting with unknown 3rd parties, share your certificate
 * to prove you control this identity on lama.one infrastructure.
 */

import type { Recipe, OneObjectTypeNames, Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Certificate } from './Certificate.js';

/**
 * Subscription Tier (duration-based pricing)
 */
export type SubscriptionTier = 'monthly' | 'yearly';

/**
 * Subscription Status
 */
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

/**
 * SubscriptionCertificate
 *
 * Time-bound identity certificate proving ownership of a subscribed identity.
 * Example: claude@glue.one subscribed for 1 year at 10€
 *
 * Purpose: Root of trust for unknown 3rd parties
 * - Cryptographically proves you control this identity on lama.one
 * - Can be verified via QR code or URL
 * - W3C VC compatible for interoperability
 * - Works with any identity-aware system
 *
 * Uses Certificate's versioning for lifecycle management:
 * - New subscription: Create certificate with appropriate validUntil
 * - Renewal: Extend certificate (new version with later validUntil)
 * - Cancellation: Revoke certificate (new version with status='revoked')
 * - Expiration: Certificate becomes invalid when validUntil < Date.now()
 */
export interface SubscriptionCertificate extends Omit<Certificate, '$type$' | 'certificateType' | 'claims'> {
    $type$: 'SubscriptionCertificate';

    // Always 'identity' type - this is an identity attestation
    certificateType: 'identity';

    // Identity subscription claims
    claims: {
        // Subscribed identity (e.g., "claude@glue.one")
        identity: string;

        // Domain (e.g., "glue.one")
        domain: string;

        // Local part (e.g., "claude")
        localPart: string;

        // Subscription details
        tier: SubscriptionTier;
        priceEur: number;  // Price in EUR (1.00 for monthly, 10.00 for yearly)
        subscriptionStatus: SubscriptionStatus;

        // Payment tracking (dummy payment ID for now)
        paymentId: string;
        depositAmount: number;  // Amount deposited in EUR

        // Auto-renewal
        autoRenew: boolean;

        // Service description
        service: string;  // "Identity attestation and verification"

        // Additional metadata
        [key: string]: any;
    };
}

/**
 * ONE.core recipe definition for SubscriptionCertificate
 */
export const SubscriptionCertificateRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'SubscriptionCertificate',
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
            itemtype: { type: 'string' }
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
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'chainDepth',
            itemtype: { type: 'number' }
        },
        {
            itemprop: 'claims',
            itemtype: { type: 'stringifiable' }  // JSON-serializable object
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
 * Reverse map for querying SubscriptionCertificate objects
 */
export const SubscriptionCertificateReverseMap: [OneObjectTypeNames, Set<string>] = [
    'SubscriptionCertificate',
    new Set(['id', 'subject', 'issuer'])
];

// #### one.core interfaces ####

declare module '@OneObjectInterfaces' {
    export interface OneIdObjectInterfaces {
        SubscriptionCertificate: Pick<SubscriptionCertificate, 'id' | '$type$'>;
    }

    export interface OneVersionedObjectInterfaces {
        SubscriptionCertificate: SubscriptionCertificate;
    }
}
