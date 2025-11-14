/**
 * Recipe Exports
 *
 * Export all trust.core recipes for registration with ONE.core
 */

// TrustRelationship
export {
    TrustRelationship,
    TrustStatus,
    TrustLevel,
    TrustRelationshipRecipe,
    TrustRelationshipReverseMap
} from './TrustRelationship.js';

// GroupAttestation
export {
    GroupAttestation,
    GroupAttestationRecipe,
    GroupAttestationReverseMap
} from './GroupAttestation.js';

// CertificateRegistry
export {
    CertificateRegistry,
    CertificateRegistryRecipe,
    CertificateRegistryReverseMap
} from './CertificateRegistry.js';

// Certificate (Base)
export {
    Certificate,
    CertificateType,
    CertificateStatus,
    CertificateRecipe,
    CertificateReverseMap
} from './Certificate.js';

// TrustKeysCertificate - REMOVED: Use ONE.models' version instead
// ONE.models has TrustKeysCertificate with auto-registration via registerLicense()
// Re-exporting types only for convenience, recipe comes from ONE.models
export type { TrustKeysCertificate } from './TrustKeysCertificate.js';

// VerifiableCredential
export {
    VerifiableCredential,
    VerifiableCredentialRecipe,
    VerifiableCredentialReverseMap
} from './VerifiableCredential.js';

// SubscriptionCertificate
export {
    SubscriptionCertificate,
    SubscriptionTier,
    SubscriptionStatus,
    SubscriptionCertificateRecipe,
    SubscriptionCertificateReverseMap
} from './SubscriptionCertificate.js';

// SubscriptionBalance
export {
    SubscriptionBalance,
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
