/**
 * VCPropagationService
 *
 * Manages dual propagation of certificates:
 * 1. Internal: ONE.core sync via CHUM
 * 2. External: VC documents shared via HTTP/HTTPS
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { Certificate } from '../recipes/Certificate.js';
import type { VerifiableCredential } from '../recipes/VerifiableCredential.js';
import { VCBridge } from '../models/VCBridge.js';

/**
 * Propagation Status
 */
export type PropagationStatus =
    | 'pending'      // Queued for propagation
    | 'syncing'      // Currently syncing
    | 'synced'       // Successfully synced
    | 'failed'       // Propagation failed
    | 'offline';     // No network connection

/**
 * Propagation Record
 */
export interface PropagationRecord {
    certificateId: string;
    certificateHash: SHA256Hash<Certificate>;

    // Internal propagation (ONE.core sync)
    internalStatus: PropagationStatus;
    internalSyncedAt?: number;
    internalError?: string;

    // External propagation (VC document)
    externalStatus: PropagationStatus;
    externalUrl?: string;  // Where VC was published
    externalSyncedAt?: number;
    externalError?: string;

    // Metadata
    createdAt: number;
    updatedAt: number;
}

/**
 * VCPropagationService
 *
 * Manages certificate propagation across ONE.core network and external systems.
 * Ensures certificates are synchronized and verifiable by all parties.
 */
export class VCPropagationService {
    private oneCore: any;  // ONE.core instance (injected)
    private propagationQueue: Map<string, PropagationRecord> = new Map();
    private isRunning: boolean = false;
    private syncInterval: NodeJS.Timeout | null = null;

    constructor(oneCore: any) {
        this.oneCore = oneCore;
    }

    /**
     * Initialize the service
     */
    async init(): Promise<void> {
        // Load propagation state from storage
        await this.loadPropagationState();

        // Start background sync
        this.startBackgroundSync();
    }

    /**
     * Queue a certificate for propagation
     */
    async queueForPropagation(
        certificateId: string,
        certificateHash: SHA256Hash<Certificate>,
        options?: {
            internalOnly?: boolean;  // Skip external propagation
            externalUrl?: string;    // Custom external URL
        }
    ): Promise<void> {
        const record: PropagationRecord = {
            certificateId,
            certificateHash,
            internalStatus: 'pending',
            externalStatus: options?.internalOnly ? 'synced' : 'pending',
            externalUrl: options?.externalUrl,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.propagationQueue.set(certificateId, record);

        // Trigger immediate sync if service is running
        if (this.isRunning) {
            this.processPropagationQueue();
        }
    }

    /**
     * Get propagation status for a certificate
     */
    getPropagationStatus(certificateId: string): PropagationRecord | null {
        return this.propagationQueue.get(certificateId) || null;
    }

    /**
     * Process propagation queue
     */
    private async processPropagationQueue(): Promise<void> {
        for (const [certificateId, record] of this.propagationQueue) {
            // Internal propagation (ONE.core sync)
            if (record.internalStatus === 'pending') {
                await this.propagateInternal(certificateId, record);
            }

            // External propagation (VC document)
            if (record.externalStatus === 'pending') {
                await this.propagateExternal(certificateId, record);
            }

            // Remove from queue if both propagations are complete
            if (
                record.internalStatus === 'synced' &&
                record.externalStatus === 'synced'
            ) {
                this.propagationQueue.delete(certificateId);
            }
        }
    }

    /**
     * Propagate certificate internally via ONE.core sync
     */
    private async propagateInternal(
        certificateId: string,
        record: PropagationRecord
    ): Promise<void> {
        try {
            record.internalStatus = 'syncing';
            record.updatedAt = Date.now();

            // Certificate is already stored in ONE.core
            // CHUM will handle automatic synchronization
            // Just mark as synced
            record.internalStatus = 'synced';
            record.internalSyncedAt = Date.now();
        } catch (error) {
            record.internalStatus = 'failed';
            record.internalError = error instanceof Error ? error.message : String(error);
        }

        record.updatedAt = Date.now();
    }

    /**
     * Propagate certificate externally as VC document
     */
    private async propagateExternal(
        certificateId: string,
        record: PropagationRecord
    ): Promise<void> {
        try {
            record.externalStatus = 'syncing';
            record.updatedAt = Date.now();

            // Get certificate from ONE.core
            const certificate = await this.oneCore.getObject(record.certificateHash);

            if (!certificate) {
                throw new Error('Certificate not found');
            }

            // Convert to VC
            const vc = VCBridge.certificateToVC(certificate);
            const jsonLD = VCBridge.exportAsJsonLD(certificate);

            // TODO: Implement external publishing (e.g., HTTP POST to server)
            // For now, just store the VC in ONE.core
            await this.oneCore.storeVersionedObject(vc);

            record.externalStatus = 'synced';
            record.externalSyncedAt = Date.now();
        } catch (error) {
            record.externalStatus = 'failed';
            record.externalError = error instanceof Error ? error.message : String(error);
        }

        record.updatedAt = Date.now();
    }

    /**
     * Retry failed propagations
     */
    async retryFailed(): Promise<void> {
        for (const [certificateId, record] of this.propagationQueue) {
            if (record.internalStatus === 'failed') {
                record.internalStatus = 'pending';
            }
            if (record.externalStatus === 'failed') {
                record.externalStatus = 'pending';
            }
        }

        await this.processPropagationQueue();
    }

    /**
     * Start background sync process
     */
    private startBackgroundSync(): void {
        this.isRunning = true;

        // Process queue every 30 seconds
        this.syncInterval = setInterval(() => {
            this.processPropagationQueue();
        }, 30000);
    }

    /**
     * Stop background sync process
     */
    private stopBackgroundSync(): void {
        this.isRunning = false;

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Load propagation state from storage
     */
    private async loadPropagationState(): Promise<void> {
        // TODO: Implement loading propagation state from ONE.core
        // For now, start with empty queue
        this.propagationQueue.clear();
    }

    /**
     * Save propagation state to storage
     */
    private async savePropagationState(): Promise<void> {
        // TODO: Implement saving propagation state to ONE.core
    }

    /**
     * Shutdown the service
     */
    async shutdown(): Promise<void> {
        this.stopBackgroundSync();
        await this.savePropagationState();
        this.propagationQueue.clear();
    }
}
