/**
 * CAPlan - Certificate Authority Plan
 *
 * RPC-style plan for certificate authority operations.
 * Provides transport-agnostic interface for certificate management.
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { Certificate, CertificateType } from '../recipes/Certificate.js';
import type { TrustKeysCertificate } from '../recipes/TrustKeysCertificate.js';
import type { VerifiableCredential } from '../recipes/VerifiableCredential.js';
import { CAModel, CertificateIssueOptions } from '../models/CAModel.js';
import { VCBridge } from '../models/VCBridge.js';

/**
 * Request/Response types for CAPlan
 */

export interface IssueCertificateRequest {
    certificateType: CertificateType;
    subject: SHA256IdHash<Person> | string;
    subjectPublicKey: string;
    validityDays?: number;
    chainDepth?: number;
    issuedBy?: SHA256Hash<Certificate>;
    claims?: Record<string, any>;
}

export interface IssueCertificateResponse {
    certificateHash: SHA256Hash<Certificate>;
    certificateId: string;
}

export interface IssueDeviceCertificateRequest {
    subject: SHA256IdHash<Person>;
    subjectPublicKey: string;
    trustLevel?: 'full' | 'limited' | 'temporary';
    permissions?: Record<string, boolean>;
    validityDays?: number;
    trustReason?: string;
    verificationMethod?: string;
}

export interface IssueDeviceCertificateResponse {
    certificateHash: SHA256Hash<TrustKeysCertificate>;
    certificateId: string;
}

export interface ExtendCertificateRequest {
    certificateId: string;
    additionalDays: number;
}

export interface ExtendCertificateResponse {
    certificateHash: SHA256Hash<Certificate>;
    newValidUntil: number;
}

export interface RevokeCertificateRequest {
    certificateId: string;
    reason?: string;
}

export interface RevokeCertificateResponse {
    certificateHash: SHA256Hash<Certificate>;
    revokedAt: number;
}

export interface GetCertificateRequest {
    certificateId: string;
}

export interface GetCertificateResponse {
    certificate: Certificate | null;
}

export interface GetCertificateHistoryRequest {
    certificateId: string;
}

export interface GetCertificateHistoryResponse {
    versions: Certificate[];
}

export interface VerifyCertificateRequest {
    certificate: Certificate;
}

export interface VerifyCertificateResponse {
    valid: boolean;
    reason?: string;
}

export interface ExportAsVCRequest {
    certificateId: string;
}

export interface ExportAsVCResponse {
    verifiableCredential: VerifiableCredential;
    jsonLD: string;
}

export interface ImportVCRequest {
    jsonLD: string;
}

export interface ImportVCResponse {
    certificateHash: SHA256Hash<Certificate>;
    certificateId: string;
}

/**
 * CAPlan
 *
 * Transport-agnostic certificate authority operations.
 * Designed for use with IPC, HTTP, or other RPC mechanisms.
 */
export class CAPlan {
    private caModel: CAModel;

    constructor(caModel: CAModel) {
        this.caModel = caModel;
    }

    /**
     * Issue a new certificate
     */
    async issueCertificate(
        request: IssueCertificateRequest
    ): Promise<IssueCertificateResponse> {
        const options: CertificateIssueOptions = {
            certificateType: request.certificateType,
            subject: request.subject,
            subjectPublicKey: request.subjectPublicKey,
            validityDays: request.validityDays,
            chainDepth: request.chainDepth,
            issuedBy: request.issuedBy,
            claims: request.claims
        };

        const certificateHash = await this.caModel.issueCertificate(options);
        const certificate = await this.caModel.getCertificate(
            options.certificateType + ':' + options.subject
        );

        return {
            certificateHash,
            certificateId: certificate?.id || ''
        };
    }

    /**
     * Issue a device trust certificate
     */
    async issueDeviceCertificate(
        request: IssueDeviceCertificateRequest
    ): Promise<IssueDeviceCertificateResponse> {
        const certificateHash = await this.caModel.issueDeviceCertificate(
            request.subject,
            request.subjectPublicKey,
            {
                trustLevel: request.trustLevel,
                permissions: request.permissions,
                validityDays: request.validityDays,
                trustReason: request.trustReason,
                verificationMethod: request.verificationMethod
            }
        );

        const certificate = await this.caModel.getCertificate(
            `cert:device:${request.subject}`
        );

        return {
            certificateHash,
            certificateId: certificate?.id || ''
        };
    }

    /**
     * Extend a certificate's validity
     */
    async extendCertificate(
        request: ExtendCertificateRequest
    ): Promise<ExtendCertificateResponse> {
        const certificateHash = await this.caModel.extendCertificate({
            certificateId: request.certificateId,
            additionalDays: request.additionalDays
        });

        const certificate = await this.caModel.getCertificate(request.certificateId);

        return {
            certificateHash,
            newValidUntil: certificate?.validUntil || 0
        };
    }

    /**
     * Revoke a certificate
     */
    async revokeCertificate(
        request: RevokeCertificateRequest
    ): Promise<RevokeCertificateResponse> {
        const certificateHash = await this.caModel.revokeCertificate({
            certificateId: request.certificateId,
            reason: request.reason
        });

        return {
            certificateHash,
            revokedAt: Date.now()
        };
    }

    /**
     * Get a certificate by ID
     */
    async getCertificate(
        request: GetCertificateRequest
    ): Promise<GetCertificateResponse> {
        const certificate = await this.caModel.getCertificate(request.certificateId);

        return {
            certificate
        };
    }

    /**
     * Get certificate history (all versions)
     */
    async getCertificateHistory(
        request: GetCertificateHistoryRequest
    ): Promise<GetCertificateHistoryResponse> {
        const versions = await this.caModel.getCertificateHistory(request.certificateId);

        return {
            versions
        };
    }

    /**
     * Verify certificate validity
     */
    async verifyCertificate(
        request: VerifyCertificateRequest
    ): Promise<VerifyCertificateResponse> {
        const result = await this.caModel.verifyCertificate(request.certificate);

        return result;
    }

    /**
     * Export certificate as Verifiable Credential
     */
    async exportAsVC(
        request: ExportAsVCRequest
    ): Promise<ExportAsVCResponse> {
        const certificate = await this.caModel.getCertificate(request.certificateId);

        if (!certificate) {
            throw new Error(`Certificate not found: ${request.certificateId}`);
        }

        const verifiableCredential = VCBridge.certificateToVC(certificate);
        const jsonLD = VCBridge.exportAsJsonLD(certificate);

        return {
            verifiableCredential,
            jsonLD
        };
    }

    /**
     * Import Verifiable Credential as Certificate
     */
    async importVC(
        request: ImportVCRequest
    ): Promise<ImportVCResponse> {
        const vc = VCBridge.importFromJsonLD(request.jsonLD);
        const certificate = VCBridge.vcToCertificate(vc);

        // Store the certificate
        const oneCore = (this.caModel as any).oneCore;  // Access private field
        const certificateHash = await oneCore.storeVersionedObject(certificate);

        return {
            certificateHash,
            certificateId: certificate.id
        };
    }

    /**
     * Get root certificate for this CA
     */
    async getRootCertificate(): Promise<Certificate | null> {
        return this.caModel.getRootCertificate();
    }
}
