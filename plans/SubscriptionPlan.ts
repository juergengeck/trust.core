/**
 * SubscriptionPlan - Subscription Management Plan
 *
 * RPC-style plan for subscription certificate operations.
 * Provides transport-agnostic interface for subscription management.
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { SubscriptionCertificate, SubscriptionTier } from '../recipes/SubscriptionCertificate.js';
import type { Certificate } from '../recipes/Certificate.js';
import { CAModel } from '../models/CAModel.js';

/**
 * Request/Response types for SubscriptionPlan
 */

export interface IssueSubscriptionRequest {
    userId: SHA256IdHash<Person>;
    userPublicKey: string;
    tier: SubscriptionTier;
    priceEur: number;
    paymentId: string;
    depositAmount: number;
    autoRenew?: boolean;
}

export interface IssueSubscriptionResponse {
    certificateHash: SHA256Hash<Certificate>;
    certificateId: string;
    validUntil: number;
}

export interface GetSubscriptionRequest {
    userId: SHA256IdHash<Person>;
}

export interface GetSubscriptionResponse {
    subscription: Certificate | null;
    isActive: boolean;
    daysRemaining: number;
}

export interface RenewSubscriptionRequest {
    userId: SHA256IdHash<Person>;
    additionalDays: number;
    paymentId: string;
    depositAmount: number;
}

export interface RenewSubscriptionResponse {
    certificateHash: SHA256Hash<Certificate>;
    newValidUntil: number;
}

export interface CancelSubscriptionRequest {
    userId: SHA256IdHash<Person>;
    reason?: string;
}

export interface CancelSubscriptionResponse {
    success: boolean;
    cancelledAt: number;
}

export interface CheckSubscriptionStatusRequest {
    userId: SHA256IdHash<Person>;
}

export interface CheckSubscriptionStatusResponse {
    isActive: boolean;
    tier: SubscriptionTier;
    validUntil: number;
    daysRemaining: number;
    features: string[];
}

/**
 * SubscriptionPlan
 *
 * Transport-agnostic subscription management operations.
 * Uses CAModel for certificate operations.
 */
export class SubscriptionPlan {
    private caModel: CAModel;

    constructor(caModel: CAModel) {
        this.caModel = caModel;
    }

    /**
     * Issue a new subscription certificate
     */
    async issueSubscription(
        request: IssueSubscriptionRequest
    ): Promise<IssueSubscriptionResponse> {
        // Determine validity period based on tier
        const validityDays = request.tier === 'yearly' ? 365 : 30;

        // Get all features for subscription tier
        const features = this.getFeaturesForTier(request.tier);

        // Issue certificate via CAModel
        const certificateHash = await this.caModel.issueCertificate({
            certificateType: 'service',
            subject: request.userId,
            subjectPublicKey: request.userPublicKey,
            validityDays,
            claims: {
                tier: request.tier,
                priceEur: request.priceEur,
                subscriptionStatus: 'active',
                paymentId: request.paymentId,
                depositAmount: request.depositAmount,
                features,
                autoRenew: request.autoRenew ?? false
            }
        });

        const certificateId = `cert:service:${request.userId}:${Date.now()}`;
        const certificate = await this.caModel.getCertificate(certificateId) as Certificate | null;

        return {
            certificateHash,
            certificateId,
            validUntil: certificate?.validUntil || Date.now() + (validityDays * 24 * 60 * 60 * 1000)
        };
    }

    /**
     * Get current subscription for user
     */
    async getSubscription(
        request: GetSubscriptionRequest
    ): Promise<GetSubscriptionResponse> {
        const certificateId = `cert:service:${request.userId}`;
        const subscription = await this.caModel.getCertificate(certificateId) as Certificate | null;

        if (!subscription) {
            return {
                subscription: null,
                isActive: false,
                daysRemaining: 0
            };
        }

        const now = Date.now();
        const isActive = subscription.status === 'valid' && subscription.validUntil > now;
        const daysRemaining = isActive
            ? Math.floor((subscription.validUntil - now) / (24 * 60 * 60 * 1000))
            : 0;

        return {
            subscription,
            isActive,
            daysRemaining
        };
    }

    /**
     * Renew subscription (extend validity)
     */
    async renewSubscription(
        request: RenewSubscriptionRequest
    ): Promise<RenewSubscriptionResponse> {
        const certificateId = `cert:service:${request.userId}`;

        // Extend the certificate
        const certificateHash = await this.caModel.extendCertificate({
            certificateId,
            additionalDays: request.additionalDays
        });

        // Get updated certificate to return validUntil
        const certificate = await this.caModel.getCertificate(certificateId) as Certificate | null;
        const newValidUntil = certificate?.validUntil || Date.now() + (request.additionalDays * 24 * 60 * 60 * 1000);

        return {
            certificateHash,
            newValidUntil
        };
    }

    /**
     * Cancel subscription (revoke certificate)
     */
    async cancelSubscription(
        request: CancelSubscriptionRequest
    ): Promise<CancelSubscriptionResponse> {
        const certificateId = `cert:service:${request.userId}`;

        await this.caModel.revokeCertificate({
            certificateId,
            reason: request.reason || 'User cancelled subscription'
        });

        return {
            success: true,
            cancelledAt: Date.now()
        };
    }

    /**
     * Check subscription status
     */
    async checkSubscriptionStatus(
        request: CheckSubscriptionStatusRequest
    ): Promise<CheckSubscriptionStatusResponse> {
        const { subscription, isActive, daysRemaining } = await this.getSubscription({
            userId: request.userId
        });

        if (!subscription || !isActive) {
            return {
                isActive: false,
                tier: 'monthly',  // Default to monthly if no subscription
                validUntil: 0,
                daysRemaining: 0,
                features: []
            };
        }

        return {
            isActive,
            tier: (subscription.claims?.tier || 'monthly') as SubscriptionTier,
            validUntil: subscription.validUntil,
            daysRemaining,
            features: subscription.claims?.features || this.getFeaturesForTier(subscription.claims?.tier as SubscriptionTier || 'monthly')
        };
    }

    /**
     * Get features for subscription tier
     */
    private getFeaturesForTier(tier: SubscriptionTier): string[] {
        switch (tier) {
            case 'monthly':
                return [
                    'Cryptographically signed attestation',
                    'W3C Verifiable Credential',
                    'QR code verification',
                    'Valid for 30 days'
                ];
            case 'yearly':
                return [
                    'Cryptographically signed attestation',
                    'W3C Verifiable Credential',
                    'QR code verification',
                    'Valid for 365 days',
                    'Priority support'
                ];
            default:
                return [];
        }
    }
}
