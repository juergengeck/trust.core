# Platform Integration Guide

**How to integrate trust.core into LAMA platforms**

Version: 1.0.0
Last Updated: 2025-01-09

---

## Table of Contents

1. [Overview](#overview)
2. [Integration Patterns](#integration-patterns)
3. [Platform-Specific Guides](#platform-specific-guides)
   - [lama.cube (Electron)](#lamacube-electron)
   - [lama.browser (Web)](#lamabrowser-web)
   - [lama (React Native)](#lama-react-native)
4. [Common Integration Tasks](#common-integration-tasks)
5. [Testing Integration](#testing-integration)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture

Trust.core is **platform-agnostic** - it contains only business logic with dependency injection:

```
┌─────────────────────────────────────────────────────┐
│ Platform (lama.cube, lama.browser, lama)           │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Platform Layer (Electron/Web/RN)            │   │
│ │ - IPC handlers / Web Workers / Native       │   │
│ │ - Platform-specific ONE.core instances      │   │
│ └──────────────────┬──────────────────────────┘   │
│                    │ Dependency Injection          │
│ ┌──────────────────▼──────────────────────────┐   │
│ │ trust.core (Platform-Agnostic)              │   │
│ │ - TrustModel, CAModel, VCBridge             │   │
│ │ - No platform imports                       │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Key Principles

1. **Dependency Injection**: Platforms provide ONE.core instances at runtime
2. **Plans for RPC**: Use TrustPlan/CAPlan for cross-process communication
3. **Shared Instance**: Ensure single instance of ONE.core across app
4. **Event-Driven**: Use OEvent for reactive updates

---

## Integration Patterns

### Pattern 1: Direct Model Usage (Simple)

Use TrustModel directly in same process:

```typescript
// Platform code
import { TrustModel } from '@trust/core/models/TrustModel.js'
import { leuteModel, trustedKeysManager } from './one-core-setup.js'

// Create instance
const trustModel = new TrustModel(leuteModel, trustedKeysManager)
await trustModel.init()

// Use directly
await trustModel.setTrustStatus(peerId, publicKey, 'trusted')
```

**Best for**: Single-process apps (lama browser, simple scenarios)

---

### Pattern 2: Plan-Based RPC (Electron/Multi-Process)

Use TrustPlan for cross-process communication:

```typescript
// Main process
import { TrustPlan } from '@trust/core/plans/TrustPlan.js'

const trustModel = new TrustModel(leuteModel, trustedKeysManager)
await trustModel.init()

const trustPlan = new TrustPlan(trustModel)

ipcMain.handle('trust:setStatus', trustPlan.setTrustStatus)
ipcMain.handle('trust:getStatus', trustPlan.getTrustStatus)

// Renderer process
const result = await ipcRenderer.invoke('trust:setStatus', {
  deviceId: peerId,
  publicKey,
  status: 'trusted'
})
```

**Best for**: Multi-process apps (lama.cube, lama.browser with workers)

---

### Pattern 3: Service Layer (Advanced)

Wrap in application-specific service:

```typescript
// services/TrustService.ts
export class TrustService {
  private trustModel: TrustModel
  private caModel: CAModel

  constructor(leuteModel: LeuteModel, trustedKeysManager: TrustedKeysManager) {
    this.trustModel = new TrustModel(leuteModel, trustedKeysManager)
    this.caModel = new CAModel(leuteModel, trustedKeysManager)
  }

  async init() {
    await this.trustModel.init()
    await this.caModel.init()
  }

  // Application-specific methods
  async trustPeerAfterPairing(peerId, publicKey) {
    await this.trustModel.setTrustStatus(peerId, publicKey, 'trusted', {
      reason: 'Device pairing',
      context: 'pairing'
    })
  }

  async issueIdentityCertificate(personId, claims) {
    return await this.caModel.issueCertificate({
      subject: personId,
      certificateType: 'IdentityCertificate',
      validFor: '12 months',
      claims
    })
  }
}
```

**Best for**: Complex apps with custom business logic

---

## Platform-Specific Guides

### lama.cube (Electron)

#### Project Structure

```
lama.cube/
├── main/
│   ├── models/
│   │   └── AppModel.ts           # Main process model
│   ├── ipc/
│   │   └── plans/
│   │       ├── trust.ts          # Trust plan handlers
│   │       └── ca.ts             # CA plan handlers
│   └── one-core-setup.ts         # ONE.core initialization
├── renderer/
│   ├── hooks/
│   │   ├── useTrust.ts           # React hook for trust
│   │   └── useCA.ts              # React hook for CA
│   └── ipc.ts                    # IPC type-safe wrappers
└── package.json
```

#### Step 1: Install Dependencies

```json
{
  "dependencies": {
    "@trust/core": "file:../../trust.core",
    "@refinio/one.core": "file:../../packages/one.core",
    "@refinio/one.models": "file:../../packages/one.models"
  }
}
```

#### Step 2: Initialize in Main Process

```typescript
// main/one-core-setup.ts
import { init as initOneCore } from '@refinio/one.core'
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js'
import TrustedKeysManager from '@refinio/one.models/lib/models/Leute/TrustedKeysManager.js'

let leuteModel: LeuteModel
let trustedKeysManager: TrustedKeysManager

export async function initializeONECore() {
  // Initialize ONE.core
  await initOneCore({
    directory: app.getPath('userData') + '/one-core',
    encryptionKey: getEncryptionKey()
  })

  // Initialize models
  leuteModel = new LeuteModel()
  await leuteModel.init()

  trustedKeysManager = new TrustedKeysManager()
  await trustedKeysManager.init()

  return { leuteModel, trustedKeysManager }
}

export { leuteModel, trustedKeysManager }
```

#### Step 3: Create IPC Handlers

```typescript
// main/ipc/plans/trust.ts
import { ipcMain } from 'electron'
import { TrustModel } from '@trust/core/models/TrustModel.js'
import { TrustPlan } from '@trust/core/plans/TrustPlan.js'
import { leuteModel, trustedKeysManager } from '../../one-core-setup.js'

let trustModel: TrustModel
let trustPlan: TrustPlan

export async function setupTrustIPC() {
  // Initialize TrustModel
  trustModel = new TrustModel(leuteModel, trustedKeysManager)
  await trustModel.init()

  // Create plan
  trustPlan = new TrustPlan(trustModel)

  // Register IPC handlers
  ipcMain.handle('trust:setStatus', trustPlan.setTrustStatus)
  ipcMain.handle('trust:getStatus', trustPlan.getTrustStatus)
  ipcMain.handle('trust:getTrustedDevices', trustPlan.getTrustedDevices)
  ipcMain.handle('trust:verifyKey', trustPlan.verifyDeviceKey)
  ipcMain.handle('trust:evaluate', trustPlan.evaluateTrust)

  // Listen to events and forward to renderer
  trustModel.onTrustChanged.listen((deviceId, status) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('trust:changed', { deviceId, status })
    })
  })
}

export { trustModel }
```

```typescript
// main/ipc/plans/ca.ts
import { ipcMain } from 'electron'
import { CAModel } from '@trust/core/models/CAModel.js'
import { CAPlan } from '@trust/core/plans/CAPlan.js'
import { leuteModel, trustedKeysManager } from '../../one-core-setup.js'

let caModel: CAModel
let caPlan: CAPlan

export async function setupCAIPC() {
  caModel = new CAModel(leuteModel, trustedKeysManager)
  await caModel.init()

  caPlan = new CAPlan(caModel)

  ipcMain.handle('ca:createRoot', caPlan.createRoot)
  ipcMain.handle('ca:issueCertificate', caPlan.issueCertificate)
  ipcMain.handle('ca:extendCertificate', caPlan.extendCertificate)
  ipcMain.handle('ca:revokeCertificate', caPlan.revokeCertificate)
  ipcMain.handle('ca:getHistory', caPlan.getHistory)

  caModel.onCertificateIssued.listen(cert => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('ca:certificateIssued', cert)
    })
  })
}

export { caModel }
```

#### Step 4: Type-Safe IPC Wrapper (Renderer)

```typescript
// renderer/ipc.ts
import { ipcRenderer } from 'electron'
import type { SetTrustStatusRequest, SetTrustStatusResponse } from '@trust/core/plans/TrustPlan.js'
import type { IssueCertificateRequest, IssueCertificateResponse } from '@trust/core/plans/CAPlan.js'

export const trustIPC = {
  async setTrustStatus(request: SetTrustStatusRequest): Promise<SetTrustStatusResponse> {
    return await ipcRenderer.invoke('trust:setStatus', request)
  },

  async getTrustStatus(deviceId: string) {
    return await ipcRenderer.invoke('trust:getStatus', { deviceId })
  },

  async getTrustedDevices() {
    return await ipcRenderer.invoke('trust:getTrustedDevices')
  },

  onTrustChanged(callback: (data: any) => void) {
    ipcRenderer.on('trust:changed', (_, data) => callback(data))
  }
}

export const caIPC = {
  async issueCertificate(request: IssueCertificateRequest): Promise<IssueCertificateResponse> {
    return await ipcRenderer.invoke('ca:issueCertificate', request)
  },

  async extendCertificate(certId: string, duration: string) {
    return await ipcRenderer.invoke('ca:extendCertificate', { certId, duration })
  },

  onCertificateIssued(callback: (cert: any) => void) {
    ipcRenderer.on('ca:certificateIssued', (_, cert) => callback(cert))
  }
}
```

#### Step 5: React Hooks (Renderer)

```typescript
// renderer/hooks/useTrust.ts
import { useState, useEffect } from 'react'
import { trustIPC } from '../ipc.js'

export function useTrust(deviceId?: string) {
  const [trustStatus, setTrustStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (deviceId) {
      loadTrustStatus()
    }

    const unsubscribe = trustIPC.onTrustChanged(({ deviceId: changedId, status }) => {
      if (changedId === deviceId) {
        setTrustStatus(status)
      }
    })

    return unsubscribe
  }, [deviceId])

  async function loadTrustStatus() {
    setLoading(true)
    const result = await trustIPC.getTrustStatus(deviceId)
    setTrustStatus(result.data)
    setLoading(false)
  }

  async function trustDevice(publicKey: string) {
    await trustIPC.setTrustStatus({
      deviceId,
      publicKey,
      status: 'trusted'
    })
  }

  return { trustStatus, loading, trustDevice }
}
```

#### Step 6: Usage in Components

```typescript
// renderer/components/DeviceTrustButton.tsx
import React from 'react'
import { useTrust } from '../hooks/useTrust'

export function DeviceTrustButton({ deviceId, publicKey }) {
  const { trustStatus, trustDevice } = useTrust(deviceId)

  return (
    <button
      onClick={() => trustDevice(publicKey)}
      disabled={trustStatus === 'trusted'}
    >
      {trustStatus === 'trusted' ? 'Trusted' : 'Trust Device'}
    </button>
  )
}
```

---

### lama.browser (Web)

#### Architecture

```
Main Thread (UI)
     ↓
  Web Worker (trust.core runs here)
     ↓
  IndexedDB (ONE.core storage)
```

#### Step 1: Setup Web Worker

```typescript
// workers/trust-worker.ts
import { TrustModel } from '@trust/core/models/TrustModel.js'
import { CAModel } from '@trust/core/models/CAModel.js'
import { init as initOneCore } from '@refinio/one.core/browser'

let trustModel: TrustModel
let caModel: CAModel

async function initialize() {
  // Initialize ONE.core in worker
  await initOneCore({
    storage: 'indexeddb',
    dbName: 'lama-one-core'
  })

  // Initialize models
  const leuteModel = new LeuteModel()
  await leuteModel.init()

  trustModel = new TrustModel(leuteModel)
  await trustModel.init()

  caModel = new CAModel(leuteModel)
  await caModel.init()

  // Listen to events and post to main thread
  trustModel.onTrustChanged.listen((deviceId, status) => {
    self.postMessage({
      type: 'trust:changed',
      data: { deviceId, status }
    })
  })

  self.postMessage({ type: 'initialized' })
}

// Handle messages from main thread
self.onmessage = async (e) => {
  const { type, id, data } = e.data

  try {
    let result

    switch (type) {
      case 'trust:setStatus':
        await trustModel.setTrustStatus(data.deviceId, data.publicKey, data.status, data.options)
        result = { success: true }
        break

      case 'trust:getStatus':
        const status = await trustModel.getTrustStatus(data.deviceId)
        result = { success: true, data: status }
        break

      case 'ca:issueCertificate':
        const cert = await caModel.issueCertificate(data)
        result = { success: true, data: cert }
        break

      default:
        result = { success: false, error: 'Unknown message type' }
    }

    self.postMessage({ type: 'response', id, result })

  } catch (error) {
    self.postMessage({
      type: 'response',
      id,
      result: { success: false, error: error.message }
    })
  }
}

initialize()
```

#### Step 2: Main Thread Wrapper

```typescript
// services/TrustWorkerClient.ts
export class TrustWorkerClient {
  private worker: Worker
  private messageId = 0
  private pending = new Map<number, { resolve: Function, reject: Function }>()

  constructor() {
    this.worker = new Worker(new URL('../workers/trust-worker.ts', import.meta.url))

    this.worker.onmessage = (e) => {
      const { type, id, result, data } = e.data

      if (type === 'response') {
        const pending = this.pending.get(id)
        if (pending) {
          if (result.success) {
            pending.resolve(result.data)
          } else {
            pending.reject(new Error(result.error))
          }
          this.pending.delete(id)
        }
      } else if (type === 'trust:changed') {
        // Emit event
        this.onTrustChanged.emit(data)
      }
    }
  }

  private async sendMessage(type: string, data: any): Promise<any> {
    const id = this.messageId++

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ type, id, data })
    })
  }

  async setTrustStatus(deviceId: string, publicKey: string, status: string, options?: any) {
    return await this.sendMessage('trust:setStatus', { deviceId, publicKey, status, options })
  }

  async getTrustStatus(deviceId: string) {
    return await this.sendMessage('trust:getStatus', { deviceId })
  }

  // Event emitter
  private listeners = new Map<string, Function[]>()

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event) || []
    callbacks.forEach(cb => cb(data))
  }

  onTrustChanged = {
    emit: (data: any) => this.emit('trust:changed', data),
    listen: (callback: Function) => this.on('trust:changed', callback)
  }
}
```

#### Step 3: React Hook

```typescript
// hooks/useTrust.ts
import { useState, useEffect } from 'react'
import { trustWorker } from '../services/trustWorker'

export function useTrust(deviceId?: string) {
  const [trustStatus, setTrustStatus] = useState(null)

  useEffect(() => {
    if (deviceId) {
      trustWorker.getTrustStatus(deviceId).then(setTrustStatus)
    }

    const unsubscribe = trustWorker.onTrustChanged.listen(({ deviceId: changedId, status }) => {
      if (changedId === deviceId) {
        setTrustStatus(status)
      }
    })

    return unsubscribe
  }, [deviceId])

  async function trustDevice(publicKey: string) {
    await trustWorker.setTrustStatus(deviceId, publicKey, 'trusted')
  }

  return { trustStatus, trustDevice }
}
```

---

### lama (React Native)

#### Step 1: Initialize in AppModel

```typescript
// src/models/AppModel.ts
import { TrustModel } from '@trust/core/models/TrustModel.js'
import { CAModel } from '@trust/core/models/CAModel.js'

export class AppModel {
  public trustModel: TrustModel
  public caModel: CAModel

  async init() {
    // Initialize ONE.core
    await initOneCore()

    // Initialize Leute
    this.leuteModel = new LeuteModel()
    await this.leuteModel.init()

    this.trustedKeysManager = new TrustedKeysManager()
    await this.trustedKeysManager.init()

    // Initialize trust.core
    this.trustModel = new TrustModel(this.leuteModel, this.trustedKeysManager)
    await this.trustModel.init()

    this.caModel = new CAModel(this.leuteModel, this.trustedKeysManager)
    await this.caModel.init()
  }
}

// Singleton
export const appModel = new AppModel()
```

#### Step 2: React Hook

```typescript
// hooks/useTrust.ts
import { useState, useEffect } from 'react'
import { appModel } from '../models/AppModel'

export function useTrust(deviceId?: string) {
  const [trustStatus, setTrustStatus] = useState(null)

  useEffect(() => {
    if (deviceId) {
      appModel.trustModel.getTrustStatus(deviceId).then(setTrustStatus)
    }

    const listener = appModel.trustModel.onTrustChanged.listen((changedId, status) => {
      if (changedId === deviceId) {
        setTrustStatus(status)
      }
    })

    return () => listener.remove()
  }, [deviceId])

  async function trustDevice(publicKey: string) {
    await appModel.trustModel.setTrustStatus(deviceId, publicKey, 'trusted')
  }

  return { trustStatus, trustDevice }
}
```

#### Step 3: Usage in Component

```typescript
// screens/ContactProfile.tsx
import React from 'react'
import { View, Button } from 'react-native'
import { useTrust } from '../hooks/useTrust'

export function ContactProfile({ contact }) {
  const { trustStatus, trustDevice } = useTrust(contact.personId)

  return (
    <View>
      <Button
        title={trustStatus === 'trusted' ? 'Trusted' : 'Trust Contact'}
        onPress={() => trustDevice(contact.publicKey)}
      />
    </View>
  )
}
```

---

## Common Integration Tasks

### Task 1: Device Pairing Flow

```typescript
// After QR code scan or NFC pairing
async function completePairing(peerId: string, publicKey: string) {
  // 1. Set trust
  await trustModel.setTrustStatus(peerId, publicKey, 'trusted', {
    reason: 'QR code pairing',
    context: 'device_pairing',
    verificationMethod: 'qr-code',
    trustLevel: 'full'
  })

  // 2. Optionally issue certificate
  await caModel.issueCertificate({
    subject: peerId,
    certificateType: 'DeviceCertificate',
    validFor: '90 days',
    claims: {
      deviceType: 'smartphone',
      pairedAt: new Date().toISOString()
    }
  })

  // 3. UI feedback
  showNotification('Device paired successfully!')
}
```

### Task 2: Certificate Purchase Flow

```typescript
// Refinio CA selling identity certificates
async function purchaseIdentityCertificate(userDetails) {
  // 1. Verify identity (could require ID upload, video call, etc.)
  const verified = await verifyIdentity(userDetails)

  if (!verified) {
    throw new Error('Identity verification failed')
  }

  // 2. Issue certificate
  const cert = await caModel.issueCertificate({
    subject: userDetails.personId,
    certificateType: 'IdentityCertificate',
    validFor: '12 months',
    claims: {
      name: userDetails.name,
      email: userDetails.email,
      verificationLevel: 'government_id',
      verifiedAt: new Date().toISOString()
    }
  })

  // 3. Export as VC for user
  const vc = await caModel.propagateViaExternalDocument(cert.certificateId, 1, {
    download: true,
    qrCode: true
  })

  // 4. Show download/QR
  showCertificateDownload(vc)

  return cert
}
```

### Task 3: Trust Evaluation Before File Transfer

```typescript
async function canTransferFile(recipientId: string) {
  // Evaluate trust
  const evaluation = await trustModel.evaluateTrust(recipientId, 'file-transfer')

  if (evaluation.level < 0.8) {
    // Insufficient trust
    showDialog({
      title: 'Trust Required',
      message: `Trust level too low (${evaluation.level.toFixed(2)}). ${evaluation.reason}`,
      actions: [
        { label: 'Cancel', action: 'cancel' },
        { label: 'Upgrade Trust', action: () => showTrustUpgradeFlow(recipientId) }
      ]
    })
    return false
  }

  return true
}
```

---

## Testing Integration

### Unit Tests

```typescript
// tests/trust-integration.test.ts
import { TrustModel } from '@trust/core/models/TrustModel.js'
import { mockLeuteModel, mockTrustedKeysManager } from './mocks'

describe('Trust Integration', () => {
  let trustModel: TrustModel

  beforeEach(async () => {
    trustModel = new TrustModel(mockLeuteModel, mockTrustedKeysManager)
    await trustModel.init()
  })

  it('should set and get trust status', async () => {
    await trustModel.setTrustStatus('peer-123', 'pubkey', 'trusted')
    const status = await trustModel.getTrustStatus('peer-123')

    expect(status.status).toBe('trusted')
  })

  it('should emit trust changed event', async () => {
    const handler = jest.fn()
    trustModel.onTrustChanged.listen(handler)

    await trustModel.setTrustStatus('peer-123', 'pubkey', 'trusted')

    expect(handler).toHaveBeenCalledWith('peer-123', 'trusted')
  })
})
```

### Integration Tests

```typescript
// tests/e2e/pairing.test.ts
describe('Device Pairing E2E', () => {
  it('should complete pairing flow', async () => {
    // Scan QR code (mocked)
    const peerData = await scanQRCode()

    // Complete pairing
    await completePairing(peerData.personId, peerData.publicKey)

    // Verify trust established
    const trust = await trustModel.getTrustStatus(peerData.personId)
    expect(trust.status).toBe('trusted')

    // Verify certificate issued
    const cert = await caModel.getLatestVersion(peerData.personId)
    expect(cert).toBeDefined()
  })
})
```

---

## Troubleshooting

### Issue: "Model not initialized"

**Cause**: Calling methods before `init()` completes

**Solution**:
```typescript
await trustModel.init()  // Ensure this completes
await trustModel.setTrustStatus(...)  // Then call methods
```

---

### Issue: "Multiple ONE.core instances"

**Cause**: Different parts of app creating separate ONE.core instances

**Solution**: Use singleton pattern
```typescript
// one-core-setup.ts
let _instance: any = null

export async function getONECore() {
  if (!_instance) {
    _instance = await initOneCore(...)
  }
  return _instance
}
```

---

### Issue: "IPC handler not responding"

**Cause**: Handler not registered or wrong channel name

**Solution**: Check registration
```typescript
// Main process - ensure handlers registered
ipcMain.handle('trust:setStatus', trustPlan.setTrustStatus)

// Renderer - match channel name exactly
await ipcRenderer.invoke('trust:setStatus', ...)
```

---

### Issue: "Trust events not firing"

**Cause**: Event listener registered after event emitted

**Solution**: Register listeners before operations
```typescript
// Register listener first
trustModel.onTrustChanged.listen(handler)

// Then perform operation
await trustModel.setTrustStatus(...)
```

---

**Status**: Complete integration guide
**Platforms Covered**: lama.cube, lama.browser, lama
**Next**: Implementation of trust.core models
