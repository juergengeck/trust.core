/**
 * Recipe Exports
 *
 * Export all trust.core recipes for registration with ONE.core
 */

// TrustRelationship
export type {
    TrustRelationship,
    TrustStatus,
    TrustLevel
} from './TrustRelationship.js';

export {
    TrustRelationshipRecipe,
    TrustRelationshipReverseMap
} from './TrustRelationship.js';

// GroupAttestation
export type {
    GroupAttestation
} from './GroupAttestation.js';

export {
    GroupAttestationRecipe,
    GroupAttestationReverseMap
} from './GroupAttestation.js';

// CertificateRegistry
export type {
    CertificateRegistry
} from './CertificateRegistry.js';

export {
    CertificateRegistryRecipe,
    CertificateRegistryReverseMap
} from './CertificateRegistry.js';

// Certificate (Base)
export type {
    Certificate,
    CertificateType,
    CertificateStatus
} from './Certificate.js';

export {
    CertificateRecipe,
    CertificateReverseMap
} from './Certificate.js';

// TrustKeysCertificate - REMOVED: Use ONE.models' version instead
// ONE.models has TrustKeysCertificate with auto-registration via registerLicense()
// Re-exporting types only for convenience, recipe comes from ONE.models
export type { TrustKeysCertificate } from './TrustKeysCertificate.js';

// VerifiableCredential
export type {
    VerifiableCredential
} from './VerifiableCredential.js';

export {
    VerifiableCredentialRecipe,
    VerifiableCredentialReverseMap
} from './VerifiableCredential.js';

// SubscriptionCertificate
export type {
    SubscriptionCertificate,
    SubscriptionTier,
    SubscriptionStatus
} from './SubscriptionCertificate.js';

export {
    SubscriptionCertificateRecipe,
    SubscriptionCertificateReverseMap
} from './SubscriptionCertificate.js';

// SubscriptionBalance
export type {
    SubscriptionBalance
} from './SubscriptionBalance.js';

export {
    SubscriptionBalanceRecipe,
    SubscriptionBalanceReverseMap
} from './SubscriptionBalance.js';

// Import for convenience arrays
import { TrustRelationshipRecipe, TrustRelationshipReverseMap } from './TrustRelationship.js';
import { GroupAttestationRecipe, GroupAttestationReverseMap } from './GroupAttestation.js';
import { CertificateRegistryRecipe, CertificateRegistryReverseMap } from './CertificateRegistry.js';
import { CertificateRecipe, CertificateReverseMap } from './Certificate.js';
// TrustKeysCertificate - Use ONE.models' version (auto-registered)
import { VerifiableCredentialRecipe, VerifiableCredentialReverseMap } from './VerifiableCredential.js';
import { SubscriptionCertificateRecipe, SubscriptionCertificateReverseMap } from './SubscriptionCertificate.js';
import { SubscriptionBalanceRecipe, SubscriptionBalanceReverseMap } from './SubscriptionBalance.js';

/**
 * All recipes for batch registration
 *
 * NOTE: TrustKeysCertificate is NOT included here - it's auto-registered by ONE.models
 * via registerLicense() when the module is imported. Including it would cause duplicate
 * registration errors.
 */
export const AllRecipes = [
    TrustRelationshipRecipe,
    GroupAttestationRecipe,
    CertificateRegistryRecipe,
    CertificateRecipe,
    // TrustKeysCertificateRecipe - REMOVED: Use ONE.models' version
    VerifiableCredentialRecipe,
    SubscriptionCertificateRecipe,
    SubscriptionBalanceRecipe
];

/**
 * All reverse maps for batch registration
 *
 * NOTE: TrustKeysCertificateReverseMap is NOT included - managed by ONE.models
 */
export const AllReverseMaps = [
    TrustRelationshipReverseMap,
    GroupAttestationReverseMap,
    CertificateRegistryReverseMap,
    CertificateReverseMap,
    // TrustKeysCertificateReverseMap - REMOVED: Use ONE.models' version
    VerifiableCredentialReverseMap,
    SubscriptionCertificateReverseMap,
    SubscriptionBalanceReverseMap
];
