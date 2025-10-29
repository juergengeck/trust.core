/**
 * TrustHandler - RPC-style interface for trust operations
 *
 * Provides transport-agnostic access to trust functionality for:
 * - Electron IPC handlers
 * - Web Workers
 * - React Native bridges
 */

import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { TrustModel } from '../models/TrustModel.js';
import type {
    DeviceCredentials,
    TrustStatus,
    TrustEntry,
    TrustEvaluation
} from '../types/trust-types.js';

/**
 * Request/Response types for RPC-style communication
 */

export interface SetTrustStatusRequest {
    deviceId: SHA256IdHash<Person>;
    publicKey: string;
    status: TrustStatus;
}

export interface SetTrustStatusResponse {
    success: boolean;
    error?: string;
}

export interface GetTrustStatusRequest {
    deviceId: SHA256IdHash<Person>;
}

export interface GetTrustStatusResponse {
    status?: TrustStatus;
    error?: string;
}

export interface GetTrustedDevicesResponse {
    devices: TrustEntry[];
    error?: string;
}

export interface VerifyDeviceKeyRequest {
    deviceId: SHA256IdHash<Person>;
    publicKey: string;
}

export interface VerifyDeviceKeyResponse {
    isValid: boolean;
    error?: string;
}

export interface EvaluateTrustRequest {
    personId: SHA256IdHash<Person>;
    context?: 'general' | 'file-transfer' | 'communication';
}

export interface EvaluateTrustResponse {
    evaluation?: TrustEvaluation;
    error?: string;
}

export interface GetDeviceCredentialsResponse {
    credentials?: DeviceCredentials;
    error?: string;
}

/**
 * TrustHandler - Transport-agnostic trust operations
 *
 * Follows dependency injection pattern:
 * - Platforms create handler: new TrustHandler(trustModel)
 * - Handler methods are pure business logic
 * - No platform-specific code
 */
export class TrustHandler {
    constructor(private trustModel: TrustModel) {}

    /**
     * Set trust status for a device/person
     */
    async setTrustStatus(request: SetTrustStatusRequest): Promise<SetTrustStatusResponse> {
        try {
            await this.trustModel.setTrustStatus(
                request.deviceId,
                request.publicKey,
                request.status
            );
            return { success: true };
        } catch (error) {
            console.error('[TrustHandler] Error setting trust status:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get trust status for a device/person
     */
    async getTrustStatus(request: GetTrustStatusRequest): Promise<GetTrustStatusResponse> {
        try {
            const status = this.trustModel.getTrustStatus(request.deviceId);
            return { status };
        } catch (error) {
            console.error('[TrustHandler] Error getting trust status:', error);
            return {
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get all trusted devices
     */
    async getTrustedDevices(): Promise<GetTrustedDevicesResponse> {
        try {
            const devices = this.trustModel.getTrustedDevices();
            return { devices };
        } catch (error) {
            console.error('[TrustHandler] Error getting trusted devices:', error);
            return {
                devices: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Verify a device's public key
     */
    async verifyDeviceKey(request: VerifyDeviceKeyRequest): Promise<VerifyDeviceKeyResponse> {
        try {
            const isValid = this.trustModel.verifyDeviceKey(request.deviceId, request.publicKey);
            return { isValid };
        } catch (error) {
            console.error('[TrustHandler] Error verifying device key:', error);
            return {
                isValid: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Evaluate trust level for a person
     */
    async evaluateTrust(request: EvaluateTrustRequest): Promise<EvaluateTrustResponse> {
        try {
            const evaluation = await this.trustModel.evaluateTrust(
                request.personId,
                request.context || 'general'
            );
            return { evaluation };
        } catch (error) {
            console.error('[TrustHandler] Error evaluating trust:', error);
            return {
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get device credentials
     */
    async getDeviceCredentials(): Promise<GetDeviceCredentialsResponse> {
        try {
            const credentials = this.trustModel.getDeviceCredentials();
            return { credentials };
        } catch (error) {
            console.error('[TrustHandler] Error getting device credentials:', error);
            return {
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
