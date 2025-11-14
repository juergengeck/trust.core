# Certificate Versioning Strategy

**Time-bound certificates managed via ONE.core versioning**

Version: 1.0.0
Last Updated: 2025-01-09

---

## Table of Contents

1. [Overview](#overview)
2. [ONE.core Versioning Fundamentals](#onecore-versioning-fundamentals)
3. [Certificate Lifecycle](#certificate-lifecycle)
4. [Time Extensions](#time-extensions)
5. [Time Reductions](#time-reductions)
6. [Revocation via Versioning](#revocation-via-versioning)
7. [Version Queries](#version-queries)
8. [Propagation Mechanisms](#propagation-mechanisms)
9. [Implementation Patterns](#implementation-patterns)

---

## Overview

### Why ONE.core Versioning?

Traditional certificate revocation requires:
- Separate CRL (Certificate Revocation List) infrastructure
- OCSP (Online Certificate Status Protocol) servers
- Complex distribution mechanisms

ONE.core versioning provides a simpler, more elegant solution:
- **Same certificate ID** across all versions
- **Atomic updates** via ONE.core version transitions
- **Complete audit trail** (all versions preserved)
- **Distributed sync** via CHUM (automatic propagation)
- **No special revocation infrastructure** needed

###Propagation Modes

Certificate versions can propagate via **two mechanisms**:

1. **ONE.core Native Sync** (CHUM protocol)
   - Automatic sync between connected instances
   - Versioned objects sync via channels
   - Efficient, built-in mechanism

2. **External Documents** (Portable VCs)
   - Export certificate as W3C Verifiable Credential
   - Share as JSON-LD file (email, QR code, USB, etc.)
   - Import into any ONE instance
   - Useful for offline scenarios or external systems

**Both mechanisms work together** - you can use ONE.core sync for online instances and external documents for offline/external sharing.

---

## ONE.core Versioning Fundamentals

### Versioned Objects

```typescript
// Version 1
Certificate {
  id: 'cert-abc123'    // Same ID across versions
  $version$: 1
  validFrom: '2025-01-09'
  validUntil: '2026-01-09'
}

// Version 2 (extension)
Certificate {
  id: 'cert-abc123'    // Same ID
  $version$: 2
  validFrom: '2025-01-09'
  validUntil: '2026-07-09'  // Extended 6 months
}

// Version 3 (revocation)
Certificate {
  id: 'cert-abc123'    // Same ID
  $version$: 3
  validFrom: '2025-01-09'
  validUntil: '2025-01-08'  // In the past = revoked
  revoked: true
  revocationReason: 'Key compromised'
}
```

### Version Properties

- **Immutable**: Once stored, a version cannot be changed
- **Append-only**: New versions added, old ones preserved
- **Content-addressed**: Each version has unique SHA256 hash
- **Queryable**: Can fetch latest or specific version
- **Complete history**: All versions available for audit

---

## Certificate Lifecycle

### State Diagram

```
        [Issue]
           ↓
     ┌─────────────┐
     │  Version 1  │  Initial issuance
     │  (Active)   │  validUntil: T+12mo
     └─────────────┘
           ↓
      [Extend]
           ↓
     ┌─────────────┐
     │  Version 2  │  Time extension
     │  (Active)   │  validUntil: T+18mo
     └─────────────┘
           ↓
    [Reduce / Revoke]
           ↓
     ┌─────────────┐
     │  Version 3  │  Revoked
     │ (Revoked)   │  validUntil: T-1day
     └─────────────┘
```

### Version Transitions

```typescript
type VersionTransition =
  | 'issue'        // Create initial version
  | 'extend'       // Increase validUntil
  | 'reduce'       // Decrease validUntil
  | 'revoke'       // Set validUntil to past
  | 'renew'        // Create new version with extended validity

// Transition rules
issue:   null → V1
extend:  V1 → V2 (validUntil increases)
reduce:  V1 → V2 (validUntil decreases but still future)
revoke:  V1 → V2 (validUntil set to past)
renew:   V1 → V2 (new validity period, usually after expiration)
```

---

## Time Extensions

### Extension Use Case

**Scenario**: Alice buys a 12-month identity certificate. After 11 months, she wants to extend for another 6 months.

```typescript
// Version 1 (initial)
const v1 = await ca.issueCertificate({
  subject: alicePersonId,
  certificateType: 'IdentityCertificate',
  validFor: '12 months',  // Until 2026-01-09
  claims: { name: 'Alice Smith', email: 'alice@refinio.net' }
})

// Version 2 (extension after 11 months)
const v2 = await ca.extendCertificate(
  v1.certificateId,
  '6 months'  // Add 6 more months
)

// Result:
// V1: validUntil = 2026-01-09
// V2: validUntil = 2026-07-09 (6 months later)
```

### Extension Implementation

```typescript
async extendCertificate(
  certId: SHA256Hash<TrustKeysCertificate>,
  additionalDuration: Duration
): Promise<CertificateVersion> {
  // 1. Load latest version
  const latestVersion = await this.getLatestVersion(certId)

  // 2. Calculate new validUntil
  const additionalMs = parseDuration(additionalDuration)
  const newValidUntil = new Date(
    latestVersion.certificate.validUntil.getTime() + additionalMs
  )

  // 3. Create new version (increment version number)
  const newVersion: TrustKeysCertificate = {
    ...latestVersion.certificate,
    $version$: latestVersion.version + 1,
    validUntil: newValidUntil,
    // Note: All other fields remain the same
    // Same ID, same subject, same claims
  }

  // 4. Re-sign new version
  const cryptoApi = await this.leuteModel.getCryptoApi()
  const dataToSign = canonicalize({
    ...newVersion,
    proof: undefined
  })
  const signature = await cryptoApi.sign(dataToSign)

  newVersion.proof = {
    signature,
    signer: this.caInstanceId!,
    signedAt: new Date()
  }

  // 5. Store new version
  await storeVersionedObject(newVersion)

  // 6. Propagate via ONE.core sync
  await this.propagateVersion(certId, newVersion.$version$)

  // 7. Export as VC for external propagation
  const vc = await this.exportAsVC(newVersion)
  await this.publishVCForPropagation(vc)

  return {
    certificate: newVersion,
    version: newVersion.$version$,
    previousVersion: latestVersion.version,
    transitionType: 'extend',
    changedAt: new Date()
  }
}
```

### Extension Metadata

```typescript
// Optionally track extension history
interface CertificateExtension {
  fromVersion: number
  toVersion: number
  previousValidUntil: Date
  newValidUntil: Date
  additionalDuration: Duration
  extendedBy: SHA256IdHash<Person>  // Who requested extension
  extendedAt: Date
  price?: number  // If extension has cost (e.g., Refinio CA)
}
```

---

## Time Reductions

### Reduction Use Case

**Scenario**: A certificate was issued for 1 year, but the organization wants to reduce it to 6 months due to policy change.

```typescript
// Version 1 (initial)
validUntil: 2026-01-09  // 12 months

// Version 2 (reduction)
const v2 = await ca.reduceCertificate(
  certId,
  new Date('2025-07-09')  // Reduce to 6 months
)

validUntil: 2025-07-09  // 6 months (still in future)
```

### Reduction Implementation

```typescript
async reduceCertificate(
  certId: SHA256Hash<TrustKeysCertificate>,
  newValidUntil: Date
): Promise<CertificateVersion> {
  // 1. Load latest version
  const latestVersion = await this.getLatestVersion(certId)

  // 2. Validate new validUntil
  const now = new Date()
  if (newValidUntil <= now) {
    throw new Error('Use revokeCertificate() to set validUntil in the past')
  }

  if (newValidUntil >= latestVersion.certificate.validUntil) {
    throw new Error('New validUntil must be earlier (use extendCertificate() to increase)')
  }

  // 3. Create new version
  const newVersion: TrustKeysCertificate = {
    ...latestVersion.certificate,
    $version$: latestVersion.version + 1,
    validUntil: newValidUntil
  }

  // 4. Re-sign and store
  // ... (same as extension)

  // 5. Propagate both ways
  await this.propagateVersion(certId, newVersion.$version$)
  await this.publishVCForPropagation(await this.exportAsVC(newVersion))

  return {
    certificate: newVersion,
    version: newVersion.$version$,
    previousVersion: latestVersion.version,
    transitionType: 'reduce',
    changedAt: new Date()
  }
}
```

---

## Revocation via Versioning

### Revocation Pattern

**No special CRL needed** - just create a version with `validUntil` in the past:

```typescript
// Version 1 (active)
validUntil: 2026-01-09  // Future = valid

// Version 2 (revoked)
validUntil: 2025-01-08  // Past = revoked
revoked: true
revocationReason: 'Key compromised'
```

### Revocation Implementation

```typescript
async revokeCertificate(
  certId: SHA256Hash<TrustKeysCertificate>,
  reason: string
): Promise<CertificateVersion> {
  // 1. Load latest version
  const latestVersion = await this.getLatestVersion(certId)

  // 2. Create revoked version with validUntil in past
  const now = new Date()
  const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)  // Yesterday

  const revokedVersion: TrustKeysCertificate = {
    ...latestVersion.certificate,
    $version$: latestVersion.version + 1,
    validUntil: pastDate,  // Set to past
    revoked: true,
    revocationReason: reason,
    revokedAt: now,
    revokedBy: this.caInstanceId
  }

  // 3. Re-sign and store
  // ... (same as extension)

  // 4. CRITICAL: Propagate revocation urgently
  await this.propagateVersion(certId, revokedVersion.$version$, {
    priority: 'urgent',
    notifyAll: true  // Notify all peers immediately
  })

  // 5. Publish revocation as VC for external systems
  const revocationVC = await this.exportAsVC(revokedVersion)
  await this.publishVCForPropagation(revocationVC, {
    type: 'revocation',
    urgent: true
  })

  // 6. Emit revocation event
  this.onCertificateRevoked.emit({
    certificateId: certId,
    version: revokedVersion.$version$,
    reason,
    revokedAt: now
  })

  return {
    certificate: revokedVersion,
    version: revokedVersion.$version$,
    previousVersion: latestVersion.version,
    transitionType: 'revoke',
    changedAt: now
  }
}
```

### Revocation Verification

```typescript
function isRevoked(cert: TrustKeysCertificate): boolean {
  // Explicit revoked flag
  if (cert.revoked === true) {
    return true
  }

  // Implicit revocation: validUntil in the past
  const now = new Date()
  if (cert.validUntil && cert.validUntil < now) {
    return true
  }

  return false
}

// Check latest version for revocation
async function checkRevocationStatus(
  certId: SHA256Hash<TrustKeysCertificate>
): Promise<RevocationStatus> {
  const latestVersion = await getLatestVersion(certId)

  if (isRevoked(latestVersion.certificate)) {
    return {
      revoked: true,
      reason: latestVersion.certificate.revocationReason,
      revokedAt: latestVersion.certificate.revokedAt,
      version: latestVersion.version
    }
  }

  return {
    revoked: false,
    validUntil: latestVersion.certificate.validUntil
  }
}
```

---

## Version Queries

### Query Latest Version

```typescript
async getLatestVersion(
  certId: SHA256Hash<TrustKeysCertificate>
): Promise<CertificateVersion> {
  // ONE.core automatically returns latest version
  const cert = await loadVersionedObject<TrustKeysCertificate>(certId)

  return {
    certificate: cert,
    version: cert.$version$,
    isLatest: true
  }
}
```

### Query Specific Version

```typescript
async getVersionAt(
  certId: SHA256Hash<TrustKeysCertificate>,
  version: number
): Promise<CertificateVersion | null> {
  // Load specific version
  const cert = await loadVersionedObject<TrustKeysCertificate>(certId, {
    version
  })

  if (!cert) {
    return null
  }

  return {
    certificate: cert,
    version: cert.$version$,
    isLatest: false
  }
}
```

### Query Complete History

```typescript
async getCertificateHistory(
  certId: SHA256Hash<TrustKeysCertificate>
): Promise<CertificateHistory> {
  // Load all versions
  const versions: TrustKeysCertificate[] = []
  let currentVersion = 1

  while (true) {
    const cert = await this.getVersionAt(certId, currentVersion)
    if (!cert) {
      break
    }
    versions.push(cert.certificate)
    currentVersion++
  }

  // Analyze history
  const transitions: VersionTransition[] = []
  for (let i = 1; i < versions.length; i++) {
    const prev = versions[i - 1]
    const curr = versions[i]

    transitions.push({
      fromVersion: prev.$version$,
      toVersion: curr.$version$,
      type: determineTransitionType(prev, curr),
      changedAt: curr.proof.signedAt,
      changes: detectChanges(prev, curr)
    })
  }

  return {
    certificateId: certId,
    versions,
    transitions,
    currentVersion: versions[versions.length - 1],
    isRevoked: isRevoked(versions[versions.length - 1]),
    totalVersions: versions.length
  }
}

function determineTransitionType(
  prev: TrustKeysCertificate,
  curr: TrustKeysCertificate
): 'extend' | 'reduce' | 'revoke' | 'renew' {
  if (curr.revoked || curr.validUntil < new Date()) {
    return 'revoke'
  }

  if (curr.validUntil > prev.validUntil) {
    return 'extend'
  }

  if (curr.validUntil < prev.validUntil && curr.validUntil > new Date()) {
    return 'reduce'
  }

  return 'renew'
}
```

---

## Propagation Mechanisms

### Dual Propagation Strategy

Certificate versions propagate via **two complementary mechanisms**:

```
Certificate Version Created
         ↓
    ┌────┴────┐
    ↓         ↓
ONE.core    External
  Sync      Document
    ↓         ↓
  CHUM     VC File
    ↓         ↓
Connected   Offline/
Instances   External
```

### 1. ONE.core Native Sync (CHUM)

**Automatic synchronization** between connected ONE instances:

```typescript
async propagateViaONECore(
  certId: SHA256Hash<TrustKeysCertificate>,
  version: number
): Promise<void> {
  // 1. Certificate is already stored as versioned object
  // 2. CHUM automatically syncs versioned objects via channels

  // Find channels where this certificate should be shared
  const channels = await this.findRelevantChannels(certId)

  for (const channel of channels) {
    // Post certificate to channel (triggers CHUM sync)
    await channelManager.postToChannel(
      channel.channelId,
      { type: 'certificate_version', certId, version }
    )
  }

  // CHUM handles:
  // - Efficient sync (only new versions)
  // - Conflict resolution (version ordering)
  // - Retry on failure
  // - Peer discovery
}

private async findRelevantChannels(
  certId: SHA256Hash<TrustKeysCertificate>
): Promise<Channel[]> {
  const cert = await loadVersionedObject<TrustKeysCertificate>(certId)

  // Find channels based on certificate type and subject
  const channels: Channel[] = []

  // 1. Subject's personal channel (always share with subject)
  const subjectChannel = await this.getPersonalChannel(cert.subject)
  if (subjectChannel) {
    channels.push(subjectChannel)
  }

  // 2. Group channels if certificate has group scope
  if (cert.claims?.groupId) {
    const groupChannel = await this.getGroupChannel(cert.claims.groupId)
    if (groupChannel) {
      channels.push(groupChannel)
    }
  }

  // 3. Public channel if certificate is public
  if (cert.claims?.visibility === 'public') {
    const publicChannel = await this.getPublicChannel()
    if (publicChannel) {
      channels.push(publicChannel)
    }
  }

  return channels
}
```

**Benefits of ONE.core Sync**:
- Automatic (no manual intervention)
- Efficient (delta sync)
- Reliable (built-in retry)
- Real-time (for connected instances)

**Limitations**:
- Requires active connection
- Only works within ONE network
- Not suitable for external systems

### 2. External Document Propagation (VCs)

**Portable credentials** as W3C Verifiable Credentials:

```typescript
async propagateViaExternalDocument(
  certId: SHA256Hash<TrustKeysCertificate>,
  version: number,
  options?: PropagationOptions
): Promise<ExportedVC> {
  // 1. Load certificate version
  const cert = await this.getVersionAt(certId, version)
  if (!cert) {
    throw new Error('Certificate version not found')
  }

  // 2. Convert to W3C VC
  const vcBridge = new VCBridge()
  const vc = await vcBridge.certificateToVC(cert.certificate)

  // 3. Add propagation metadata
  const exportedVC = {
    ...vc,
    exportedAt: new Date().toISOString(),
    exportedBy: this.caInstanceId,
    exportMethod: options?.method || 'manual',
    propagationId: generateUUID()
  }

  // 4. Serialize as JSON-LD
  const vcDocument = JSON.stringify(exportedVC, null, 2)

  // 5. Store for various distribution methods
  await this.storeForDistribution(vcDocument, {
    qrCode: options?.qrCode,
    email: options?.email,
    download: options?.download,
    webEndpoint: options?.webEndpoint
  })

  return {
    vc: exportedVC,
    document: vcDocument,
    formats: {
      json: vcDocument,
      qrCode: options?.qrCode ? await generateQRCode(vcDocument) : undefined,
      url: options?.webEndpoint
    }
  }
}

async storeForDistribution(
  vcDocument: string,
  methods: DistributionMethods
): Promise<void> {
  // QR Code
  if (methods.qrCode) {
    const qrCode = await generateQRCode(vcDocument)
    await saveQRCode(qrCode, methods.qrCode)
  }

  // Email
  if (methods.email) {
    await sendEmail({
      to: methods.email,
      subject: 'Verifiable Credential',
      attachments: [
        { filename: 'credential.json', content: vcDocument }
      ]
    })
  }

  // Download file
  if (methods.download) {
    await saveFile(methods.download, vcDocument)
  }

  // Web endpoint
  if (methods.webEndpoint) {
    await publishToWeb(methods.webEndpoint, vcDocument)
  }
}
```

**Distribution Methods**:

1. **QR Code**
   ```typescript
   const exported = await ca.propagateViaExternalDocument(certId, version, {
     qrCode: true
   })
   // Display QR code for scanning
   displayQRCode(exported.formats.qrCode)
   ```

2. **Email Attachment**
   ```typescript
   await ca.propagateViaExternalDocument(certId, version, {
     email: 'alice@example.com'
   })
   ```

3. **File Download**
   ```typescript
   await ca.propagateViaExternalDocument(certId, version, {
     download: '/path/to/credential.json'
   })
   ```

4. **Web Endpoint**
   ```typescript
   await ca.propagateViaExternalDocument(certId, version, {
     webEndpoint: 'https://refinio.net/credentials/cert-abc123-v2.json'
   })
   ```

5. **USB/Physical Media**
   ```typescript
   const exported = await ca.propagateViaExternalDocument(certId, version, {
     download: '/media/usb/credential.json'
   })
   ```

**Benefits of External Documents**:
- Works offline
- Compatible with external systems
- Portable (can be shared via any medium)
- Human-readable (JSON-LD)
- W3C standard compliance

**Limitations**:
- Manual distribution required
- No automatic updates
- Recipient must manually import

### Import from External Document

```typescript
async importExternalVC(
  vcDocument: string | VerifiableCredential
): Promise<ImportResult> {
  // 1. Parse VC
  const vc = typeof vcDocument === 'string'
    ? JSON.parse(vcDocument)
    : vcDocument

  // 2. Convert VC to certificate
  const vcBridge = new VCBridge()
  const cert = await vcBridge.vcToCertificate(vc)

  // 3. Verify certificate
  const isValid = await this.verifyCertificate(cert)
  if (!isValid) {
    throw new Error('Invalid certificate in VC')
  }

  // 4. Check if we already have this certificate
  const certId = await hashObject(cert)
  const existing = await this.getLatestVersion(certId)

  if (existing && existing.version >= cert.$version$) {
    return {
      imported: false,
      reason: 'Already have newer or same version',
      existingVersion: existing.version,
      importedVersion: cert.$version$
    }
  }

  // 5. Store certificate
  await storeVersionedObject(cert)

  // 6. Propagate to our network (re-share via ONE.core)
  await this.propagateViaONECore(certId, cert.$version$)

  return {
    imported: true,
    certificateId: certId,
    version: cert.$version$,
    previousVersion: existing?.version
  }
}
```

### Hybrid Propagation Strategy

**Best practice**: Use both mechanisms for maximum reach:

```typescript
async propagateCertificateVersion(
  certId: SHA256Hash<TrustKeysCertificate>,
  version: number
): Promise<void> {
  // 1. Propagate via ONE.core (automatic)
  await this.propagateViaONECore(certId, version)

  // 2. Also export as VC for external/offline distribution
  const exported = await this.propagateViaExternalDocument(certId, version, {
    webEndpoint: `https://ca.example.com/certificates/${certId}/v${version}.json`
  })

  console.log('[Propagation] Certificate propagated:')
  console.log('  - ONE.core channels: automatic sync')
  console.log('  - External VC:', exported.formats.url)
}
```

---

## Implementation Patterns

### Version Transition Template

```typescript
async transitionCertificateVersion(
  certId: SHA256Hash<TrustKeysCertificate>,
  transitionType: 'extend' | 'reduce' | 'revoke',
  params: TransitionParams
): Promise<CertificateVersion> {
  // 1. Load latest version
  const latestVersion = await this.getLatestVersion(certId)

  // 2. Validate transition
  this.validateTransition(latestVersion.certificate, transitionType, params)

  // 3. Create new version
  const newVersion = this.createNewVersion(
    latestVersion.certificate,
    transitionType,
    params
  )

  // 4. Sign new version
  const signedVersion = await this.signCertificate(newVersion)

  // 5. Store new version
  await storeVersionedObject(signedVersion)

  // 6. Propagate (dual strategy)
  await Promise.all([
    this.propagateViaONECore(certId, signedVersion.$version$),
    this.propagateViaExternalDocument(certId, signedVersion.$version$)
  ])

  // 7. Return result
  return {
    certificate: signedVersion,
    version: signedVersion.$version$,
    previousVersion: latestVersion.version,
    transitionType,
    changedAt: new Date()
  }
}
```

### Audit Trail Pattern

```typescript
// Every version transition is automatically auditable
async auditCertificateLifecycle(
  certId: SHA256Hash<TrustKeysCertificate>
): Promise<AuditTrail> {
  const history = await this.getCertificateHistory(certId)

  const auditEntries = history.transitions.map(t => ({
    version: t.toVersion,
    type: t.type,
    timestamp: t.changedAt,
    changes: t.changes,
    issuer: history.versions[t.toVersion - 1].issuer,
    signature: history.versions[t.toVersion - 1].proof.signature
  }))

  return {
    certificateId: certId,
    totalTransitions: auditEntries.length,
    entries: auditEntries,
    currentStatus: history.isRevoked ? 'revoked' : 'active'
  }
}
```

---

## Security Considerations

1. **Version Integrity**: Each version is immutable and cryptographically signed
2. **Propagation Security**:
   - ONE.core sync uses encrypted channels
   - External VCs include cryptographic proofs
3. **Revocation Urgency**: Revocations propagated with high priority
4. **Version Ordering**: ONE.core enforces version sequence
5. **Audit Trail**: Complete version history preserved (cannot be hidden)

---

## Testing Strategy

### Version Lifecycle Tests

```typescript
describe('Certificate Versioning', () => {
  it('should extend certificate validity', async () => {
    const v1 = await ca.issueCertificate({...})
    const v2 = await ca.extendCertificate(v1.certificateId, '6 months')

    expect(v2.version).toBe(2)
    expect(v2.certificate.validUntil).toBeGreaterThan(v1.certificate.validUntil)
  })

  it('should revoke certificate via version', async () => {
    const v1 = await ca.issueCertificate({...})
    const v2 = await ca.revokeCertificate(v1.certificateId, 'Test revocation')

    expect(v2.certificate.revoked).toBe(true)
    expect(v2.certificate.validUntil).toBeLessThan(new Date())
  })

  it('should maintain complete audit trail', async () => {
    const v1 = await ca.issueCertificate({...})
    await ca.extendCertificate(v1.certificateId, '6 months')
    await ca.revokeCertificate(v1.certificateId, 'Test')

    const history = await ca.getCertificateHistory(v1.certificateId)
    expect(history.totalVersions).toBe(3)
    expect(history.transitions).toHaveLength(2)
  })
})
```

### Propagation Tests

```typescript
describe('Version Propagation', () => {
  it('should propagate via ONE.core sync', async () => {
    const v1 = await ca1.issueCertificate({...})
    await ca1.propagateViaONECore(v1.certificateId, 1)

    // Wait for sync
    await waitForSync()

    // Check other instance received it
    const received = await ca2.getLatestVersion(v1.certificateId)
    expect(received.version).toBe(1)
  })

  it('should export and import as VC', async () => {
    const v1 = await ca1.issueCertificate({...})
    const exported = await ca1.propagateViaExternalDocument(v1.certificateId, 1)

    // Import on different instance
    const imported = await ca2.importExternalVC(exported.document)

    expect(imported.imported).toBe(true)
    expect(imported.version).toBe(1)
  })
})
```

---

**Status**: Design complete, ready for implementation
**Dependencies**: ONE.core versioning, CHUM, VCBridge
**Next**: Implement version management methods in CAModel
