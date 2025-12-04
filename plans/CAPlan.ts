/**
 * CAPlan - Certificate Authority Plan
 *
 * RPC-style plan for certificate authority operations.
 * Provides transport-agnostic interface for certificate management.
 * Integrates with StoryFactory for journal/audit trail visibility.
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person, OneObjectTypes } from '@refinio/one.core/lib/recipes.js';
import type { Certificate, CertificateType } from '../recipes/Certificate.js';
import type { TrustKeysCertificate } from '../recipes/TrustKeysCertificate.js';
import type { VerifiableCredential } from '../recipes/VerifiableCredential.js';
import type { StoryFactory, ExecutionMetadata, ExecutionResult, OperationResult, Plan } from '@refinio/api/plan-system';
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
 * Integrates with StoryFactory for journal/audit trail visibility.
 */
export class CAPlan {
    static readonly PLAN_ID = 'CAPlan';
    static readonly PLAN_NAME = 'Certificate Authority Plan';
    static readonly PLAN_DESCRIPTION = 'Manages certificate issuance, extension, and revocation';
    static readonly PLAN_DOMAIN = 'trust';

    private caModel: CAModel;
    private storyFactory: StoryFactory | null = null;
    private planIdHash: SHA256IdHash<Plan> | null = null;

    constructor(caModel: CAModel) {
        this.caModel = caModel;
    }

    /**
     * Set the StoryFactory and register the Plan ONE object.
     */
    async setStoryFactory(factory: StoryFactory): Promise<void> {
        this.storyFactory = factory;
        this.planIdHash = await factory.registerPlan({
            id: CAPlan.PLAN_ID,
            name: CAPlan.PLAN_NAME,
            description: CAPlan.PLAN_DESCRIPTION,
            domain: CAPlan.PLAN_DOMAIN,
            demandPatterns: [
                { keywords: ['certificate', 'trust', 'identity'] },
                { keywords: ['device', 'keys', 'attestation'] }
            ],
            supplyPatterns: [
                { keywords: ['certificate', 'issued', 'valid'] },
                { keywords: ['trust', 'verified', 'attested'] }
            ]
        });
        console.log(`[CAPlan] Registered Plan with hash: ${this.planIdHash.substring(0, 8)}...`);
    }

    /**
     * Get the Plan's real SHA256IdHash (must be initialized first)
     */
    getPlanIdHash(): SHA256IdHash<Plan> {
        if (!this.planIdHash) {
            throw new Error('[CAPlan] Plan not registered - call setStoryFactory first');
        }
        return this.planIdHash;
    }

    /**
     * Issue a new certificate
     */
    async issueCertificate(
        request: IssueCertificateRequest
    ): Promise<IssueCertificateResponse | ExecutionResult<IssueCertificateResponse>> {
        const options: CertificateIssueOptions = {
            certificateType: request.certificateType,
            subject: request.subject,
            subjectPublicKey: request.subjectPublicKey,
            validityDays: request.validityDays,
            chainDepth: request.chainDepth,
            issuedBy: request.issuedBy,
            claims: request.claims
        };

        // If no StoryFactory, fall back to direct operation (no Assembly)
        if (!this.storyFactory) {
            const certificateHash = await this.caModel.issueCertificate(options);
            const certificate = await this.caModel.getCertificate(
                options.certificateType + ':' + options.subject
            );
            return {
                certificateHash,
                certificateId: certificate?.id || ''
            };
        }

        // Story metadata for journal visibility
        const subjectStr = String(request.subject).substring(0, 8);
        const metadata: ExecutionMetadata = {
            title: `Certificate "${request.certificateType}" issued for ${subjectStr}`,
            planId: this.getPlanIdHash(),
            planTypeName: CAPlan.PLAN_ID,
            owner: request.subject as SHA256IdHash<Person>,
            instanceVersion: `instance-${Date.now()}`
        };

        // Use wrapExecution to create Story atomically
        const result = await this.storyFactory.wrapExecution(
            metadata,
            async (): Promise<OperationResult<IssueCertificateResponse>> => {
                const certificateHash = await this.caModel.issueCertificate(options);
                const certificate = await this.caModel.getCertificate(
                    options.certificateType + ':' + options.subject
                );
                return {
                    result: {
                        certificateHash,
                        certificateId: certificate?.id || ''
                    },
                    productHash: certificateHash as unknown as SHA256Hash<OneObjectTypes>
                };
            }
        );

        console.log(`[CAPlan] ✅ Issued certificate with Story: ${result.storyId?.toString().substring(0, 8)}...`);

        return {
            result: result.result,
            storyId: result.storyId,
            assemblyId: result.assemblyId
        };
    }

    /**
     * Issue a device trust certificate
     */
    async issueDeviceCertificate(
        request: IssueDeviceCertificateRequest
    ): Promise<IssueDeviceCertificateResponse | ExecutionResult<IssueDeviceCertificateResponse>> {
        // If no StoryFactory, fall back to direct operation
        if (!this.storyFactory) {
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

        // Story metadata for journal visibility
        const subjectStr = request.subject.substring(0, 8);
        const trustLevel = request.trustLevel || 'full';
        const metadata: ExecutionMetadata = {
            title: `Device certificate issued (${trustLevel}) for ${subjectStr}`,
            planId: this.getPlanIdHash(),
            planTypeName: CAPlan.PLAN_ID,
            owner: request.subject,
            instanceVersion: `instance-${Date.now()}`
        };

        const result = await this.storyFactory.wrapExecution(
            metadata,
            async (): Promise<OperationResult<IssueDeviceCertificateResponse>> => {
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
                    result: {
                        certificateHash,
                        certificateId: certificate?.id || ''
                    },
                    productHash: certificateHash as unknown as SHA256Hash<OneObjectTypes>
                };
            }
        );

        console.log(`[CAPlan] ✅ Issued device certificate with Story: ${result.storyId?.toString().substring(0, 8)}...`);

        return {
            result: result.result,
            storyId: result.storyId,
            assemblyId: result.assemblyId
        };
    }

    /**
     * Extend a certificate's validity
     */
    async extendCertificate(
        request: ExtendCertificateRequest
    ): Promise<ExtendCertificateResponse | ExecutionResult<ExtendCertificateResponse>> {
        // If no StoryFactory, fall back to direct operation
        if (!this.storyFactory) {
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

        // Story metadata for journal visibility
        const certIdShort = request.certificateId.substring(0, 16);
        const metadata: ExecutionMetadata = {
            title: `Certificate extended by ${request.additionalDays} days: ${certIdShort}`,
            planId: this.getPlanIdHash(),
            planTypeName: CAPlan.PLAN_ID,
            owner: undefined as any,  // Certificate owner not available from certificateId
            instanceVersion: `instance-${Date.now()}`
        };

        const result = await this.storyFactory.wrapExecution(
            metadata,
            async (): Promise<OperationResult<ExtendCertificateResponse>> => {
                const certificateHash = await this.caModel.extendCertificate({
                    certificateId: request.certificateId,
                    additionalDays: request.additionalDays
                });
                const certificate = await this.caModel.getCertificate(request.certificateId);
                return {
                    result: {
                        certificateHash,
                        newValidUntil: certificate?.validUntil || 0
                    },
                    productHash: certificateHash as unknown as SHA256Hash<OneObjectTypes>
                };
            }
        );

        console.log(`[CAPlan] ✅ Extended certificate with Story: ${result.storyId?.toString().substring(0, 8)}...`);

        return {
            result: result.result,
            storyId: result.storyId,
            assemblyId: result.assemblyId
        };
    }

    /**
     * Revoke a certificate
     */
    async revokeCertificate(
        request: RevokeCertificateRequest
    ): Promise<RevokeCertificateResponse | ExecutionResult<RevokeCertificateResponse>> {
        // If no StoryFactory, fall back to direct operation
        if (!this.storyFactory) {
            const certificateHash = await this.caModel.revokeCertificate({
                certificateId: request.certificateId,
                reason: request.reason
            });
            return {
                certificateHash,
                revokedAt: Date.now()
            };
        }

        // Story metadata for journal visibility
        const certIdShort = request.certificateId.substring(0, 16);
        const reasonText = request.reason ? `: ${request.reason}` : '';
        const metadata: ExecutionMetadata = {
            title: `Certificate revoked: ${certIdShort}${reasonText}`,
            planId: this.getPlanIdHash(),
            planTypeName: CAPlan.PLAN_ID,
            owner: undefined as any,  // Certificate owner not available from certificateId
            instanceVersion: `instance-${Date.now()}`
        };

        const result = await this.storyFactory.wrapExecution(
            metadata,
            async (): Promise<OperationResult<RevokeCertificateResponse>> => {
                const certificateHash = await this.caModel.revokeCertificate({
                    certificateId: request.certificateId,
                    reason: request.reason
                });
                return {
                    result: {
                        certificateHash,
                        revokedAt: Date.now()
                    },
                    productHash: certificateHash as unknown as SHA256Hash<OneObjectTypes>
                };
            }
        );

        console.log(`[CAPlan] ✅ Revoked certificate with Story: ${result.storyId?.toString().substring(0, 8)}...`);

        return {
            result: result.result,
            storyId: result.storyId,
            assemblyId: result.assemblyId
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
