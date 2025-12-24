/**
 * Service Exports
 */

export { AuditTrailService, AuditEvent, AuditEventType, AuditQueryOptions } from './AuditTrailService.js';
export { VCPropagationService, PropagationStatus, PropagationRecord } from './VCPropagationService.js';

// HandshakeService
export {
    HandshakeService,
    handshakeService,
    type CreateProfileResponseParams,
    type CreateConnectionAckParams
} from './HandshakeService.js';
