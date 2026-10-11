/**
 * Phase 0 & Phase 5 Security Rules Verification Suite
 * Verifies all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface SecurityPayloadTest {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  blockingGate: string;
}

export const dirtyDozenTests: SecurityPayloadTest[] = [
  {
    id: 1,
    name: 'Unverified Email Spoof on Admin Endpoint',
    collection: 'companies',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'isVerified() requires request.auth.token.email_verified == true'
  },
  {
    id: 2,
    name: 'Unauthenticated Company Creation',
    collection: 'companies',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'isVerified() blocks unauthenticated requests'
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Artifact Create',
    collection: 'artifacts',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'isValidArtifact() enforces data.keys().hasOnly([...])'
  },
  {
    id: 4,
    name: 'PII Harvesting on Users Collection by Non-Owner',
    collection: 'users',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'allow get restricts access strictly to request.auth.uid == userId || isAdmin()'
  },
  {
    id: 5,
    name: 'Privilege Escalation via Self-Role Update',
    collection: 'users',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'allow update enforces incoming().role == existing().role and affectedKeys().hasOnly([displayName, updatedAt])'
  },
  {
    id: 6,
    name: 'Approve Acceptance Criteria with Failed Validation',
    collection: 'artifacts',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'isValidArtifact() enforces (data.type != acceptance_criteria || data.status != approved || data.validationStatus == passed)'
  },
  {
    id: 7,
    name: 'ID Poisoning via Special Characters or 500-char ID',
    collection: 'artifacts',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'isValidId() enforces size <= 128 and regex ^[a-zA-Z0-9_\\-]+$'
  },
  {
    id: 8,
    name: 'Denial of Wallet String Overflow (50KB description)',
    collection: 'artifacts',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'isValidArtifact() enforces data.description.size() <= 5000'
  },
  {
    id: 9,
    name: 'Unbounded Array Injection on sourceRefs (25 items)',
    collection: 'artifacts',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'isBoundedStringList() enforces arr.size() <= 10'
  },
  {
    id: 10,
    name: 'Author Spoofing on Create (authorId != request.auth.uid)',
    collection: 'artifacts',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'isValidArtifact() enforces data.authorId == request.auth.uid'
  },
  {
    id: 11,
    name: 'Immortal Field Mutation on Project Update (changing ownerId or createdAt)',
    collection: 'projects',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'allow update enforces incoming().ownerId == existing().ownerId and incoming().createdAt == existing().createdAt'
  },
  {
    id: 12,
    name: 'Audit Log Tampering (update or delete)',
    collection: 'auditLogs',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
    blockingGate: 'allow update, delete: if false'
  }
];
