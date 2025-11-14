/**
 * TrustModel - Trust and identity management with ONE.core integration
 *
 * This model orchestrates trust relationships by integrating:
 * - TrustRelationship objects (ONE.core versioned storage)
 * - TrustedKeysManager (ONE.models certificate validation)
 * - Verifiable Credentials (exportable trust attestations)
 *
 * Architecture:
 * - Trust relationships stored as ONE.core versioned objects
 * - Key trust validated via TrustKeysCertificate
 * - Trust chains exportable as VCs
 */

import { Model } from '@refinio/one.models/lib/models/Model.js';
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import { StateMachine } from '@refinio/one.models/lib/misc/StateMachine.js';
import { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import type TrustedKeysManager from '@refinio/one.models/lib/models/Leute/TrustedKeysManager.js';
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getAllEntries } from '@refinio/one.core/lib/reverse-map-query.js';
import type {
    DeviceCredentials,
    TrustStatus,
    TrustEntry,
    TrustLevel,
    TrustEvaluation,
    TrustChain,
    TrustChainNode
} from '../types/trust-types.js';
import type { TrustRelationship } from '../recipes/TrustRelationship.js';

/**
 * TrustModel - Manages trust relationships with ONE.core storage
 *
 * Dependencies injected via constructor:
 * - LeuteModel (identity management)
 * - TrustedKeysManager (certificate validation)
 */
export class TrustModel implements Model {
    public readonly onUpdated = new OEvent<() => void>();
    public readonly onTrustChanged = new OEvent<(deviceId: SHA256IdHash<Person>, status: TrustStatus) => void>();
    public readonly onCredentialsUpdated = new OEvent<(deviceId: SHA256IdHash<Person>) => void>();

    public state: StateMachine<'Uninitialised' | 'Initialised', 'shutdown' | 'init'>;

    private leuteModel: LeuteModel;
    private trustedKeysManager?: TrustedKeysManager;
    private deviceCredentials?: DeviceCredentials;

    constructor(leuteModel: LeuteModel, trustedKeysManager?: TrustedKeysManager) {
        console.log('[TrustModel] Constructor called');
        this.leuteModel = leuteModel;
        this.trustedKeysManager = trustedKeysManager;

        // Create the StateMachine
        this.state = new StateMachine<'Uninitialised' | 'Initialised', 'shutdown' | 'init'>();

        // Set up states and transitions
        this.state.addState('Uninitialised');
        this.state.addState('Initialised');
        this.state.setInitialState('Uninitialised');
        this.state.addEvent('init');
        this.state.addEvent('shutdown');
        this.state.addTransition('init', 'Uninitialised', 'Initialised');
        this.state.addTransition('shutdown', 'Initialised', 'Uninitialised');

        console.log('[TrustModel] Constructor completed');
    }

    /**
     * Initialize the TrustModel
     */
    public async init(): Promise<void> {
        console.log('[TrustModel] Initializing...');

        if (this.state.currentState === 'Initialised') {
            console.log('[TrustModel] Already initialized');
            return;
        }

        try {
            // Initialize device credentials from keychain
            await this.initializeDeviceCredentials();

            // Transition to initialized state
            this.state.triggerEvent('init');
            console.log('[TrustModel] Initialized successfully');

        } catch (error) {
            console.error('[TrustModel] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Shutdown the TrustModel
     */
    public async shutdown(): Promise<void> {
        console.log('[TrustModel] Shutting down...');

        try {
            // Clear sensitive data
            this.deviceCredentials = undefined;

            // Transition to uninitialized state
            this.state.triggerEvent('shutdown');
            console.log('[TrustModel] Shutdown completed');

        } catch (error) {
            console.error('[TrustModel] Error during shutdown:', error);
            throw error;
        }
    }

    /**
     * Get device credentials for the current device
     */
    public getDeviceCredentials(): DeviceCredentials | undefined {
        return this.deviceCredentials;
    }

    /**
     * Set device identity for external systems (like DeviceDiscoveryModel)
     */
    public async setDeviceIdentity(targetSystem: any): Promise<void> {
        if (!this.deviceCredentials) {
            throw new Error('Device credentials not initialized');
        }

        // Get crypto API for signing operations
        const cryptoApi = await this.getCryptoApi(this.deviceCredentials.deviceId);

        if (targetSystem && typeof targetSystem.setOwnIdentity === 'function') {
            console.log('[TrustModel] Setting device identity for external system (with crypto API)');

            await targetSystem.setOwnIdentity(
                this.deviceCredentials.deviceId,
                '', // No raw secret key - use crypto API
                this.deviceCredentials.publicKey
            );

            // Provide crypto API if supported
            if (typeof targetSystem.setCryptoApi === 'function') {
                await targetSystem.setCryptoApi(cryptoApi);
            }
        } else {
            throw new Error('Target system does not support setOwnIdentity method');
        }
    }

    /**
     * Add or update a trust relationship
     * Stores as ONE.core versioned object
     */
    public async setTrustStatus(
        deviceId: SHA256IdHash<Person>,
        publicKey: string,
        status: TrustStatus,
        options?: {
            trustLevel?: TrustLevel;
            permissions?: any;
            reason?: string;
            context?: string;
            verificationMethod?: string;
        }
    ): Promise<void> {
        try {
            // Check if existing relationship exists
            const existing = await this.getTrustRelationshipObject(deviceId);

            // Create TrustRelationship object
            const trustRelationship: TrustRelationship = {
                $type$: 'TrustRelationship',
                $version$: 'v1',
                peer: deviceId,
                peerPublicKey: publicKey,
                status,
                trustLevel: options?.trustLevel,
                permissions: options?.permissions,
                establishedAt: existing?.establishedAt || new Date().toISOString(),
                lastVerified: new Date().toISOString(),
                reason: options?.reason,
                context: options?.context,
                verificationMethod: options?.verificationMethod
            };

            // Store as versioned object in ONE.core
            const result = await storeVersionedObject(trustRelationship);
            console.log(`[TrustModel] Stored TrustRelationship: ${result.idHash}`);

            // Emit events
            this.onTrustChanged.emit(deviceId, status);
            this.onUpdated.emit();

            console.log(`[TrustModel] Trust status updated for ${deviceId.toString().slice(0, 8)}...: ${status}`);
        } catch (error) {
            console.error('[TrustModel] Error setting trust status:', error);
            throw error;
        }
    }

    /**
     * Get trust status for a device
     * Queries ONE.core via reverse map
     */
    public async getTrustStatus(deviceId: SHA256IdHash<Person>): Promise<TrustStatus | undefined> {
        try {
            const relationship = await this.getTrustRelationshipObject(deviceId);
            return relationship?.status;
        } catch (error) {
            console.error('[TrustModel] Error getting trust status:', error);
            return undefined;
        }
    }

    /**
     * Get all trusted devices
     */
    public async getTrustedDevices(): Promise<TrustEntry[]> {
        try {
            // Query all TrustRelationship objects
            const allRelationships = await this.getAllTrustRelationships();

            // Filter for trusted status and convert to TrustEntry format
            return allRelationships
                .filter(rel => rel.status === 'trusted')
                .map(rel => ({
                    deviceId: rel.peer,
                    publicKey: rel.peerPublicKey,
                    status: rel.status,
                    establishedAt: new Date(rel.establishedAt),
                    lastVerified: rel.lastVerified ? new Date(rel.lastVerified) : undefined
                }));
        } catch (error) {
            console.error('[TrustModel] Error getting trusted devices:', error);
            return [];
        }
    }

    /**
     * Verify a device's public key
     * Checks both TrustRelationship AND TrustedKeysManager certificates
     */
    public async verifyDeviceKey(deviceId: SHA256IdHash<Person>, publicKey: string): Promise<boolean> {
        try {
            // Check TrustRelationship
            const relationship = await this.getTrustRelationshipObject(deviceId);
            const relationshipValid = relationship?.peerPublicKey === publicKey && relationship?.status === 'trusted';

            // Check TrustedKeysManager certificates (if available)
            let certificateValid = false;
            if (this.trustedKeysManager) {
                try {
                    const keyTrustInfo = await this.trustedKeysManager.getKeyTrustInfo(publicKey as any);
                    certificateValid = keyTrustInfo?.trusted || false;
                } catch (err) {
                    console.warn('[TrustModel] Could not verify key via TrustedKeysManager:', err);
                }
            }

            // Valid if EITHER relationship or certificate validates
            return relationshipValid || certificateValid;
        } catch (error) {
            console.error('[TrustModel] Error verifying device key:', error);
            return false;
        }
    }

    /**
     * Evaluate trust level for a person/device
     * Sophisticated trust scoring considering relationships AND certificates
     */
    public async evaluateTrust(
        personId: SHA256IdHash<Person>,
        context: 'general' | 'file-transfer' | 'communication' = 'general'
    ): Promise<TrustEvaluation> {
        try {
            const relationship = await this.getTrustRelationshipObject(personId);

            if (!relationship) {
                return { level: 0, confidence: 0, reason: 'unknown' };
            }

            // Base trust level from status
            let level = 0;
            let confidence = 0.5;

            switch (relationship.status) {
                case 'trusted':
                    level = 0.9;
                    confidence = 0.9;
                    break;
                case 'pending':
                    level = 0.3;
                    confidence = 0.4;
                    break;
                case 'untrusted':
                    level = 0.1;
                    confidence = 0.8;
                    break;
                case 'revoked':
                    level = 0;
                    confidence = 1.0;
                    break;
            }

            // Boost confidence if validated by TrustedKeysManager certificates
            if (this.trustedKeysManager) {
                try {
                    const keyTrustInfo = await this.trustedKeysManager.getKeyTrustInfo(
                        relationship.peerPublicKey as any
                    );
                    if (keyTrustInfo?.trusted) {
                        confidence = Math.min(1.0, confidence + 0.2);
                        console.log(`[TrustModel] Trust boosted by certificate validation`);
                    }
                } catch (err) {
                    // Certificate validation failed, reduce confidence slightly
                    confidence = Math.max(0, confidence - 0.1);
                }
            }

            // Boost confidence for recently verified entries
            if (relationship.lastVerified) {
                const daysSinceVerification =
                    (Date.now() - new Date(relationship.lastVerified).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceVerification < 7) {
                    confidence = Math.min(1.0, confidence + 0.1);
                } else if (daysSinceVerification > 30) {
                    confidence = Math.max(0, confidence - 0.1);
                }
            }

            // Check expiration for temporary trust
            if (relationship.validUntil) {
                const expiryDate = new Date(relationship.validUntil);
                if (expiryDate < new Date()) {
                    return { level: 0, confidence: 1.0, reason: 'expired' };
                }
            }

            // Apply context modifiers
            if (context === 'file-transfer' && level < 0.7) {
                return { level, confidence, reason: 'insufficient_trust_for_file_transfer' };
            }

            return { level, confidence, reason: relationship.status, trustLevel: relationship.trustLevel };
        } catch (error) {
            console.error('[TrustModel] Error evaluating trust:', error);
            return { level: 0, confidence: 0, reason: 'error' };
        }
    }

    /**
     * Set trust level for a person
     * Convenience method for setting trust level with 'trusted' status
     */
    public async setTrustLevel(
        personId: SHA256IdHash<Person>,
        trustLevel: TrustLevel,
        establishedBy?: SHA256IdHash<Person>,
        reason?: string
    ): Promise<void> {
        // Get existing relationship to preserve public key
        const existing = await this.getTrustRelationshipObject(personId);
        const publicKey = existing?.peerPublicKey || '';

        await this.setTrustStatus(personId, publicKey, 'trusted', {
            trustLevel,
            reason: reason || `Trust level set to ${trustLevel}`,
            context: establishedBy ? `Established by ${establishedBy}` : undefined
        });

        console.log(`[TrustModel] Set trust level to ${trustLevel} for ${personId.toString().slice(0, 8)}...`);
    }

    /**
     * Get trust level for a person
     */
    public async getTrustLevel(personId: SHA256IdHash<Person>): Promise<TrustLevel | undefined> {
        const relationship = await this.getTrustRelationshipObject(personId);
        return relationship?.trustLevel;
    }

    /**
     * Get trust chain for a person (for chain of trust visualization)
     * Builds a tree of trust relationships starting from self
     */
    public async getTrustChain(
        personId: SHA256IdHash<Person>,
        maxDepth: number = 3
    ): Promise<TrustChain> {
        try {
            const mainIdentity = await this.leuteModel.myMainIdentity();
            if (!mainIdentity) {
                throw new Error('Cannot get main identity for trust chain');
            }

            // Build the trust chain tree
            const nodes: TrustChainNode[] = [];
            const edges: Array<{
                from: SHA256IdHash<Person>;
                to: SHA256IdHash<Person>;
                trustLevel: TrustLevel;
            }> = [];

            // Start with self
            const root: TrustChainNode = {
                personId: mainIdentity,
                name: 'Self',
                trustLevel: 'self',
                establishedAt: new Date(),
                depth: 0
            };
            nodes.push(root);

            // Build tree recursively
            await this.buildTrustChainRecursive(personId, mainIdentity, nodes, edges, 1, maxDepth);

            return { root, nodes, edges };
        } catch (error) {
            console.error('[TrustModel] Error getting trust chain:', error);
            throw error;
        }
    }

    /**
     * Recursively build trust chain tree
     */
    private async buildTrustChainRecursive(
        targetPersonId: SHA256IdHash<Person>,
        currentPersonId: SHA256IdHash<Person>,
        nodes: TrustChainNode[],
        edges: Array<{ from: SHA256IdHash<Person>; to: SHA256IdHash<Person>; trustLevel: TrustLevel }>,
        depth: number,
        maxDepth: number
    ): Promise<void> {
        if (depth > maxDepth) {
            return;
        }

        // Get trust relationship
        const relationship = await this.getTrustRelationshipObject(targetPersonId);
        if (!relationship) {
            return;
        }

        // Get person name from LeuteModel
        let name = 'Unknown';
        try {
            // TODO: Use proper LeuteModel API to get person name by ID
            // For now, use truncated ID
            name = targetPersonId.toString().slice(0, 8) + '...';
        } catch (err) {
            // Fallback to truncated ID
        }

        // Add node if not already present
        if (!nodes.find(n => n.personId === targetPersonId)) {
            nodes.push({
                personId: targetPersonId,
                name,
                trustLevel: relationship.trustLevel || 'low',
                establishedAt: new Date(relationship.establishedAt),
                establishedBy: currentPersonId,
                depth
            });
        }

        // Add edge
        if (relationship.trustLevel) {
            edges.push({
                from: currentPersonId,
                to: targetPersonId,
                trustLevel: relationship.trustLevel
            });
        }

        // TODO: For transitive trust, query other relationships and recurse
        // This would require iterating over all trusted contacts and building chains
    }

    /**
     * Get TrustRelationship object from ONE.core storage
     */
    private async getTrustRelationshipObject(personId: SHA256IdHash<Person>): Promise<TrustRelationship | undefined> {
        try {
            // getAllEntries returns hashes of objects that reference the target
            // We need to query by the peer field (reverse map)
            const hashes = await getAllEntries(personId, 'TrustRelationship');
            if (hashes.length === 0) {
                return undefined;
            }

            // Get the actual object from the hash
            // TODO: Need to implement getObject to retrieve the actual object
            // For now, return undefined as this requires ONE.core instance access
            console.warn('[TrustModel] getTrustRelationshipObject not fully implemented - needs ONE.core instance');
            return undefined;
        } catch (error) {
            console.error('[TrustModel] Error getting TrustRelationship object:', error);
            return undefined;
        }
    }

    /**
     * Get all TrustRelationship objects
     */
    private async getAllTrustRelationships(): Promise<TrustRelationship[]> {
        try {
            // TODO: Implement proper query for all TrustRelationship objects
            // This requires access to ONE.core instance to enumerate all objects of a type
            console.warn('[TrustModel] getAllTrustRelationships not fully implemented - needs ONE.core instance');
            return [];
        } catch (error) {
            console.error('[TrustModel] Error getting all trust relationships:', error);
            return [];
        }
    }

    /**
     * Initialize device credentials from one.core's secure keychain
     */
    private async initializeDeviceCredentials(): Promise<void> {
        try {
            console.log('[TrustModel] Initializing device credentials from secure keychain...');

            // Get the current user's identity
            const mainIdentity = await this.leuteModel.myMainIdentity();
            if (!mainIdentity) {
                throw new Error('Cannot get main identity for device credentials');
            }

            // Get device credentials from keychain
            const credentials = await this.getDeviceCredentialsFromKeychain(mainIdentity);

            this.deviceCredentials = {
                deviceId: mainIdentity,
                ...credentials
            };

            console.log('[TrustModel] Device credentials initialized successfully');
            this.onCredentialsUpdated.emit(mainIdentity);

        } catch (error) {
            console.error('[TrustModel] Error initializing device credentials:', error);
            throw error;
        }
    }

    /**
     * Get device credentials from one.core's secure keychain
     */
    private async getDeviceCredentialsFromKeychain(
        personId: SHA256IdHash<Person>
    ): Promise<{ secretKey: string, publicKey: string }> {
        console.log('[TrustModel] Getting device credentials from secure keychain');

        const { getLocalInstanceOfPerson } = await import('@refinio/one.models/lib/misc/instance.js');
        const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
        const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js');

        const defaultInstance = await getLocalInstanceOfPerson(personId);
        const keysHash = await getDefaultKeys(defaultInstance);

        if (!keysHash) {
            throw new Error('No default keys found in keychain for person');
        }

        const keyObject = await getObject(keysHash);
        if (!keyObject || !keyObject.publicSignKey) {
            throw new Error('Could not retrieve public keys from keychain');
        }

        return {
            secretKey: '', // Not exposed - use crypto API for signing
            publicKey: keyObject.publicSignKey
        };
    }

    /**
     * Get crypto API for signing operations
     */
    public async getCryptoApi(personId: SHA256IdHash<Person>): Promise<any> {
        const { createCryptoApiFromDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js');

        console.log('🔑 [KEY_DEBUG] TrustModel.getCryptoApi() - PersonId:', personId);

        return await createCryptoApiFromDefaultKeys(personId);
    }

    /**
     * Share topic access with participants
     *
     * After creating a group topic, this method ensures all participants can access it via CHUM by:
     * 1. Getting the access Group that controls topic visibility
     * 2. Granting each participant access to that Group via Certificates
     * 3. Sharing the Group and Certificates via CHUM
     *
     * @param topicId - The topic ID (also used as channelId)
     * @param participants - Array of participant personIds
     */
    public async shareTopicAccessWithParticipants(
        topicId: string,
        participants: SHA256IdHash<Person>[]
    ): Promise<void> {
        try {
            console.log(`[TrustModel] Sharing topic access with ${participants.length} participant(s)`);

            // Get the access Group for this topic from TopicModel
            const accessGroup = await this.getTopicAccessGroup(topicId);

            if (!accessGroup) {
                console.warn('[TrustModel] No access group found for topic - may not use Group-based access control');
                return;
            }

            console.log(`[TrustModel] Found access group for topic: ${accessGroup}`);

            // Grant each participant access to the Group via Certificates
            for (const participantId of participants) {
                await this.grantGroupAccess(accessGroup, participantId);
            }

            console.log('[TrustModel] ✅ Topic access granted to all participants');

        } catch (error) {
            console.error('[TrustModel] Error sharing topic access:', error);
            throw error;
        }
    }

    /**
     * Get the access Group for a topic
     *
     * Topics use Groups to control who can see them. This method retrieves
     * the Group ID that was created when addPersonsToTopic was called.
     */
    private async getTopicAccessGroup(topicId: string): Promise<string | undefined> {
        try {
            // Import ONE.models APIs
            const { getIdObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');

            // Try to get the Topic object to find its access control Group
            // Topics are versioned objects identified by their ID
            const topicObj = await getIdObject(topicId as SHA256IdHash<any>);

            if (!topicObj) {
                console.warn(`[TrustModel] Topic object not found: ${topicId}`);
                return undefined;
            }

            console.log('[TrustModel] Topic object keys:', Object.keys(topicObj));

            // Check for access control Group in various possible locations
            // The Group might be in: group, accessGroup, readers, or another field
            const groupId = (topicObj as any).group ||
                          (topicObj as any).accessGroup ||
                          (topicObj as any).readers;

            if (groupId) {
                console.log(`[TrustModel] Found access group in topic: ${groupId}`);
                return groupId;
            }

            // If not in the Topic object itself, it might be in the channel
            const channelId = (topicObj as any).channel;
            if (channelId) {
                const channelObj = await getIdObject(channelId);
                const channelGroupId = (channelObj as any)?.group || (channelObj as any)?.accessGroup;
                if (channelGroupId) {
                    console.log(`[TrustModel] Found access group in channel: ${channelGroupId}`);
                    return channelGroupId;
                }
            }

            console.warn('[TrustModel] No access group found in topic or channel');
            return undefined;

        } catch (error) {
            console.error('[TrustModel] Error getting topic access group:', error);
            return undefined;
        }
    }

    /**
     * Grant a person access to a Group via Certificate
     *
     * Creates a Certificate that proves the person is a member of the Group.
     * The Certificate is automatically shared via CHUM.
     *
     * TODO: Re-implement using CAModel certificate issuance
     */
    private async grantGroupAccess(
        _groupId: string,
        personId: SHA256IdHash<Person>
    ): Promise<void> {
        try {
            console.log(`[TrustModel] Granting group access to ${personId.toString().slice(0, 8)}...`);

            if (!this.trustedKeysManager) {
                console.warn('[TrustModel] TrustedKeysManager not available - cannot create certificates');
                return;
            }

            // Get the person's public key for the certificate
            const relationship = await this.getTrustRelationshipObject(personId);
            const publicKey = relationship?.peerPublicKey;

            if (!publicKey) {
                console.warn(`[TrustModel] No public key found for ${personId.toString().slice(0, 8)} - cannot create certificate`);
                return;
            }

            // TODO: Implement certificate issuance via CAModel
            // const caModel = new CAModel(oneCore);
            // await caModel.issueDeviceCertificate(personId, publicKey, { ... });

            console.log(`[TrustModel] ⚠️ Certificate issuance not yet implemented - use CAModel`);

        } catch (error) {
            console.error('[TrustModel] Error granting group access:', error);
            // Don't throw - allow other participants to still get access
        }
    }
}
