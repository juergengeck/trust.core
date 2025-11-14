/**
 * VCBridge - Verifiable Credential Bridge
 *
 * Bidirectional conversion between ONE.core Certificates and W3C Verifiable Credentials.
 * Provides structural compatibility in both directions:
 * - Certificate → VC (for external presentation)
 * - VC → Certificate (for internal storage)
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { Certificate } from '../recipes/Certificate.js';
import type { TrustKeysCertificate } from '../recipes/TrustKeysCertificate.js';
import type { VerifiableCredential } from '../recipes/VerifiableCredential.js';

/**
 * DID Method for ONE Platform
 * Format: did:one:sha256:<hash>
 */
export class DIDConverter {
    /**
     * Convert SHA256IdHash to DID
     */
    static hashToDID(hash: SHA256IdHash<any> | SHA256Hash<any>): string {
        return `did:one:sha256:${hash}`;
    }

    /**
     * Convert DID to SHA256Hash
     */
    static didToHash(did: string): SHA256IdHash<any> | SHA256Hash<any> | null {
        if (!did.startsWith('did:one:sha256:')) {
            return null;
        }
        return did.replace('did:one:sha256:', '') as SHA256IdHash<any>;
    }

    /**
     * Check if string is a valid DID
     */
    static isValidDID(did: string): boolean {
        return did.startsWith('did:one:sha256:') && did.length > 'did:one:sha256:'.length;
    }
}

/**
 * Ed25519 Proof Converter
 */
export class ProofConverter {
    /**
     * Convert ONE.core signature to W3C Ed25519Signature2020 proof
     */
    static toW3CProof(
        signature: string,
        issuerDID: string,
        created: number = Date.now()
    ): {
        type: string;
        created: string;
        proofPurpose: string;
        verificationMethod: string;
        proofValue: string;
    } {
        return {
            type: 'Ed25519Signature2020',
            created: new Date(created).toISOString(),
            proofPurpose: 'assertionMethod',
            verificationMethod: `${issuerDID}#keys-1`,
            proofValue: signature  // Assuming already base64/base58 encoded
        };
    }

    /**
     * Convert W3C Ed25519Signature2020 proof to ONE.core signature
     */
    static fromW3CProof(proof: {
        type: string;
        proofValue: string;
    }): string | null {
        if (proof.type !== 'Ed25519Signature2020') {
            console.warn(`Unsupported proof type: ${proof.type}`);
            return null;
        }
        return proof.proofValue;
    }
}

/**
 * VCBridge
 *
 * Converts between Certificate and VerifiableCredential formats
 */
export class VCBridge {
    /**
     * Convert Certificate to Verifiable Credential
     */
    static certificateToVC(cert: Certificate): VerifiableCredential {
        const issuerDID = DIDConverter.hashToDID(cert.issuer);
        const subjectDID = typeof cert.subject === 'string' && cert.subject.startsWith('did:')
            ? cert.subject
            : DIDConverter.hashToDID(cert.subject as SHA256IdHash<Person>);

        const vc: VerifiableCredential = {
            $type$: 'VerifiableCredential',
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://w3id.org/security/suites/ed25519-2020/v1'
            ],
            id: `urn:one:cert:${cert.id}`,
            type: ['VerifiableCredential', `${cert.certificateType}Certificate`],
            issuer: {
                id: issuerDID,
                name: cert.claims?.name
            },
            issuanceDate: new Date(cert.issuedAt).toISOString(),
            expirationDate: new Date(cert.validUntil).toISOString(),
            credentialSubject: {
                id: subjectDID,
                publicKey: cert.subjectPublicKey,
                ...cert.claims
            }
        };

        // Add proof if signature exists
        if (cert.signature) {
            vc.proof = ProofConverter.toW3CProof(
                cert.signature,
                issuerDID,
                cert.issuedAt
            );
        }

        // Add ONE.core metadata
        vc._oneMetadata = {
            version: cert.version
        };

        return vc;
    }

    /**
     * Convert TrustKeysCertificate to Verifiable Credential
     */
    static trustKeysCertificateToVC(cert: TrustKeysCertificate): VerifiableCredential {
        const issuerDID = DIDConverter.hashToDID(cert.issuer);
        const subjectDID = DIDConverter.hashToDID(cert.subject);

        const vc: VerifiableCredential = {
            $type$: 'VerifiableCredential',
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://w3id.org/security/suites/ed25519-2020/v1'
            ],
            id: `urn:one:cert:${cert.id}`,
            type: ['VerifiableCredential', 'DeviceTrustCredential'],
            issuer: {
                id: issuerDID
            },
            issuanceDate: new Date(cert.issuedAt).toISOString(),
            expirationDate: new Date(cert.validUntil).toISOString(),
            credentialSubject: {
                id: subjectDID,
                publicKey: cert.subjectPublicKey,
                deviceName: cert.deviceName,
                trustLevel: cert.trustLevel,
                trustReason: cert.trustReason,
                verificationMethod: cert.verificationMethod,
                permissions: cert.permissions
            }
        };

        // Add proof if signature exists
        if (cert.signature) {
            vc.proof = ProofConverter.toW3CProof(
                cert.signature,
                issuerDID,
                cert.issuedAt
            );
        }

        // Add ONE.core metadata
        vc._oneMetadata = {
            version: cert.version
        };

        return vc;
    }

    /**
     * Convert Verifiable Credential to Certificate
     */
    static vcToCertificate(vc: VerifiableCredential): Certificate {
        // Extract certificate type from VC type array
        const certType = vc.type.find(t =>
            t !== 'VerifiableCredential'
        )?.replace('Certificate', '').toLowerCase() as any || 'identity';

        // Convert DIDs to hashes
        const issuerDID = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id;
        const issuerHash = DIDConverter.didToHash(issuerDID);

        const subjectDID = vc.credentialSubject.id;
        const subjectHash = DIDConverter.didToHash(subjectDID);

        if (!issuerHash || !subjectHash) {
            throw new Error('Invalid DID format in VC');
        }

        // Extract signature from proof
        const signature = vc.proof ? ProofConverter.fromW3CProof(vc.proof) : undefined;

        const cert: Certificate = {
            $type$: 'Certificate',
            id: vc.id.replace('urn:one:cert:', ''),
            certificateType: certType,
            status: 'valid',  // Determine from expiration date
            subject: subjectHash,
            subjectPublicKey: vc.credentialSubject.publicKey,
            issuer: issuerHash as SHA256IdHash<Person>,
            issuerPublicKey: '',  // Not stored in VC, needs to be looked up
            validFrom: new Date(vc.issuanceDate).getTime(),
            validUntil: vc.expirationDate ? new Date(vc.expirationDate).getTime() : 0,
            chainDepth: 1,  // Default, can be overridden
            claims: {
                ...vc.credentialSubject,
                id: undefined,  // Remove id from claims
                publicKey: undefined  // Remove publicKey from claims
            },
            issuedAt: new Date(vc.issuanceDate).getTime(),
            serialNumber: vc.id,  // Use VC ID as serial number
            version: vc._oneMetadata?.version || 1,
            signature: signature || undefined
        };

        return cert;
    }

    /**
     * Convert Verifiable Credential to TrustKeysCertificate
     */
    static vcToTrustKeysCertificate(vc: VerifiableCredential): TrustKeysCertificate {
        // Verify this is a DeviceTrustCredential
        if (!vc.type.includes('DeviceTrustCredential')) {
            throw new Error('VC is not a DeviceTrustCredential');
        }

        const issuerDID = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id;
        const issuerHash = DIDConverter.didToHash(issuerDID);

        const subjectDID = vc.credentialSubject.id;
        const subjectHash = DIDConverter.didToHash(subjectDID);

        if (!issuerHash || !subjectHash) {
            throw new Error('Invalid DID format in VC');
        }

        const signature = vc.proof ? ProofConverter.fromW3CProof(vc.proof) : undefined;

        const cert: TrustKeysCertificate = {
            $type$: 'TrustKeysCertificate',
            id: vc.id.replace('urn:one:cert:', ''),
            certificateType: 'device',
            status: 'valid',
            subject: subjectHash as SHA256IdHash<Person>,
            subjectPublicKey: vc.credentialSubject.publicKey,
            deviceName: vc.credentialSubject.deviceName,
            issuer: issuerHash as SHA256IdHash<Person>,
            issuerPublicKey: '',  // Not stored in VC
            validFrom: new Date(vc.issuanceDate).getTime(),
            validUntil: vc.expirationDate ? new Date(vc.expirationDate).getTime() : 0,
            chainDepth: 1,
            trustLevel: vc.credentialSubject.trustLevel || 'limited',
            trustReason: vc.credentialSubject.trustReason,
            verificationMethod: vc.credentialSubject.verificationMethod,
            permissions: vc.credentialSubject.permissions,
            issuedAt: new Date(vc.issuanceDate).getTime(),
            serialNumber: vc.id,
            version: vc._oneMetadata?.version || 1,
            signature: signature || undefined
        };

        return cert;
    }

    /**
     * Export certificate as JSON-LD (for external sharing)
     */
    static exportAsJsonLD(cert: Certificate | TrustKeysCertificate): string {
        const vc = cert.$type$ === 'TrustKeysCertificate'
            ? this.trustKeysCertificateToVC(cert as TrustKeysCertificate)
            : this.certificateToVC(cert);

        // Remove ONE.core specific fields for external sharing
        const { $type$, _oneMetadata, ...jsonLD } = vc;

        return JSON.stringify(jsonLD, null, 2);
    }

    /**
     * Import from JSON-LD (external VC)
     */
    static importFromJsonLD(jsonLD: string): VerifiableCredential {
        const parsed = JSON.parse(jsonLD);

        // Add ONE.core type
        return {
            $type$: 'VerifiableCredential',
            ...parsed
        };
    }
}
