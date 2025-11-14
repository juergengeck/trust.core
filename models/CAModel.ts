/**
 * CAModel - Certificate Authority Model
 *
 * Manages certificate issuance, revocation, and lifecycle for a ONE instance acting as a CA.
 * Every ONE instance can be a Certificate Authority with its own root certificate.
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { Certificate, CertificateType, CertificateStatus } from '../recipes/Certificate.js';
import type { TrustKeysCertificate } from '../recipes/TrustKeysCertificate.js';

/**
 * Certificate Issuance Options
 */
export interface CertificateIssueOptions {
    certificateType: CertificateType;
    subject: SHA256IdHash<Person> | string;
    subjectPublicKey: string;
    validityDays?: number;  // Default: 365
    chainDepth?: number;    // Default: 0 (direct from root)
    issuedBy?: SHA256Hash<Certificate>;  // Parent certificate
    claims?: Record<string, any>;
}

/**
 * Certificate Extension Options
 */
export interface CertificateExtendOptions {
    certificateId: string;
    additionalDays: number;
}

/**
 * Certificate Revocation Options
 */
export interface CertificateRevokeOptions {
    certificateId: string;
    reason?: string;
}

/**
 * CAModel
 *
 * Platform-agnostic Certificate Authority operations.
 * Manages the full certificate lifecycle using ONE.core storage and versioning.
 */
export class CAModel {
    private oneCore: any;  // ONE.core instance (injected)
    private instanceId: SHA256IdHash<Person> | null = null;
    private instancePublicKey: string | null = null;
    private rootCertificate: Certificate | null = null;
    private serialNumberCounter: number = 0;

    constructor(oneCore: any) {
        this.oneCore = oneCore;
    }

    /**
     * Initialize the CA Model
     * Loads or creates root certificate
     */
    async init(): Promise<void> {
        // Get instance identity from keychain
        const keychain = this.oneCore.getKeyChain();
        this.instanceId = await keychain.getIdHash();
        this.instancePublicKey = await keychain.getPublicKey();

        // Try to load existing root certificate
        await this.loadRootCertificate();

        // If no root certificate exists, create one
        if (!this.rootCertificate) {
            await this.createRootCertificate();
        }
    }

    /**
     * Create root certificate for this CA instance
     */
    private async createRootCertificate(): Promise<void> {
        if (!this.instanceId || !this.instancePublicKey) {
            throw new Error('CA not initialized: missing instance identity');
        }

        const now = Date.now();
        const rootCert: Certificate = {
            $type$: 'Certificate',
            id: `cert:root:${this.instanceId}`,
            certificateType: 'identity',
            status: 'valid',
            subject: this.instanceId,
            subjectPublicKey: this.instancePublicKey,
            issuer: this.instanceId,  // Self-signed
            issuerPublicKey: this.instancePublicKey,
            validFrom: now,
            validUntil: now + (365 * 10 * 24 * 60 * 60 * 1000),  // 10 years
            chainDepth: 0,  // Root certificate
            claims: {
                name: 'Local Root Certificate',
                canSign: true,
                canIssue: true,
                canRevoke: true,
                purposes: ['authentication', 'signing', 'encryption']
            },
            issuedAt: now,
            serialNumber: this.generateSerialNumber(),
            version: 1
        };

        // Store and sign the root certificate
        const hash = await this.oneCore.storeVersionedObject(rootCert);
        const signed = await this.oneCore.sign(hash);

        this.rootCertificate = { ...rootCert, signature: signed };
    }

    /**
     * Load existing root certificate
     */
    private async loadRootCertificate(): Promise<void> {
        if (!this.instanceId) {
            return;
        }

        try {
            const certId = `cert:root:${this.instanceId}`;
            const versions = await this.oneCore.getIdObject(certId);

            if (versions && versions.length > 0) {
                // Get latest version
                this.rootCertificate = versions[versions.length - 1] as Certificate;
            }
        } catch (error) {
            // Root certificate doesn't exist yet
            console.debug('No root certificate found, will create on init');
        }
    }

    /**
     * Issue a new certificate
     */
    async issueCertificate(options: CertificateIssueOptions): Promise<SHA256Hash<Certificate>> {
        if (!this.instanceId || !this.instancePublicKey || !this.rootCertificate) {
            throw new Error('CA not initialized');
        }

        const now = Date.now();
        const validityMs = (options.validityDays || 365) * 24 * 60 * 60 * 1000;

        const cert: Certificate = {
            $type$: 'Certificate',
            id: `cert:${options.certificateType}:${options.subject}:${this.generateSerialNumber()}`,
            certificateType: options.certificateType,
            status: 'valid',
            subject: options.subject,
            subjectPublicKey: options.subjectPublicKey,
            issuer: this.instanceId,
            issuerPublicKey: this.instancePublicKey,
            validFrom: now,
            validUntil: now + validityMs,
            issuedBy: options.issuedBy,
            chainDepth: options.chainDepth !== undefined ? options.chainDepth : 1,
            claims: options.claims,
            issuedAt: now,
            serialNumber: this.generateSerialNumber(),
            version: 1
        };

        // Store and sign
        const hash = await this.oneCore.storeVersionedObject(cert);
        await this.oneCore.sign(hash);

        return hash as SHA256Hash<Certificate>;
    }

    /**
     * Issue a device trust certificate (TrustKeysCertificate)
     */
    async issueDeviceCertificate(
        subject: SHA256IdHash<Person>,
        subjectPublicKey: string,
        options?: {
            trustLevel?: 'full' | 'limited' | 'temporary';
            permissions?: Record<string, boolean>;
            validityDays?: number;
            trustReason?: string;
            verificationMethod?: string;
        }
    ): Promise<SHA256Hash<TrustKeysCertificate>> {
        if (!this.instanceId || !this.instancePublicKey) {
            throw new Error('CA not initialized');
        }

        const now = Date.now();
        const validityMs = (options?.validityDays || 365) * 24 * 60 * 60 * 1000;

        const cert: TrustKeysCertificate = {
            $type$: 'TrustKeysCertificate',
            id: `cert:device:${subject}:${this.generateSerialNumber()}`,
            certificateType: 'device',
            status: 'valid',
            subject,
            subjectPublicKey,
            issuer: this.instanceId,
            issuerPublicKey: this.instancePublicKey,
            validFrom: now,
            validUntil: now + validityMs,
            chainDepth: 1,
            trustLevel: options?.trustLevel || 'limited',
            trustReason: options?.trustReason,
            verificationMethod: options?.verificationMethod,
            permissions: options?.permissions,
            issuedAt: now,
            serialNumber: this.generateSerialNumber(),
            version: 1
        };

        // Store and sign
        const hash = await this.oneCore.storeVersionedObject(cert);
        await this.oneCore.sign(hash);

        return hash as SHA256Hash<TrustKeysCertificate>;
    }

    /**
     * Extend a certificate's validity
     * Creates a new version with extended validUntil
     */
    async extendCertificate(options: CertificateExtendOptions): Promise<SHA256Hash<Certificate>> {
        const versions = await this.oneCore.getIdObject(options.certificateId);

        if (!versions || versions.length === 0) {
            throw new Error(`Certificate not found: ${options.certificateId}`);
        }

        const latestCert = versions[versions.length - 1] as Certificate;

        // Create new version with extended validity
        const extensionMs = options.additionalDays * 24 * 60 * 60 * 1000;
        const extendedCert: Certificate = {
            ...latestCert,
            validUntil: latestCert.validUntil + extensionMs,
            version: latestCert.version + 1
        };

        const hash = await this.oneCore.storeVersionedObject(extendedCert);
        await this.oneCore.sign(hash);

        return hash as SHA256Hash<Certificate>;
    }

    /**
     * Reduce a certificate's validity
     * Creates a new version with earlier validUntil
     */
    async reduceCertificate(
        certificateId: string,
        newValidUntil: number
    ): Promise<SHA256Hash<Certificate>> {
        const versions = await this.oneCore.getIdObject(certificateId);

        if (!versions || versions.length === 0) {
            throw new Error(`Certificate not found: ${certificateId}`);
        }

        const latestCert = versions[versions.length - 1] as Certificate;

        if (newValidUntil >= latestCert.validUntil) {
            throw new Error('New validUntil must be earlier than current validUntil');
        }

        const reducedCert: Certificate = {
            ...latestCert,
            validUntil: newValidUntil,
            version: latestCert.version + 1
        };

        const hash = await this.oneCore.storeVersionedObject(reducedCert);
        await this.oneCore.sign(hash);

        return hash as SHA256Hash<Certificate>;
    }

    /**
     * Revoke a certificate
     * Creates a new version with status='revoked' and validUntil in the past
     */
    async revokeCertificate(options: CertificateRevokeOptions): Promise<SHA256Hash<Certificate>> {
        const versions = await this.oneCore.getIdObject(options.certificateId);

        if (!versions || versions.length === 0) {
            throw new Error(`Certificate not found: ${options.certificateId}`);
        }

        const latestCert = versions[versions.length - 1] as Certificate;

        const revokedCert: Certificate = {
            ...latestCert,
            status: 'revoked',
            validUntil: Date.now() - 1,  // Set expiry to past
            version: latestCert.version + 1
        };

        const hash = await this.oneCore.storeVersionedObject(revokedCert);
        await this.oneCore.sign(hash);

        return hash as SHA256Hash<Certificate>;
    }

    /**
     * Get certificate by ID
     */
    async getCertificate(certificateId: string): Promise<Certificate | null> {
        try {
            const versions = await this.oneCore.getIdObject(certificateId);
            if (!versions || versions.length === 0) {
                return null;
            }
            return versions[versions.length - 1] as Certificate;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get all versions of a certificate (audit trail)
     */
    async getCertificateHistory(certificateId: string): Promise<Certificate[]> {
        const versions = await this.oneCore.getIdObject(certificateId);
        return (versions || []) as Certificate[];
    }

    /**
     * Verify certificate validity
     */
    async verifyCertificate(certificate: Certificate): Promise<{
        valid: boolean;
        reason?: string;
    }> {
        const now = Date.now();

        // Check status
        if (certificate.status === 'revoked') {
            return { valid: false, reason: 'Certificate is revoked' };
        }

        if (certificate.status === 'suspended') {
            return { valid: false, reason: 'Certificate is suspended' };
        }

        // Check time bounds
        if (now < certificate.validFrom) {
            return { valid: false, reason: 'Certificate not yet valid' };
        }

        if (now > certificate.validUntil) {
            return { valid: false, reason: 'Certificate has expired' };
        }

        // Verify signature if present
        if (certificate.signature) {
            // TODO: Implement signature verification via ONE.core
        }

        return { valid: true };
    }

    /**
     * Get root certificate
     */
    getRootCertificate(): Certificate | null {
        return this.rootCertificate;
    }

    /**
     * Generate unique serial number
     */
    private generateSerialNumber(): string {
        const timestamp = Date.now();
        const counter = this.serialNumberCounter++;
        return `${timestamp}-${counter}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Shutdown the CA Model
     */
    async shutdown(): Promise<void> {
        this.rootCertificate = null;
        this.instanceId = null;
        this.instancePublicKey = null;
    }
}
