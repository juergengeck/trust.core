/**
 * AuditPlan - Audit Trail Plan
 *
 * RPC-style plan for audit trail operations.
 * Provides transport-agnostic interface for audit event tracking and queries.
 */

import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type {
    AuditTrailService,
    AuditEvent,
    AuditEventType,
    AuditQueryOptions
} from '../services/AuditTrailService.js';

/**
 * Request/Response types for AuditPlan
 */

export interface RecordEventRequest {
    eventType: AuditEventType;
    actor: SHA256IdHash<Person>;
    subject?: SHA256IdHash<Person> | string;
    certificateId?: string;
    certificateHash?: string;
    certificateVersion?: number;
    reason?: string;
    metadata?: Record<string, any>;
    success: boolean;
    error?: string;
}

export interface RecordEventResponse {
    success: boolean;
    error?: string;
}

export interface QueryEventsRequest {
    options?: AuditQueryOptions;
}

export interface QueryEventsResponse {
    events: AuditEvent[];
    error?: string;
}

export interface GetCertificateAuditTrailRequest {
    certificateId: string;
}

export interface GetCertificateAuditTrailResponse {
    events: AuditEvent[];
    error?: string;
}

export interface GetActorAuditTrailRequest {
    actor: SHA256IdHash<Person>;
}

export interface GetActorAuditTrailResponse {
    events: AuditEvent[];
    error?: string;
}

export interface PruneOldEventsRequest {
    daysToKeep?: number;
}

export interface PruneOldEventsResponse {
    success: boolean;
    error?: string;
}

/**
 * AuditPlan
 *
 * Transport-agnostic audit trail operations.
 * Designed for use with IPC, HTTP, or other RPC mechanisms.
 */
export class AuditPlan {
    constructor(private auditService: AuditTrailService) {}

    /**
     * Record an audit event
     */
    async recordEvent(request: RecordEventRequest): Promise<RecordEventResponse> {
        try {
            await this.auditService.recordEvent({
                eventType: request.eventType,
                actor: request.actor,
                subject: request.subject,
                certificateId: request.certificateId,
                certificateHash: request.certificateHash as any,
                certificateVersion: request.certificateVersion,
                reason: request.reason,
                metadata: request.metadata,
                success: request.success,
                error: request.error
            });

            return { success: true };
        } catch (error) {
            console.error('[AuditPlan] Error recording event:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Query audit events
     */
    async queryEvents(request: QueryEventsRequest): Promise<QueryEventsResponse> {
        try {
            const events = await this.auditService.queryEvents(request.options);
            return { events };
        } catch (error) {
            console.error('[AuditPlan] Error querying events:', error);
            return {
                events: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get audit trail for a specific certificate
     */
    async getCertificateAuditTrail(
        request: GetCertificateAuditTrailRequest
    ): Promise<GetCertificateAuditTrailResponse> {
        try {
            const events = await this.auditService.getCertificateAuditTrail(request.certificateId);
            return { events };
        } catch (error) {
            console.error('[AuditPlan] Error getting certificate audit trail:', error);
            return {
                events: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get audit trail for a specific actor
     */
    async getActorAuditTrail(
        request: GetActorAuditTrailRequest
    ): Promise<GetActorAuditTrailResponse> {
        try {
            const events = await this.auditService.getActorAuditTrail(request.actor);
            return { events };
        } catch (error) {
            console.error('[AuditPlan] Error getting actor audit trail:', error);
            return {
                events: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Prune old audit events
     */
    async pruneOldEvents(request: PruneOldEventsRequest): Promise<PruneOldEventsResponse> {
        try {
            await this.auditService.pruneOldEvents(request.daysToKeep);
            return { success: true };
        } catch (error) {
            console.error('[AuditPlan] Error pruning old events:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
