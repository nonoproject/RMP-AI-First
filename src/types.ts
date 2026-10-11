export type Language = 'en' | 'ar';

export type NavSection =
  | 'ai_workspace'
  | 'ai_conversation'
  | 'portfolios_projects'
  | 'requirements'
  | 'reviews_approvals'
  | 'knowledge_memory'
  | 'living_documents'
  | 'change_impact'
  | 'integrations'
  | 'company_settings';

export type AiOperatingMode = 'assistant' | 'workflow' | 'multi_agent';

export type UserRole =
  | 'platform_admin'
  | 'company_admin'
  | 'product_manager'
  | 'business_analyst'
  | 'reviewer';

export type ArtifactType =
  | 'business_need'
  | 'requirement'
  | 'business_rule'
  | 'user_story'
  | 'acceptance_criteria'
  | 'test_case'
  | 'architecture_decision'
  | 'api_spec'
  | 'assumption'
  | 'constraint'
  | 'change_request'
  | 'visual_asset';

export type ArtifactStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'revision_requested'
  | 'excluded';

export type ValidationStatus = 'passed' | 'failed' | 'warning';

export type LivingDocType =
  | 'BRD'
  | 'FRD'
  | 'SRS'
  | 'BUSINESS_RULES'
  | 'USER_STORIES'
  | 'ARCH_DECISIONS'
  | 'API_SPECS'
  | 'TEST_PLANS'
  | 'SECURITY_NFR'
  | 'HANDOVER';

export interface Company {
  id: string;
  name: string;
  domain: string;
  defaultAiMode: AiOperatingMode;
  privacyVerified: boolean;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  companyId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Portfolio {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'planning';
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Project {
  id: string;
  companyId: string;
  portfolioId: string;
  parentProjectId: string;
  code: string;
  name: string;
  description: string;
  status: 'active' | 'discovery' | 'delivery' | 'completed';
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Artifact {
  id: string;
  code: string;
  companyId: string;
  portfolioId: string;
  projectId: string;
  type: ArtifactType;
  title: string;
  description: string;
  rationale: string;
  status: ArtifactStatus;
  validationStatus: ValidationStatus;
  validationNotes: string;
  version: number;
  sourceRefs: string[];
  linkedArtifactIds: string[];
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LivingDocument {
  id: string;
  code: string;
  companyId: string;
  projectId: string;
  docType: LivingDocType;
  title: string;
  content: string;
  status: 'draft' | 'approved' | 'needs_sync';
  version: number;
  sourceArtifactIds: string[];
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiTask {
  id: string;
  companyId: string;
  projectId: string;
  intent: string;
  inferredContext: string;
  mode: AiOperatingMode;
  currentStage: number;
  status: 'running' | 'paused' | 'awaiting_clarification' | 'awaiting_approval' | 'completed' | 'failed';
  clarificationQuestions: string;
  planSummary: string;
  generatedArtifactIds: string[];
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  companyId: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt?: unknown;
}

/**
 * Defensive Payload Sanitization & Validation Helpers
 * Synchronized verbatim with firebase-blueprint.json and firestore.rules
 */
export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export function clampString(val: string, maxLength: number, fallback = ''): string {
  const str = (val || fallback).trim();
  return str.slice(0, maxLength);
}

export function clampStringList(arr: string[], maxItems = 10): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, 128));
}

/**
 * Automated Quality Validation Engine
 * Checks completeness, testability (especially for Acceptance Criteria), and traceability.
 */
export function evaluateArtifactQuality(
  type: ArtifactType,
  title: string,
  description: string,
  sourceRefs: string[]
): { validationStatus: ValidationStatus; validationNotes: string } {
  const cleanTitle = title.trim();
  const cleanDesc = description.trim();

  if (cleanTitle.length < 5 || cleanDesc.length < 15) {
    return {
      validationStatus: 'failed',
      validationNotes: 'Failed Completeness Check: Title or description is too brief to be actionable or verifiable.',
    };
  }

  if (type === 'acceptance_criteria') {
    const hasTestableStructure =
      /given|when|then|must|shall|verify|within|%|ms|seconds|إذا|عندما|يجب|التحقق/i.test(cleanDesc);
    const hasVagueTerms = /\b(fast|easy|user-friendly|seamless|good|nice|سريع|سهل)\b/i.test(cleanDesc) && !/\d/.test(cleanDesc);

    if (!hasTestableStructure || hasVagueTerms) {
      return {
        validationStatus: 'failed',
        validationNotes:
          'Failed Testability Gate: Acceptance criteria must include measurable conditions (Given/When/Then or explicit thresholds) without unquantified subjective terms.',
      };
    }
  }

  if (sourceRefs.length === 0) {
    return {
      validationStatus: 'warning',
      validationNotes: 'Traceability Warning: No upstream source reference linked yet.',
    };
  }

  return {
    validationStatus: 'passed',
    validationNotes: 'Passed completeness, testability, and source traceability checks.',
  };
}
