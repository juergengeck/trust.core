/**
 * AuditTrailService
 *
 * Tracks and queries certificate usage for audit purposes.
 * Maintains complete history of certificate operations and trust decisions.
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { Certificate } from '../recipes/Certificate.js';

/**
 * Audit Event Types
 */
export type AuditEventType =
    | 'certificate_issued'
    | 'certificate_extended'
    | 'certificate_reduced'
    | 'certificate_revoked'
    | 'certificate_verified'
    | 'trust_established'
    | 'trust_revoked'
    | 'vc_exported'
    | 'vc_imported';

/**
 * Audit Event
 */
export interface AuditEvent {
    $type$: 'AuditEvent';

    // Event metadata
    eventType: AuditEventType;
    timestamp: number;  // Unix timestamp (milliseconds)

    // Actors
    actor: SHA256IdHash<Person>;  // Who performed the action
    subject?: SHA256IdHash<Person> | string;  // Who/what was affected

    // Certificate context
    certificateId?: string;
    certificateHash?: SHA256Hash<Certificate>;
    certificateVersion?: number;

    // Additional context
    reason?: string;
    metadata?: Record<string, any>;

    // Result
    success: boolean;
    error?: string;
}

/**
 * Audit Query Options
 */
export interface AuditQueryOptions {
    eventType?: AuditEventType | AuditEventType[];
    actor?: SHA256IdHash<Person>;
    subject?: SHA256IdHash<Person> | string;
    certificateId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
}

/**
 * AuditTrailService
 *
 * Platform-agnostic audit trail management.
 * Stores audit events in ONE.core for synchronization and persistence.
 */
export class AuditTrailService {
    private oneCore: any;  // ONE.core instance (injected)
    private events: AuditEvent[] = [];  // In-memory cache (for fast queries)

    constructor(oneCore: any) {
        this.oneCore = oneCore;
    }

    /**
     * Initialize the service
     */
    async init(): Promise<void> {
        // Load recent audit events from storage
        await this.loadRecentEvents();
    }

    /**
     * Record an audit event
     */
    async recordEvent(event: Omit<AuditEvent, '$type$' | 'timestamp'>): Promise<void> {
        const auditEvent: AuditEvent = {
            $type$: 'AuditEvent',
            timestamp: Date.now(),
            ...event
        };

        // Store in ONE.core
        try {
            await this.oneCore.storeUnversionedObject(auditEvent);
        } catch (error) {
            console.error('Failed to store audit event:', error);
        }

        // Add to in-memory cache
        this.events.push(auditEvent);

        // Limit cache size (keep last 1000 events)
        if (this.events.length > 1000) {
            this.events = this.events.slice(-1000);
        }
    }

    /**
     * Query audit events
     */
    async queryEvents(options: AuditQueryOptions = {}): Promise<AuditEvent[]> {
        let results = [...this.events];

        // Filter by event type
        if (options.eventType) {
            const types = Array.isArray(options.eventType)
                ? options.eventType
                : [options.eventType];
            results = results.filter(e => types.includes(e.eventType));
        }

        // Filter by actor
        if (options.actor) {
            results = results.filter(e => e.actor === options.actor);
        }

        // Filter by subject
        if (options.subject) {
            results = results.filter(e => e.subject === options.subject);
        }

        // Filter by certificate ID
        if (options.certificateId) {
            results = results.filter(e => e.certificateId === options.certificateId);
        }

        // Filter by time range
        if (options.startTime) {
            results = results.filter(e => e.timestamp >= options.startTime!);
        }
        if (options.endTime) {
            results = results.filter(e => e.timestamp <= options.endTime!);
        }

        // Sort by timestamp (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp);

        // Apply pagination
        const offset = options.offset || 0;
        const limit = options.limit || results.length;
        results = results.slice(offset, offset + limit);

        return results;
    }

    /**
     * Get certificate audit trail (all events for a specific certificate)
     */
    async getCertificateAuditTrail(certificateId: string): Promise<AuditEvent[]> {
        return this.queryEvents({ certificateId });
    }

    /**
     * Get actor audit trail (all events by a specific actor)
     */
    async getActorAuditTrail(actor: SHA256IdHash<Person>): Promise<AuditEvent[]> {
        return this.queryEvents({ actor });
    }

    /**
     * Load recent events from storage
     */
    private async loadRecentEvents(): Promise<void> {
        // TODO: Implement querying AuditEvent objects from ONE.core
        // For now, start with empty cache
        this.events = [];
    }

    /**
     * Clear old events from cache (keep last N days)
     */
    async pruneOldEvents(daysToKeep: number = 90): Promise<void> {
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        this.events = this.events.filter(e => e.timestamp >= cutoffTime);
    }

    /**
     * Shutdown the service
     */
    async shutdown(): Promise<void> {
        this.events = [];
    }
}
