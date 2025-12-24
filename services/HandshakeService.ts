/**
 * HandshakeService
 *
 * Handles ProfileResponse/ConnectionAckCertificate handshake flow.
 * Creates and validates handshake objects for peer discovery.
 */

import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { createRandomNonce } from '@refinio/one.core/lib/crypto/encryption.js';
import type { CryptoApi } from '@refinio/one.core/lib/crypto/CryptoApi.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { Profile } from '@refinio/one.models/lib/recipes/Leute/Profile.js';
import type { License } from '@refinio/one.models/lib/recipes/Certificates/License.js';
import type { PublicKey } from '@refinio/one.core/lib/crypto/encryption.js';
import type { ProfileResponse } from '../recipes/ProfileResponse.js';
import type { ConnectionAckCertificate } from '../recipes/ConnectionAckCertificate.js';

/**
 * Convert Uint8Array to hex string
 */
function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

export interface CreateProfileResponseParams {
    responder: SHA256IdHash<Person>;
    challenger: SHA256IdHash<Person>;
    challengerProfile: SHA256Hash<Profile>;
    challengerPublicKey: PublicKey;
    cryptoApi: CryptoApi;
}

export interface CreateConnectionAckParams {
    profileResponse: ProfileResponse;
    profileResponseHash: SHA256Hash<ProfileResponse>;
    cryptoApi: CryptoApi;
    license: SHA256Hash<License>;
    validityDurationMs?: number;
}

export class HandshakeService {
    /**
     * Create a ProfileResponse with encrypted nonce
     */
    async createProfileResponse(
        params: CreateProfileResponseParams
    ): Promise<{ response: ProfileResponse; hash: SHA256Hash<ProfileResponse>; nonce: Uint8Array }> {
        const { responder, challenger, challengerProfile, challengerPublicKey, cryptoApi } = params;

        // Generate random nonce
        const nonce = createRandomNonce();

        // Encrypt nonce with challenger's public key
        const encryptedNonce = cryptoApi.encryptAndEmbedNonce(nonce, challengerPublicKey);

        const response: ProfileResponse = {
            $type$: 'ProfileResponse',
            responder,
            challenger,
            challengerProfile,
            encryptedNonce: toHex(encryptedNonce),
            created: Date.now()
        };

        const result = await storeUnversionedObject(response);

        return {
            response,
            hash: result.hash as SHA256Hash<ProfileResponse>,
            nonce
        };
    }

    /**
     * Verify and acknowledge a ProfileResponse by decrypting the nonce
     */
    async verifyAndAcknowledge(
        params: CreateConnectionAckParams
    ): Promise<{ certificate: ConnectionAckCertificate; hash: SHA256Hash<ConnectionAckCertificate> } | null> {
        const {
            profileResponse,
            profileResponseHash,
            cryptoApi,
            license,
            validityDurationMs = 365 * 24 * 60 * 60 * 1000 // 1 year default
        } = params;

        try {
            // Decrypt the nonce
            const encryptedNonce = fromHex(profileResponse.encryptedNonce);

            // Get responder's public key to decrypt
            // Note: This requires the responder's public key from their profile
            // The caller should provide the appropriate crypto context
            const decryptedNonce = cryptoApi.decryptWithEmbeddedNonce(
                encryptedNonce,
                // The responder's public key - obtained from their profile
                await this.getResponderPublicKey(profileResponse.responder)
            );

            const now = Date.now();
            const id = `connack:${profileResponse.responder}:${profileResponse.challenger}:${now}`;

            const certificate: ConnectionAckCertificate = {
                $type$: 'ConnectionAckCertificate',
                id,
                responder: profileResponse.responder,
                challenger: profileResponse.challenger,
                nonce: toHex(decryptedNonce),
                profileResponse: profileResponseHash,
                created: now,
                status: 'valid',
                license,
                validUntil: now + validityDurationMs,
                version: 1
            };

            const result = await storeVersionedObject(certificate);

            return {
                certificate,
                hash: result.hash as SHA256Hash<ConnectionAckCertificate>
            };
        } catch (error) {
            console.error('[HandshakeService] Failed to verify ProfileResponse:', error);
            return null;
        }
    }

    /**
     * Get responder's public key from their profile/keys
     * This is a placeholder - actual implementation depends on LeuteModel integration
     */
    private async getResponderPublicKey(responder: SHA256IdHash<Person>): Promise<PublicKey> {
        // TODO: Integrate with LeuteModel to get the responder's public key
        // For now, this throws - the caller should provide the key via CryptoApi context
        throw new Error('getResponderPublicKey requires LeuteModel integration');
    }
}

export const handshakeService = new HandshakeService();
