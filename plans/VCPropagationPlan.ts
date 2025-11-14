/**
 * VCPropagationPlan - VC Propagation Plan
 *
 * RPC-style plan for VC propagation operations.
 * Provides transport-agnostic interface for managing certificate propagation.
 */

import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Certificate } from '../recipes/Certificate.js';
import type {
    VCPropagationService,
    PropagationRecord,
    PropagationStatus
} from '../services/VCPropagationService.js';

/**
 * Request/Response types for VCPropagationPlan
 */

export interface QueueForPropagationRequest {
    certificateId: string;
    certificateHash: SHA256Hash<Certificate>;
    options?: {
        internalOnly?: boolean;
        externalUrl?: string;
    };
}

export interface QueueForPropagationResponse {
    success: boolean;
    error?: string;
}

export interface GetPropagationStatusRequest {
    certificateId: string;
}

export interface GetPropagationStatusResponse {
    record: PropagationRecord | null;
    error?: string;
}

export interface RetryFailedResponse {
    success: boolean;
    error?: string;
}

/**
 * VCPropagationPlan
 *
 * Transport-agnostic VC propagation operations.
 * Designed for use with IPC, HTTP, or other RPC mechanisms.
 */
export class VCPropagationPlan {
    constructor(private propagationService: VCPropagationService) {}

    /**
     * Queue a certificate for propagation
     */
    async queueForPropagation(
        request: QueueForPropagationRequest
    ): Promise<QueueForPropagationResponse> {
        try {
            await this.propagationService.queueForPropagation(
                request.certificateId,
                request.certificateHash,
                request.options
            );

            return { success: true };
        } catch (error) {
            console.error('[VCPropagationPlan] Error queueing for propagation:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get propagation status for a certificate
     */
    async getPropagationStatus(
        request: GetPropagationStatusRequest
    ): Promise<GetPropagationStatusResponse> {
        try {
            const record = this.propagationService.getPropagationStatus(request.certificateId);
            return { record };
        } catch (error) {
            console.error('[VCPropagationPlan] Error getting propagation status:', error);
            return {
                record: null,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Retry failed propagations
     */
    async retryFailed(): Promise<RetryFailedResponse> {
        try {
            await this.propagationService.retryFailed();
            return { success: true };
        } catch (error) {
            console.error('[VCPropagationPlan] Error retrying failed propagations:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
