import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Sparkles,
  MessageSquare,
  FolderKanban,
  FileCheck2,
  ShieldCheck,
  Network,
  FileText,
  GitCompare,
  Plug,
  Settings,
  Globe,
  LogOut,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Download,
  Printer,
  RefreshCw,
  Trash2,
  Edit3,
} from 'lucide-react';
import {
  auth,
  db,
  loginWithGoogle,
  logoutUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  Language,
  NavSection,
  AiOperatingMode,
  Company,
  UserProfile,
  Portfolio,
  Project,
  Artifact,
  ArtifactType,
  ArtifactStatus,
  LivingDocument,
  LivingDocType,
  AiTask,
  AuditLog,
  sanitizeId,
  clampString,
  clampStringList,
  evaluateArtifactQuality,
} from './types';
import {
  t,
  navItems,
  artifactTypeLabels,
  livingDocTypeLabels,
} from './i18n';
import { seedDemoWorkspace } from './seedData';
import { VisionStudioPanel } from './components/VisionStudioPanel';

interface ProposedAiArtifact {
  code: string;
  type: ArtifactType;
  title: string;
  description: string;
  rationale: string;
  validationStatus: 'passed' | 'warning' | 'failed';
  validationNotes: string;
  sourceRefs: string[];
  selected?: boolean;
}

interface OrchestrationResponse {
  inferredProjectId: string;
  inferredProjectReasoning: string;
  confidenceScore: number;
  needsClarification: boolean;
  clarificationQuestions: string[];
  planSummary: string;
  stageLogs: {
    stageNumber: number;
    stageName: string;
    agentRole: string;
    summary: string;
    status: string;
  }[];
  proposedArtifacts: ProposedAiArtifact[];
}

export default function App() {
  // Language & Direction State
  const [lang, setLang] = useState<Language>('en');
  const isAr = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  // Auth & Readiness State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [seedingDemo, setSeedingDemo] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Navigation (Default Landing Screen is AI Workspace per Section 3)
  const [activeNav, setActiveNav] = useState<NavSection>('ai_workspace');

  // Persistent Firestore Collections State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [livingDocs, setLivingDocs] = useState<LivingDocument[]>([]);
  const [aiTasks, setAiTasks] = useState<AiTask[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Active Tenant Company
  const activeCompany = useMemo(() => companies[0] || null, [companies]);
  const isPlatformAdmin = currentUser?.email === 'awadsandal2@gmail.com' || userProfile?.role === 'platform_admin';

  // AI Workspace State
  const [workspaceTab, setWorkspaceTab] = useState<'orchestrator' | 'vision'>('orchestrator');
  const [intentInput, setIntentInput] = useState<string>('');
  const [clarificationInput, setClarificationInput] = useState<string>('');
  const [overrideProjectId, setOverrideProjectId] = useState<string>(''); // empty = Auto-infer
  const [taskModeOverride, setTaskModeOverride] = useState<AiOperatingMode | ''>('');
  const [orchestrating, setOrchestrating] = useState<boolean>(false);
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null);
  const [orchestrationResult, setOrchestrationResult] = useState<OrchestrationResponse | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string>('');

  // AI Conversation State
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; note?: string; questions?: string[]; suggestions?: ProposedAiArtifact[] }[]
  >([
    {
      role: 'assistant',
      content:
        'Welcome to Mizan AI Conversation. Describe any business problem, ask about existing requirements, or upload a diagram in the Vision Studio. I will ground answers in your authorized project knowledge and flag any missing business rules before generating artifacts.',
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Portfolios & Projects Form State
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioCode, setNewPortfolioCode] = useState('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectPortfolioId, setNewProjectPortfolioId] = useState('');
  const [newProjectParentId, setNewProjectParentId] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // Requirements Filter & Form State
  const [reqSearch, setReqSearch] = useState('');
  const [reqTypeFilter, setReqTypeFilter] = useState<string>('all');
  const [reqStatusFilter, setReqStatusFilter] = useState<string>('all');
  const [showNewArtifactForm, setShowNewArtifactForm] = useState(false);
  const [newArtType, setNewArtType] = useState<ArtifactType>('requirement');
  const [newArtCode, setNewArtCode] = useState('');
  const [newArtProjectId, setNewArtProjectId] = useState('');
  const [newArtTitle, setNewArtTitle] = useState('');
  const [newArtDesc, setNewArtDesc] = useState('');
  const [newArtRationale, setNewArtRationale] = useState('');
  const [newArtSourceRefs, setNewArtSourceRefs] = useState('');
  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null);

  // Reviews & Approvals Gate Report State
  const [selectedReviewIds, setSelectedReviewIds] = useState<Record<string, boolean>>({});
  const [bulkGateReport, setBulkGateReport] = useState<{
    approvedCodes: string[];
    excludedItems: { code: string; title: string; reason: string }[];
  } | null>(null);

  // Knowledge Memory Filter State
  const [memoryLevel, setMemoryLevel] = useState<'all' | 'company' | 'portfolio' | 'project'>('all');

  // Living Documents State
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [docEditorContent, setDocEditorContent] = useState<string>('');
  const [docEditorTitle, setDocEditorTitle] = useState<string>('');
  const [newDocType, setNewDocType] = useState<LivingDocType>('BRD');
  const [newDocProjectId, setNewDocProjectId] = useState<string>('');

  // Change Impact Analysis State
  const [impactTargetId, setImpactTargetId] = useState<string>('');
  const [proposedChangeText, setProposedChangeText] = useState<string>(
    'Increase maximum single-debtor concentration limit from 15% to 25% of pool and reduce ERP verification timeout from 3000ms to 1200ms.'
  );
  const [impactLoading, setImpactLoading] = useState<boolean>(false);
  const [impactResult, setImpactResult] = useState<{
    riskLevel: string;
    executiveSummary: string;
    affectedArtifacts: { code: string; title: string; impactReason: string; recommendedUpdate: string }[];
    affectedDocumentSections: { docCode: string; docType: string; sectionName: string; proposedRevision: string }[];
  } | null>(null);

  // Integrations & Providers State
  const [providerRegistry, setProviderRegistry] = useState<{
    activeProviderId: string;
    privacyPolicyEnforced: boolean;
    trainsOnCustomerData: boolean;
    providers: {
      id: string;
      name: string;
      status: string;
      models: Record<string, string>;
      zeroTrainingGuarantee: boolean;
    }[];
  } | null>(null);

  // Company Settings Form State
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDomain, setNewCompanyDomain] = useState('');

  // 1. Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Provider Registry from Server
  useEffect(() => {
    fetch('/api/ai/providers')
      .then((r) => r.json())
      .then((data) => setProviderRegistry(data))
      .catch(() => {});
  }, []);

  // 3. Attach Secure Firestore Listeners when Authenticated
  useEffect(() => {
    if (!authReady || !currentUser) {
      setCompanies([]);
      setUserProfile(null);
      setPortfolios([]);
      setProjects([]);
      setArtifacts([]);
      setLivingDocs([]);
      setAiTasks([]);
      setAuditLogs([]);
      return;
    }

    const uid = currentUser.uid;

    const qCompanies = query(collection(db, 'companies'), where('ownerId', '==', uid));
    const unsubCompanies = onSnapshot(
      qCompanies,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Company);
        setCompanies(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'companies')
    );

    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        } else {
          setUserProfile(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    const qPortfolios = query(collection(db, 'portfolios'), where('ownerId', '==', uid));
    const unsubPortfolios = onSnapshot(
      qPortfolios,
      (snap) => setPortfolios(snap.docs.map((d) => d.data() as Portfolio)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'portfolios')
    );

    const qProjects = query(collection(db, 'projects'), where('ownerId', '==', uid));
    const unsubProjects = onSnapshot(
      qProjects,
      (snap) => setProjects(snap.docs.map((d) => d.data() as Project)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
    );

    const qArtifacts = query(collection(db, 'artifacts'), where('authorId', '==', uid));
    const unsubArtifacts = onSnapshot(
      qArtifacts,
      (snap) => setArtifacts(snap.docs.map((d) => d.data() as Artifact)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'artifacts')
    );

    const qDocs = query(collection(db, 'livingDocuments'), where('authorId', '==', uid));
    const unsubDocs = onSnapshot(
      qDocs,
      (snap) => {
        const docs = snap.docs.map((d) => d.data() as LivingDocument);
        setLivingDocs(docs);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'livingDocuments')
    );

    const qTasks = query(collection(db, 'aiTasks'), where('ownerId', '==', uid));
    const unsubTasks = onSnapshot(
      qTasks,
      (snap) => setAiTasks(snap.docs.map((d) => d.data() as AiTask)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'aiTasks')
    );

    const qLogs = query(collection(db, 'auditLogs'), where('actorId', '==', uid));
    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => setAuditLogs(snap.docs.map((d) => d.data() as AuditLog)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    return () => {
      unsubCompanies();
      unsubUser();
      unsubPortfolios();
      unsubProjects();
      unsubArtifacts();
      unsubDocs();
      unsubTasks();
      unsubLogs();
    };
  }, [authReady, currentUser]);

  // Keep selected living document synced in editor
  useEffect(() => {
    if (!selectedDocId && livingDocs.length > 0) {
      setSelectedDocId(livingDocs[0].id);
      setDocEditorTitle(livingDocs[0].title);
      setDocEditorContent(livingDocs[0].content);
    } else if (selectedDocId) {
      const found = livingDocs.find((d) => d.id === selectedDocId);
      if (found) {
        setDocEditorTitle(found.title);
        setDocEditorContent(found.content);
      }
    }
  }, [selectedDocId, livingDocs]);

  // Audit Log Writer Helper
  const recordAuditLog = async (action: string, targetType: string, targetId: string, details: string) => {
    if (!currentUser || !activeCompany) return;
    const logId = sanitizeId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    try {
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        companyId: activeCompany.id,
        actorId: currentUser.uid,
        actorEmail: clampString(currentUser.email || 'user@almizan.example', 256),
        action: clampString(action, 200),
        targetType: clampString(targetType, 100),
        targetId: sanitizeId(targetId),
        details: clampString(details, 2000),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logId}`);
    }
  };

  // Seed Demo Workspace Handler
  const handleSeedDemo = async () => {
    if (!currentUser) return;
    setSeedingDemo(true);
    try {
      await seedDemoWorkspace(
        currentUser.uid,
        currentUser.email || 'user@almizan.example',
        currentUser.displayName || 'Enterprise Architect'
      );
    } finally {
      setSeedingDemo(false);
    }
  };

  // Ensure default tenant exists if user creates something before seeding
  const ensureTenantCompany = async (): Promise<string> => {
    if (activeCompany) return activeCompany.id;
    if (!currentUser) throw new Error('Not authenticated');
    const compId = sanitizeId(`comp_${currentUser.uid.slice(0, 12)}`);
    try {
      await setDoc(doc(db, 'companies', compId), {
        id: compId,
        name: 'Primary Enterprise Workspace',
        domain: 'enterprise.workspace',
        defaultAiMode: 'workflow',
        privacyVerified: true,
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: clampString(currentUser.email || 'user@enterprise.workspace', 256),
        displayName: clampString(currentUser.displayName || 'Workspace Lead', 200),
        role: isPlatformAdmin ? 'platform_admin' : 'company_admin',
        companyId: compId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return compId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `companies/${compId}`);
    }
  };

  // Effective AI Operating Mode (Task override takes precedence over company default without changing company default)
  const effectiveAiMode: AiOperatingMode =
    (taskModeOverride as AiOperatingMode) || activeCompany?.defaultAiMode || 'workflow';

  // Run 11-Stage Intent-Driven AI Orchestration
  const handleRunOrchestration = async () => {
    if (!intentInput.trim() || !currentUser) return;
    setOrchestrating(true);
    setOrchestrationError(null);

    try {
      const compId = await ensureTenantCompany();
      let defaultProjectId = overrideProjectId || projects[0]?.id || '';
      let defaultPortfolioId = projects[0]?.portfolioId || portfolios[0]?.id || '';

      // If no portfolio/project exists yet, bootstrap a default portfolio & project so artifacts have valid parents
      if (!defaultPortfolioId) {
        defaultPortfolioId = sanitizeId(`port_auto_${Date.now()}`);
        await setDoc(doc(db, 'portfolios', defaultPortfolioId), {
          id: defaultPortfolioId,
          companyId: compId,
          code: 'PF-CORE-01',
          name: 'Core Solution Portfolio',
          description: 'Automatically initialized portfolio for intent-driven solution artifacts.',
          status: 'active',
          ownerId: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      if (!defaultProjectId) {
        defaultProjectId = sanitizeId(`proj_auto_${Date.now()}`);
        await setDoc(doc(db, 'projects', defaultProjectId), {
          id: defaultProjectId,
          companyId: compId,
          portfolioId: defaultPortfolioId,
          parentProjectId: '',
          code: 'PRJ-INTENT-01',
          name: 'Intent-Inferred Solution Project',
          description: clampString(intentInput, 500),
          status: 'discovery',
          ownerId: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const res = await fetch('/api/ai/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: intentInput,
          language: lang,
          mode: effectiveAiMode,
          projects,
          existingArtifacts: artifacts,
          clarificationAnswers: clarificationInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI orchestration failed');
      }

      const proposalsWithSelection: ProposedAiArtifact[] = (data.proposedArtifacts || []).map((p: ProposedAiArtifact) => ({
        ...p,
        selected: true,
      }));

      const enriched: OrchestrationResponse = {
        ...data,
        proposedArtifacts: proposalsWithSelection,
      };
      setOrchestrationResult(enriched);

      // Resolve inferred project
      const resolvedProjId =
        overrideProjectId ||
        (projects.some((p) => p.id === data.inferredProjectId) ? data.inferredProjectId : defaultProjectId);

      // Persist AI Task record in Firestore
      const taskId = sanitizeId(`task_${Date.now()}`);
      setActiveTaskId(taskId);
      await setDoc(doc(db, 'aiTasks', taskId), {
        id: taskId,
        companyId: compId,
        projectId: resolvedProjId,
        intent: clampString(intentInput, 3000),
        inferredContext: clampString(
          data.inferredProjectReasoning || `Inferred Project ID: ${resolvedProjId} (${data.confidenceScore || 90}% confidence)`,
          2000
        ),
        mode: effectiveAiMode,
        currentStage: data.needsClarification ? 4 : 9,
        status: data.needsClarification ? 'awaiting_clarification' : 'awaiting_approval',
        clarificationQuestions: clampString((data.clarificationQuestions || []).join('\n'), 3000),
        planSummary: clampString(data.planSummary || 'Orchestrated lifecycle plan', 3000),
        generatedArtifactIds: clampStringList(proposalsWithSelection.map((a) => a.code)),
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await recordAuditLog(
        'AI_LIFECYCLE_ORCHESTRATED',
        'aiTask',
        taskId,
        `Executed ${effectiveAiMode} orchestration for intent: "${intentInput.slice(0, 120)}"`
      );
    } catch (err) {
      setOrchestrationError(err instanceof Error ? err.message : 'Orchestration failed');
    } finally {
      setOrchestrating(false);
    }
  };

  // Pause / Resume / Complete Task Status
  const handleUpdateTaskState = async (task: AiTask, nextStatus: AiTask['status'], nextStage?: number) => {
    try {
      await updateDoc(doc(db, 'aiTasks', task.id), {
        projectId: task.projectId,
        inferredContext: task.inferredContext,
        mode: task.mode,
        currentStage: nextStage ?? task.currentStage,
        status: nextStatus,
        clarificationQuestions: task.clarificationQuestions,
        planSummary: task.planSummary,
        generatedArtifactIds: task.generatedArtifactIds,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `aiTasks/${task.id}`);
    }
  };

  // Commit Selected AI Proposed Artifacts to Firestore as Pending Review (or Draft)
  const handleCommitProposedArtifacts = async () => {
    if (!orchestrationResult || !currentUser) return;
    const compId = await ensureTenantCompany();
    const targetProj =
      projects.find((p) => p.id === (overrideProjectId || orchestrationResult.inferredProjectId)) || projects[0];
    if (!targetProj) return;

    const selectedProposals = orchestrationResult.proposedArtifacts.filter((p) => p.selected);
    const savedCodes: string[] = [];

    for (const prop of selectedProposals) {
      const artId = sanitizeId(`art_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const code = clampString(prop.code || `ART-${Math.floor(100 + Math.random() * 900)}`, 32);
      const validTypes: ArtifactType[] = [
        'business_need',
        'requirement',
        'business_rule',
        'user_story',
        'acceptance_criteria',
        'test_case',
        'architecture_decision',
        'api_spec',
        'assumption',
        'constraint',
        'change_request',
        'visual_asset',
      ];
      const safeType: ArtifactType = validTypes.includes(prop.type) ? prop.type : 'requirement';
      const evalResult = evaluateArtifactQuality(
        safeType,
        prop.title,
        prop.description,
        prop.sourceRefs?.length ? prop.sourceRefs : ['AI-INTENT-WORKSPACE']
      );
      const finalValStatus =
        prop.validationStatus === 'failed' || evalResult.validationStatus === 'failed'
          ? 'failed'
          : prop.validationStatus === 'warning'
          ? 'warning'
          : 'passed';

      try {
        await setDoc(doc(db, 'artifacts', artId), {
          id: artId,
          code,
          companyId: compId,
          portfolioId: targetProj.portfolioId,
          projectId: targetProj.id,
          type: safeType,
          title: clampString(prop.title, 300, 'Untitled Artifact'),
          description: clampString(prop.description, 5000, 'Description pending'),
          rationale: clampString(prop.rationale || 'Generated via Intent-Driven AI Lifecycle', 2000),
          status: 'pending_review',
          validationStatus: finalValStatus,
          validationNotes: clampString(prop.validationNotes || evalResult.validationNotes, 1000),
          version: 1,
          sourceRefs: clampStringList(prop.sourceRefs?.length ? prop.sourceRefs : ['AI-ORCHESTRATOR']),
          linkedArtifactIds: [],
          authorId: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        savedCodes.push(code);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `artifacts/${artId}`);
      }
    }

    await recordAuditLog(
      'AI_PROPOSALS_COMMITTED_FOR_REVIEW',
      'project',
      targetProj.id,
      `Saved ${savedCodes.length} proposed artifacts (${savedCodes.join(', ')}) as pending_review.`
    );

    setActiveNav('reviews_approvals');
  };

  // Save Single Artifact (from Vision Studio, Chat, or Manual Form)
  const handleSaveSingleArtifact = async (item: {
    type: ArtifactType;
    title: string;
    description: string;
    rationale: string;
    projectId: string;
    sourceRefs: string[];
    code?: string;
  }) => {
    if (!currentUser) return;
    const compId = await ensureTenantCompany();
    const proj = projects.find((p) => p.id === item.projectId) || projects[0];
    if (!proj) return;

    const artId = sanitizeId(`art_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const prefixMap: Record<ArtifactType, string> = {
      business_need: 'BN',
      requirement: 'REQ',
      business_rule: 'BR',
      user_story: 'US',
      acceptance_criteria: 'AC',
      test_case: 'TC',
      architecture_decision: 'ADR',
      api_spec: 'API',
      assumption: 'ASM',
      constraint: 'CON',
      change_request: 'CR',
      visual_asset: 'VIS',
    };
    const code = clampString(
      item.code || `${prefixMap[item.type] || 'ART'}-${Math.floor(100 + Math.random() * 899)}`,
      32
    );
    const refs = clampStringList(item.sourceRefs.length ? item.sourceRefs : ['MANUAL-ENTRY']);
    const quality = evaluateArtifactQuality(item.type, item.title, item.description, refs);

    try {
      await setDoc(doc(db, 'artifacts', artId), {
        id: artId,
        code,
        companyId: compId,
        portfolioId: proj.portfolioId,
        projectId: proj.id,
        type: item.type,
        title: clampString(item.title, 300, 'Untitled Artifact'),
        description: clampString(item.description, 5000, 'No description'),
        rationale: clampString(item.rationale || 'Business & solution traceability', 2000),
        status: 'pending_review',
        validationStatus: quality.validationStatus,
        validationNotes: clampString(quality.validationNotes, 1000),
        version: 1,
        sourceRefs: refs,
        linkedArtifactIds: [],
        authorId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await recordAuditLog('ARTIFACT_CREATED', 'artifact', artId, `Created ${code}: ${item.title}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `artifacts/${artId}`);
    }
  };

  // Review & Approval Single Action
  const handleReviewDecision = async (art: Artifact, nextStatus: ArtifactStatus) => {
    if (!currentUser) return;
    // Enforce Acceptance Criteria Validation Gate on Client AND Server/Firestore Rules
    if (art.type === 'acceptance_criteria' && nextStatus === 'approved' && art.validationStatus !== 'passed') {
      setBulkGateReport({
        approvedCodes: [],
        excludedItems: [
          {
            code: art.code,
            title: art.title,
            reason:
              art.validationNotes ||
              'Acceptance criteria has not passed automated testability validation and cannot be approved.',
          },
        ],
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'artifacts', art.id), {
        status: nextStatus,
        validationStatus: art.validationStatus,
        validationNotes: art.validationNotes,
        version: art.version + 1,
        updatedAt: serverTimestamp(),
      });

      // Flag any living document referencing this artifact code as needs_sync if content/status changed
      for (const ldoc of livingDocs) {
        if (ldoc.sourceArtifactIds.includes(art.code) && ldoc.status === 'approved') {
          await updateDoc(doc(db, 'livingDocuments', ldoc.id), {
            title: ldoc.title,
            content: ldoc.content,
            status: 'needs_sync',
            version: ldoc.version,
            sourceArtifactIds: ldoc.sourceArtifactIds,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await recordAuditLog(
        `ARTIFACT_${nextStatus.toUpperCase()}`,
        'artifact',
        art.id,
        `Artifact ${art.code} transitioned to ${nextStatus} (v${art.version + 1}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `artifacts/${art.id}`);
    }
  };

  // Bulk Approval with Mandatory Eligibility Gate for Acceptance Criteria (Section 8)
  const handleBulkApprove = async () => {
    const candidateArtifacts = artifacts.filter((a) =>
      Object.keys(selectedReviewIds).some((k) => selectedReviewIds[k])
        ? selectedReviewIds[a.id]
        : a.status === 'pending_review' || a.status === 'draft'
    );

    const approvedCodes: string[] = [];
    const excludedItems: { code: string; title: string; reason: string }[] = [];

    for (const art of candidateArtifacts) {
      if (art.type === 'acceptance_criteria' && art.validationStatus !== 'passed') {
        excludedItems.push({
          code: art.code,
          title: art.title,
          reason:
            art.validationNotes ||
            'Excluded from bulk approval: Acceptance Criteria failed required testability validation.',
        });
        continue;
      }

      try {
        await updateDoc(doc(db, 'artifacts', art.id), {
          status: 'approved',
          validationStatus: art.validationStatus,
          validationNotes: art.validationNotes,
          version: art.version + 1,
          updatedAt: serverTimestamp(),
        });
        approvedCodes.push(art.code);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `artifacts/${art.id}`);
      }
    }

    setBulkGateReport({ approvedCodes, excludedItems });
    setSelectedReviewIds({});

    if (approvedCodes.length > 0 || excludedItems.length > 0) {
      await recordAuditLog(
        'BULK_APPROVAL_EXECUTED',
        'artifacts',
        'bulk_gate',
        `Approved ${approvedCodes.length} artifacts (${approvedCodes.join(', ')}). Excluded ${excludedItems.length} ineligible criteria.`
      );
    }
  };

  // Update Artifact Content & Re-run Validation (e.g., fixing a failed Acceptance Criterion so it passes)
  const handleSaveEditedArtifact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArtifact) return;
    const quality = evaluateArtifactQuality(
      editingArtifact.type,
      editingArtifact.title,
      editingArtifact.description,
      editingArtifact.sourceRefs
    );

    try {
      await updateDoc(doc(db, 'artifacts', editingArtifact.id), {
        title: clampString(editingArtifact.title, 300),
        description: clampString(editingArtifact.description, 5000),
        rationale: clampString(editingArtifact.rationale, 2000),
        status: 'pending_review',
        validationStatus: quality.validationStatus,
        validationNotes: clampString(quality.validationNotes, 1000),
        version: editingArtifact.version + 1,
        sourceRefs: clampStringList(editingArtifact.sourceRefs),
        linkedArtifactIds: clampStringList(editingArtifact.linkedArtifactIds),
        updatedAt: serverTimestamp(),
      });

      await recordAuditLog(
        'ARTIFACT_REVISED',
        'artifact',
        editingArtifact.id,
        `Revised ${editingArtifact.code} (v${editingArtifact.version + 1}) · Validation: ${quality.validationStatus}`
      );
      setEditingArtifact(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `artifacts/${editingArtifact.id}`);
    }
  };

  // Derive / Generate Living Document from Approved Artifacts
  const handleDeriveLivingDocument = async (docType: LivingDocType, projId: string) => {
    if (!currentUser) return;
    const compId = await ensureTenantCompany();
    const targetProj = projects.find((p) => p.id === projId) || projects[0];
    if (!targetProj) return;

    const approvedProjectArtifacts = artifacts.filter(
      (a) => a.projectId === targetProj.id && a.status === 'approved'
    );

    const sectionsByType: Record<LivingDocType, ArtifactType[]> = {
      BRD: ['business_need', 'business_rule', 'assumption', 'constraint'],
      FRD: ['requirement', 'user_story', 'acceptance_criteria'],
      SRS: ['requirement', 'architecture_decision', 'api_spec', 'constraint'],
      BUSINESS_RULES: ['business_rule', 'constraint'],
      USER_STORIES: ['user_story', 'acceptance_criteria'],
      ARCH_DECISIONS: ['architecture_decision', 'assumption', 'constraint'],
      API_SPECS: ['api_spec', 'architecture_decision'],
      TEST_PLANS: ['acceptance_criteria', 'test_case'],
      SECURITY_NFR: ['constraint', 'requirement', 'architecture_decision'],
      HANDOVER: ['business_need', 'architecture_decision', 'api_spec', 'test_case'],
    };

    const relevantTypes = sectionsByType[docType] || ['requirement'];
    const matching = approvedProjectArtifacts.filter((a) => relevantTypes.includes(a.type));
    const usedArtifacts = matching.length > 0 ? matching : approvedProjectArtifacts;

    const generatedMarkdown = [
      `# ${livingDocTypeLabels[lang][docType]}`,
      `Project: ${targetProj.code} — ${targetProj.name}`,
      `Derived from ${usedArtifacts.length} Approved Knowledge Artifacts · Generated: ${new Date().toISOString().split('T')[0]}`,
      '',
      ...usedArtifacts.map(
        (a, idx) =>
          `## ${idx + 1}. [${a.code}] ${a.title}\n- **Type**: ${artifactTypeLabels[lang][a.type]} · **Version**: v${a.version} · **Sources**: ${a.sourceRefs.join(', ') || 'Direct'}\n\n${a.description}\n\n> *Rationale*: ${a.rationale}`
      ),
    ].join('\n\n');

    const docId = sanitizeId(`doc_${docType.toLowerCase()}_${Date.now()}`);
    const code = `DOC-${docType}-${Math.floor(10 + Math.random() * 89)}`;
    const sourceCodes = clampStringList(usedArtifacts.map((a) => a.code));

    try {
      await setDoc(doc(db, 'livingDocuments', docId), {
        id: docId,
        code,
        companyId: compId,
        projectId: targetProj.id,
        docType,
        title: clampString(`${docType} — ${targetProj.name}`, 300),
        content: clampString(generatedMarkdown, 20000),
        status: 'draft',
        version: 1,
        sourceArtifactIds: sourceCodes,
        authorId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedDocId(docId);
      await recordAuditLog('LIVING_DOC_DERIVED', 'livingDocument', docId, `Derived ${code} from approved project knowledge.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `livingDocuments/${docId}`);
    }
  };

  // Save Living Document Edits / Approve Living Document
  const handleUpdateLivingDoc = async (nextStatus?: 'draft' | 'approved' | 'needs_sync') => {
    const activeDoc = livingDocs.find((d) => d.id === selectedDocId);
    if (!activeDoc) return;
    try {
      await updateDoc(doc(db, 'livingDocuments', activeDoc.id), {
        title: clampString(docEditorTitle, 300),
        content: clampString(docEditorContent, 20000),
        status: nextStatus || activeDoc.status,
        version: activeDoc.version + 1,
        sourceArtifactIds: activeDoc.sourceArtifactIds,
        updatedAt: serverTimestamp(),
      });
      await recordAuditLog(
        'LIVING_DOC_UPDATED',
        'livingDocument',
        activeDoc.id,
        `Updated ${activeDoc.code} to v${activeDoc.version + 1} (${nextStatus || activeDoc.status}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `livingDocuments/${activeDoc.id}`);
    }
  };

  // AI Conversation Submit
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const nextHistory = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(nextHistory);
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory,
          language: lang,
          projectContext: projects[0] || null,
          artifactsContext: artifacts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'No response received.',
          note: data.inferredContextNote,
          questions: data.clarificationQuestions || [],
          suggestions: data.suggestedArtifacts || [],
        },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unable to reach AI conversation service.'}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Run Change Impact Analysis
  const handleRunChangeImpact = async () => {
    const target = artifacts.find((a) => a.id === impactTargetId) || artifacts[0];
    if (!target || !proposedChangeText.trim()) return;
    setImpactLoading(true);
    try {
      const res = await fetch('/api/ai/impact-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetArtifact: target,
          proposedChange: proposedChangeText,
          allArtifacts: artifacts,
          livingDocs,
          language: lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impact analysis failed');
      setImpactResult(data);
      await recordAuditLog(
        'CHANGE_IMPACT_ANALYZED',
        'artifact',
        target.id,
        `Evaluated impact on ${target.code} (Risk: ${data.riskLevel})`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setImpactLoading(false);
    }
  };

  // Filtered Artifacts for Requirements View
  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((a) => {
      const matchesType = reqTypeFilter === 'all' || a.type === reqTypeFilter;
      const matchesStatus = reqStatusFilter === 'all' || a.status === reqStatusFilter;
      const q = reqSearch.toLowerCase();
      const matchesQuery =
        !q ||
        a.code.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q);
      return matchesType && matchesStatus && matchesQuery;
    });
  }, [artifacts, reqTypeFilter, reqStatusFilter, reqSearch]);

  // Unauthenticated Landing Screen
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        {t(lang, 'loadingWorkspace')}
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        {/* Top Bar Contract: 3 zones */}
        <header className="flex items-center justify-between gap-8 px-8 py-4 bg-white border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            {t(lang, 'appName')}
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <span className="whitespace-nowrap shrink-0">Intent-Driven AI</span>
            <span className="whitespace-nowrap shrink-0">11-Stage Lifecycle</span>
            <span className="whitespace-nowrap shrink-0">Traceable Governance</span>
            <span className="whitespace-nowrap shrink-0">Living Documents</span>
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isAr ? 'English (LTR)' : 'العربية (RTL)'}
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="text-xs font-medium text-indigo-600">
              {isAr ? 'منصة هندسة المتطلبات والحلول المؤسسية' : 'Bilingual Enterprise Solution Engineering'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
              {t(lang, 'signInTitle')}
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              {t(lang, 'signInSubtitle')}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={async () => {
                  setAuthError(null);
                  try {
                    await loginWithGoogle();
                  } catch (err) {
                    setAuthError(err instanceof Error ? err.message : 'Authentication failed');
                  }
                }}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {t(lang, 'signInWithGoogle')}
              </button>
            </div>
            {authError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{authError}</p>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {isAr ? 'حوكمة دورة الحياة الكاملة' : 'End-to-End Lifecycle Capabilities'}
            </h2>
            <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <li>
                <strong className="text-slate-900">01. Intent-First Discovery:</strong>{' '}
                {isAr
                  ? 'استنتاج سياق المشروع تلقائياً من المعرفة المؤسسية وطرح أسئلة استيضاح دقيقة.'
                  : 'Infer project context automatically and ask targeted clarification questions when ambiguity affects correctness.'}
              </li>
              <li>
                <strong className="text-slate-900">02. Strict Quality & Approval Gates:</strong>{' '}
                {isAr
                  ? 'فصل التحقق الآلي عن الاعتماد البشري، ومنع اعتماد معايير القبول غير القابلة للاختبار.'
                  : 'Separate automated validation from human approval; prevent approving untestable acceptance criteria.'}
              </li>
              <li>
                <strong className="text-slate-900">03. Multimodal Visual Intelligence:</strong>{' '}
                {isAr
                  ? 'تحليل صور السبورات والمخططات عبر gemini-3.1-pro-preview وتوليد/تعديل المخططات عبر gemini-nano-banana-2.1.'
                  : 'Analyze whiteboard photos via gemini-3.1-pro-preview and generate/edit diagrams via gemini-nano-banana-2.1.'}
              </li>
              <li>
                <strong className="text-slate-900">04. Multi-Tenant Zero-Training Security:</strong>{' '}
                {isAr
                  ? 'عزل كامل لبيانات الشركات على الخادم وقواعد Firestore مع سجل تدقيق غير قابل للتعديل.'
                  : 'Server-side & Firestore rule isolation with immutable audit history.'}
              </li>
            </ul>
          </div>
        </main>

        <footer className="px-8 py-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Mizan AI Lifecycle Platform</span>
          <span>Arabic (RTL) · English (LTR)</span>
        </footer>
      </div>
    );
  }

  const navIconMap: Record<NavSection, React.ReactNode> = {
    ai_workspace: <Sparkles className="w-4 h-4 shrink-0" />,
    ai_conversation: <MessageSquare className="w-4 h-4 shrink-0" />,
    portfolios_projects: <FolderKanban className="w-4 h-4 shrink-0" />,
    requirements: <FileCheck2 className="w-4 h-4 shrink-0" />,
    reviews_approvals: <ShieldCheck className="w-4 h-4 shrink-0" />,
    knowledge_memory: <Network className="w-4 h-4 shrink-0" />,
    living_documents: <FileText className="w-4 h-4 shrink-0" />,
    change_impact: <GitCompare className="w-4 h-4 shrink-0" />,
    integrations: <Plug className="w-4 h-4 shrink-0" />,
    company_settings: <Settings className="w-4 h-4 shrink-0" />,
  };

  const pendingReviewsCount = artifacts.filter((a) => a.status === 'pending_review').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract (Section 2 of Frontend Design Skill) */}
      <header className="no-print flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-20">
        {/* Zone 1: Single-line Brand / Context Breadcrumb */}
        <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          <span>{t(lang, 'appName')}</span>
          <span className="text-slate-300 font-normal">/</span>
          <span className="font-medium text-slate-600">{t(lang, `nav_${activeNav}`)}</span>
        </div>

        {/* Zone 2: 4 concise single-line navigation shortcuts */}
        <nav className="hidden xl:flex items-center gap-6 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveNav('ai_workspace')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {t(lang, 'nav_ai_workspace')}
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('requirements')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {t(lang, 'nav_requirements')} ({artifacts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('reviews_approvals')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {t(lang, 'nav_reviews_approvals')} ({pendingReviewsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('living_documents')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {t(lang, 'nav_living_documents')} ({livingDocs.length})
          </button>
        </nav>

        {/* Zone 3: Language Toggle & Demo Seed / Sign Out */}
        <div className="flex items-center gap-2.5 shrink-0">
          {artifacts.length === 0 && (
            <button
              type="button"
              disabled={seedingDemo}
              onClick={handleSeedDemo}
              className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {seedingDemo ? '...' : t(lang, 'demoDataBtn')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setLang(isAr ? 'en' : 'ar')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isAr ? 'English' : 'العربية'}</span>
          </button>
          <button
            type="button"
            onClick={logoutUser}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t(lang, 'signOut')}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout: Persistent Sidebar + Central Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Persistent Sidebar (260px width) */}
        <aside className="no-print w-64 bg-white border-e border-slate-200 flex flex-col justify-between shrink-0">
          <div className="p-4 space-y-1">
            <div className="px-3 py-2 mb-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {activeCompany ? activeCompany.name : isAr ? 'مساحة العمل المؤسسية' : 'Enterprise Tenant'}
              </p>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {currentUser.email} · {isPlatformAdmin ? t(lang, 'platformAdminBadge') : t(lang, 'companyAdminBadge')}
              </p>
            </div>

            {navItems.map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    {navIconMap[item.id]}
                    <span className="truncate">{t(lang, item.labelKey)}</span>
                  </span>
                  {item.id === 'reviews_approvals' && pendingReviewsCount > 0 && (
                    <span className={`font-mono text-xs tabular-nums ${active ? 'text-indigo-200' : 'text-indigo-600'}`}>
                      {pendingReviewsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-200 space-y-2">
            <div className="text-xs text-slate-500">
              <span>{isAr ? 'وضع الذكاء الافتراضي للشركة:' : 'Company Default AI Mode:'}</span>
              <span className="block font-medium text-slate-800 mt-0.5">
                {t(lang, `mode_${activeCompany?.defaultAiMode || 'workflow'}`)}
              </span>
            </div>
            <button
              type="button"
              disabled={seedingDemo}
              onClick={handleSeedDemo}
              className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              {seedingDemo ? '...' : t(lang, 'demoDataBtn')}
            </button>
          </div>
        </aside>

        {/* Central Workspace */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-[1440px]">
          {/* SECTION 1: AI WORKSPACE (Default Landing Screen) */}
          {activeNav === 'ai_workspace' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t(lang, 'intentHeader')}</h1>
                  <p className="text-sm text-slate-600 mt-1 max-w-3xl">{t(lang, 'intentSubheader')}</p>
                </div>

                {/* Segmented Sub-Mode Switcher: Intent Orchestrator vs Vision & Diagram Studio */}
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('orchestrator')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      workspaceTab === 'orchestrator'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t(lang, 'intentOrchestratorTab')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('vision')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      workspaceTab === 'vision'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t(lang, 'visionStudioTab')}
                  </button>
                </div>
              </div>

              {workspaceTab === 'vision' ? (
                <VisionStudioPanel
                  lang={lang}
                  projects={projects}
                  selectedProjectId={overrideProjectId}
                  onSaveArtifact={handleSaveSingleArtifact}
                />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  {/* Left 7 Cols: Natural-Language Intent Composer & Proposed Outputs */}
                  <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                      {/* Operating Mode Selector (Task Override without altering company default) */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <span className="text-xs font-semibold text-slate-700">
                          {t(lang, 'taskOverrideMode')}
                        </span>
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                          {(['assistant', 'workflow', 'multi_agent'] as AiOperatingMode[]).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setTaskModeOverride(m)}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                effectiveAiMode === m
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {t(lang, `mode_${m}`)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Natural Language Intent Input */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                          {isAr
                            ? 'احتياج العمل أو المشكلة أو الفرصة (باللغة الطبيعية)'
                            : 'Business Need, Problem, or Opportunity (Natural Language)'}
                        </label>
                        <textarea
                          rows={4}
                          value={intentInput}
                          onChange={(e) => setIntentInput(e.target.value)}
                          placeholder={t(lang, 'intentPlaceholder')}
                          className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>

                      {/* Optional Project Context Override */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            {t(lang, 'overrideContextLabel')}
                          </label>
                          <select
                            value={overrideProjectId}
                            onChange={(e) => setOverrideProjectId(e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                          >
                            <option value="">{t(lang, 'autoInferOption')}</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code} — {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end">
                          <button
                            type="button"
                            disabled={orchestrating || !intentInput.trim()}
                            onClick={handleRunOrchestration}
                            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                          >
                            {orchestrating ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            <span>
                              {orchestrating ? t(lang, 'runningOrchestration') : t(lang, 'runOrchestration')}
                            </span>
                          </button>
                        </div>
                      </div>

                      {orchestrationError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                          {orchestrationError}
                        </div>
                      )}
                    </div>

                    {/* Inferred Context & Clarification Questions Card */}
                    {orchestrationResult && (
                      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                          <div>
                            <div className="text-xs text-slate-500">
                              <span>{t(lang, 'inferredContextLabel')}</span>
                              <span> · </span>
                              <span className="font-mono tabular-nums">
                                Confidence: {orchestrationResult.confidenceScore}%
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900 mt-1">
                              {projects.find((p) => p.id === (overrideProjectId || orchestrationResult.inferredProjectId))
                                ?.name || 'Auto-Inferred Project Context'}
                            </h3>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {orchestrationResult.inferredProjectReasoning}
                            </p>
                          </div>
                        </div>

                        {/* Targeted Clarification Questions when ambiguity affects correctness */}
                        {orchestrationResult.clarificationQuestions?.length > 0 && (
                          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                {isAr
                                  ? 'أسئلة استيضاح موجهة (لا يقوم الذكاء الاصطناعي باختلاق قواعد العمل الناقصة)'
                                  : 'Targeted Clarification Questions (AI does not invent missing business rules)'}
                              </span>
                            </div>
                            <ul className="space-y-1.5 text-xs text-amber-900 list-decimal list-inside">
                              {orchestrationResult.clarificationQuestions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                            <div className="pt-2 flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={clarificationInput}
                                onChange={(e) => setClarificationInput(e.target.value)}
                                placeholder={t(lang, 'clarificationPlaceholder')}
                                className="flex-1 text-xs bg-white border border-amber-300 rounded-lg px-3 py-2"
                              />
                              <button
                                type="button"
                                disabled={orchestrating || !clarificationInput.trim()}
                                onClick={handleRunOrchestration}
                                className="px-3.5 py-2 bg-amber-900 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
                              >
                                {isAr ? 'تحديث الخطة بالإجابات' : 'Re-Run with Clarifications'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Multi-Agent Plan & Review Summary */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-900">
                            {isAr ? 'خطة العمل ومراجعة الوكلاء المستقلة' : 'Execution Plan & Independent Multi-Agent Review'}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {orchestrationResult.planSummary}
                          </p>
                        </div>

                        {/* Proposed Artifacts Table for Human Review Selection */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-slate-900">
                              {isAr
                                ? 'المخرجات المهيكلة المقترحة (تبقى مسودات مقترحة حتى الاعتماد البشري)'
                                : 'Proposed Structured Artifacts (Remain proposals until human approval)'}
                            </h4>
                            <button
                              type="button"
                              onClick={handleCommitProposedArtifacts}
                              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                              {t(lang, 'commitProposals')}
                            </button>
                          </div>

                          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                            {orchestrationResult.proposedArtifacts.map((prop, idx) => (
                              <div key={idx} className="p-3.5 flex items-start gap-3 bg-white hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={!!prop.selected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setOrchestrationResult((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            proposedArtifacts: prev.proposedArtifacts.map((item, i) =>
                                              i === idx ? { ...item, selected: checked } : item
                                            ),
                                          }
                                        : null
                                    );
                                  }}
                                  className="mt-1 rounded border-slate-300 text-indigo-600"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="font-mono font-semibold text-slate-800 tabular-nums">
                                      {prop.code}
                                    </span>
                                    <span>·</span>
                                    <span>{artifactTypeLabels[lang][prop.type] || prop.type}</span>
                                    <span>·</span>
                                    <span
                                      className={
                                        prop.validationStatus === 'passed'
                                          ? 'text-emerald-700 font-medium'
                                          : prop.validationStatus === 'failed'
                                          ? 'text-red-700 font-medium'
                                          : 'text-amber-700 font-medium'
                                      }
                                    >
                                      Validation: {prop.validationStatus}
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold text-slate-900 mt-1">{prop.title}</p>
                                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{prop.description}</p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {prop.validationNotes}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right 5 Cols: 11-Stage AI Lifecycle Execution Dashboard & Task Controls */}
                  <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                          {t(lang, 'lifecycleStagesTitle')}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t(lang, `mode_${effectiveAiMode}`)} — {t(lang, `modeDesc_${effectiveAiMode}`)}
                        </p>
                      </div>
                    </div>

                    {/* Active Tasks Queue with Pause / Resume / Retry */}
                    {aiTasks.length > 0 && (
                      <div className="space-y-2.5 pb-4 border-b border-slate-200">
                        <div className="text-xs font-semibold text-slate-700">
                          {isAr ? 'مهام التنفيذ النشطة والمسجلة' : 'Active & Persisted AI Execution Tasks'}
                        </div>
                        {aiTasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span className="font-mono tabular-nums">
                                Stage {task.currentStage}/11 · {task.status}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {task.status === 'running' || task.status === 'awaiting_approval' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTaskState(task, 'paused')}
                                    className="px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1"
                                  >
                                    <Pause className="w-3 h-3" />
                                    <span>{t(lang, 'pauseTask')}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTaskState(task, 'running')}
                                    className="px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>{t(lang, 'resumeTask')}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIntentInput(task.intent);
                                    handleRunOrchestration();
                                  }}
                                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>{t(lang, 'retryTask')}</span>
                                </button>
                              </div>
                            </div>
                            <p className="text-xs font-medium text-slate-900 line-clamp-2">{task.intent}</p>
                            <p className="text-xs text-slate-500">{task.inferredContext}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 11-Stage Orchestrated Lifecycle Checklist */}
                    <div className="space-y-2.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((stageNum) => {
                        const stageLog = orchestrationResult?.stageLogs?.find(
                          (s) => s.stageNumber === stageNum
                        );
                        const currentActiveStage = orchestrationResult
                          ? orchestrationResult.needsClarification
                            ? 4
                            : 9
                          : aiTasks[0]?.currentStage || 0;
                        const isDone = stageNum <= currentActiveStage;

                        return (
                          <div
                            key={stageNum}
                            className={`p-2.5 rounded-lg border text-xs transition-colors ${
                              isDone
                                ? 'bg-slate-50 border-slate-200 text-slate-900'
                                : 'bg-white border-slate-100 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">
                                {t(lang, `stage_${stageNum}`)}
                              </span>
                              {stageLog?.agentRole && (
                                <span className="font-mono text-[11px] text-slate-500">
                                  {stageLog.agentRole}
                                </span>
                              )}
                            </div>
                            {stageLog?.summary && (
                              <p className="text-xs text-slate-600 mt-1">{stageLog.summary}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: AI CONVERSATION */}
          {activeNav === 'ai_conversation' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'nav_ai_conversation')}</h1>
                <p className="text-sm text-slate-600 mt-1">
                  {isAr
                    ? 'ناقش الاحتياجات، استفسر عن المتطلبات المرتبطة، واستخرج مسودات معايير القبول مباشرة من الحوار.'
                    : 'Converse in natural language to refine business needs, uncover missing rules, and generate candidate artifacts.'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[620px]">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-2xl rounded-xl p-4 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-900 border border-slate-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {msg.note && (
                          <div className="mt-3 pt-2 border-t border-slate-200/60 text-xs text-slate-500">
                            Context: {msg.note}
                          </div>
                        )}

                        {msg.questions && msg.questions.length > 0 && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                            <p className="font-semibold mb-1">
                              {isAr ? 'أسئلة استيضاح مقترحة:' : 'Clarification Questions:'}
                            </p>
                            <ul className="list-disc list-inside space-y-1">
                              {msg.questions.map((q, qi) => (
                                <li key={qi}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-slate-700">
                              {isAr ? 'مخرجات مقترحة من المحادثة:' : 'Suggested Artifacts from Conversation:'}
                            </p>
                            {msg.suggestions.map((sug, si) => (
                              <div
                                key={si}
                                className="p-3 bg-white border border-slate-200 rounded-lg flex items-start justify-between gap-3"
                              >
                                <div>
                                  <span className="text-xs font-mono text-slate-500">{sug.type}</span>
                                  <p className="text-xs font-semibold text-slate-900">{sug.title}</p>
                                  <p className="text-xs text-slate-600 mt-0.5">{sug.description}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveSingleArtifact({
                                      type: (sug.type as ArtifactType) || 'requirement',
                                      title: sug.title,
                                      description: sug.description,
                                      rationale: sug.rationale || 'Proposed in AI Conversation',
                                      projectId: projects[0]?.id || '',
                                      sourceRefs: ['AI-CHAT-SESSION'],
                                    })
                                  }
                                  className="px-2.5 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md shrink-0"
                                >
                                  {isAr ? 'حفظ للمراجعة' : 'Save Draft'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleSendChatMessage}
                  className="p-4 border-t border-slate-200 flex items-center gap-3 bg-slate-50 rounded-b-xl"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      isAr
                        ? 'اكتب سؤالك أو صف المتطلب باللغة الطبيعية...'
                        : 'Ask about requirements, edge cases, or describe a feature need...'
                    }
                    className="flex-1 text-sm bg-white border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{chatLoading ? '...' : isAr ? 'إرسال' : 'Send'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* SECTION 3: PORTFOLIOS AND PROJECTS */}
          {activeNav === 'portfolios_projects' && (
            <div className="space-y-8">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'nav_portfolios_projects')}</h1>
                <p className="text-sm text-slate-600 mt-1">
                  {isAr
                    ? 'إدارة المحافظ الاستراتيجية والمشاريع والمشاريع الفرعية بهرمية واضحة ومعرفات مستقرة.'
                    : 'Manage hierarchical portfolios, projects, and subprojects with stable identifiers and status governance.'}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create Portfolio Form */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newPortfolioName.trim() || !currentUser) return;
                    const compId = await ensureTenantCompany();
                    const portId = sanitizeId(`port_${Date.now()}`);
                    const code = clampString(newPortfolioCode || `PF-${portfolios.length + 1}`, 32);
                    try {
                      await setDoc(doc(db, 'portfolios', portId), {
                        id: portId,
                        companyId: compId,
                        code,
                        name: clampString(newPortfolioName, 200),
                        description: clampString(newPortfolioDesc, 2000),
                        status: 'active',
                        ownerId: currentUser.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                      });
                      setNewPortfolioName('');
                      setNewPortfolioCode('');
                      setNewPortfolioDesc('');
                      await recordAuditLog('PORTFOLIO_CREATED', 'portfolio', portId, `Created portfolio ${code}`);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `portfolios/${portId}`);
                    }
                  }}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <h2 className="text-sm font-semibold text-slate-900">
                    {isAr ? 'إنشاء محفظة جديدة' : 'Create Strategic Portfolio'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={newPortfolioCode}
                      onChange={(e) => setNewPortfolioCode(e.target.value)}
                      placeholder="Code (e.g. PF-FIN-01)"
                      className="text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                    />
                    <input
                      type="text"
                      required
                      value={newPortfolioName}
                      onChange={(e) => setNewPortfolioName(e.target.value)}
                      placeholder={isAr ? 'اسم المحفظة' : 'Portfolio Name'}
                      className="sm:col-span-2 text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={newPortfolioDesc}
                    onChange={(e) => setNewPortfolioDesc(e.target.value)}
                    placeholder={isAr ? 'وصف المحفظة وأهدافها...' : 'Strategic scope and domain description...'}
                    className="w-full text-xs border border-slate-300 rounded-lg p-3"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                  >
                    {isAr ? 'حفظ المحفظة' : 'Add Portfolio'}
                  </button>
                </form>

                {/* Create Project / Subproject Form */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newProjectName.trim() || !currentUser) return;
                    const compId = await ensureTenantCompany();
                    const targetPortId = newProjectPortfolioId || portfolios[0]?.id;
                    if (!targetPortId) return;
                    const projId = sanitizeId(`proj_${Date.now()}`);
                    const code = clampString(newProjectCode || `PRJ-${projects.length + 101}`, 32);
                    try {
                      await setDoc(doc(db, 'projects', projId), {
                        id: projId,
                        companyId: compId,
                        portfolioId: targetPortId,
                        parentProjectId: newProjectParentId || '',
                        code,
                        name: clampString(newProjectName, 200),
                        description: clampString(newProjectDesc, 2000),
                        status: 'active',
                        ownerId: currentUser.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                      });
                      setNewProjectName('');
                      setNewProjectCode('');
                      setNewProjectDesc('');
                      await recordAuditLog('PROJECT_CREATED', 'project', projId, `Created project ${code}`);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `projects/${projId}`);
                    }
                  }}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <h2 className="text-sm font-semibold text-slate-900">
                    {isAr ? 'إنشاء مشروع أو مشروع فرعي' : 'Create Project or Subproject'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={newProjectCode}
                      onChange={(e) => setNewProjectCode(e.target.value)}
                      placeholder="Code (e.g. PRJ-105)"
                      className="text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                    />
                    <input
                      type="text"
                      required
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder={isAr ? 'اسم المشروع' : 'Project Name'}
                      className="sm:col-span-2 text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={newProjectPortfolioId}
                      onChange={(e) => setNewProjectPortfolioId(e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="">
                        {portfolios[0] ? `Default: ${portfolios[0].name}` : 'Create a portfolio first'}
                      </option>
                      {portfolios.map((pf) => (
                        <option key={pf.id} value={pf.id}>
                          {pf.code} — {pf.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newProjectParentId}
                      onChange={(e) => setNewProjectParentId(e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="">{isAr ? 'مشروع رئيسي (بدون أب)' : 'Top-Level Project (No Parent)'}</option>
                      {projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          Subproject of: {pr.code} — {pr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder={isAr ? 'نطاق المشروع...' : 'Project scope and objectives...'}
                    className="w-full text-xs border border-slate-300 rounded-lg p-3"
                  />
                  <button
                    type="submit"
                    disabled={portfolios.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
                  >
                    {isAr ? 'حفظ المشروع' : 'Add Project'}
                  </button>
                </form>
              </div>

              {/* Hierarchical Portfolio -> Project -> Subproject Listing */}
              <div className="space-y-4">
                {portfolios.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                    <p className="text-sm text-slate-600">
                      {isAr
                        ? 'لا توجد محافظ حالياً. يمكنك إنشاء محفظة أو تحميل البيانات التجريبية.'
                        : 'No portfolios initialized yet. Create your first portfolio above or load the labeled demo dataset.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleSeedDemo}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg"
                    >
                      {t(lang, 'demoDataBtn')}
                    </button>
                  </div>
                ) : (
                  portfolios.map((pf) => {
                    const pfProjects = projects.filter((p) => p.portfolioId === pf.id);
                    return (
                      <div key={pf.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                          <div>
                            <div className="text-xs text-slate-500">
                              <span className="font-mono font-semibold text-slate-800">{pf.code}</span>
                              <span> · </span>
                              <span>Status: {pf.status}</span>
                              <span> · </span>
                              <span className="tabular-nums">{pfProjects.length} Projects</span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900 mt-1">{pf.name}</h3>
                            <p className="text-xs text-slate-600 mt-0.5">{pf.description}</p>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {pfProjects.map((prj) => {
                            const prjArtifactsCount = artifacts.filter((a) => a.projectId === prj.id).length;
                            const parentPrj = projects.find((p) => p.id === prj.parentProjectId);
                            return (
                              <div key={prj.id} className="py-3 flex items-center justify-between gap-4">
                                <div>
                                  <div className="text-xs text-slate-500">
                                    <span className="font-mono font-semibold text-indigo-700">{prj.code}</span>
                                    <span> · </span>
                                    <span>{prj.status}</span>
                                    {parentPrj && (
                                      <>
                                        <span> · </span>
                                        <span>Subproject of {parentPrj.code}</span>
                                      </>
                                    )}
                                    <span> · </span>
                                    <span className="tabular-nums">{prjArtifactsCount} Artifacts</span>
                                  </div>
                                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{prj.name}</p>
                                  <p className="text-xs text-slate-600 mt-0.5">{prj.description}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOverrideProjectId(prj.id);
                                    setActiveNav('requirements');
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shrink-0"
                                >
                                  {isAr ? 'عرض المتطلبات' : 'View Artifacts'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SECTION 4: REQUIREMENTS & STRUCTURED ARTIFACTS */}
          {activeNav === 'requirements' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'nav_requirements')}</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    {isAr
                      ? 'السجل المهيكل لجميع احتياجات العمل، المتطلبات، قواعد العمل، قصص المستخدمين، معايير القبول، وحالات الاختبار.'
                      : 'Structured source-of-truth repository with stable IDs, versions, source references, and automated validation status.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewArtifactForm(!showNewArtifactForm)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAr ? 'إضافة مخرج مهيكل' : 'New Structured Artifact'}</span>
                </button>
              </div>

              {/* Create New Artifact Form */}
              {showNewArtifactForm && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await handleSaveSingleArtifact({
                      type: newArtType,
                      code: newArtCode,
                      title: newArtTitle,
                      description: newArtDesc,
                      rationale: newArtRationale,
                      projectId: newArtProjectId || projects[0]?.id || '',
                      sourceRefs: newArtSourceRefs
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    });
                    setNewArtCode('');
                    setNewArtTitle('');
                    setNewArtDesc('');
                    setNewArtRationale('');
                    setNewArtSourceRefs('');
                    setShowNewArtifactForm(false);
                  }}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    {isAr ? 'إضافة متطلب أو معيار قبول جديد' : 'Create Structured Lifecycle Artifact'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <select
                      value={newArtType}
                      onChange={(e) => setNewArtType(e.target.value as ArtifactType)}
                      className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      {Object.keys(artifactTypeLabels[lang]).map((k) => (
                        <option key={k} value={k}>
                          {artifactTypeLabels[lang][k as ArtifactType]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newArtCode}
                      onChange={(e) => setNewArtCode(e.target.value)}
                      placeholder="Stable ID (e.g. REQ-109)"
                      className="text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                    />
                    <select
                      value={newArtProjectId}
                      onChange={(e) => setNewArtProjectId(e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white sm:col-span-2"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    required
                    value={newArtTitle}
                    onChange={(e) => setNewArtTitle(e.target.value)}
                    placeholder={
                      isAr
                        ? 'عنوان المتطلب أو معيار القبول...'
                        : 'Clear, verifiable title (for Acceptance Criteria use Given / When / Then)...'
                    }
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                  <textarea
                    rows={3}
                    required
                    value={newArtDesc}
                    onChange={(e) => setNewArtDesc(e.target.value)}
                    placeholder={
                      isAr
                        ? 'التفاصيل والشروط القابلة للقياس...'
                        : 'Detailed specification with measurable thresholds...'
                    }
                    className="w-full text-xs border border-slate-300 rounded-lg p-3"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newArtRationale}
                      onChange={(e) => setNewArtRationale(e.target.value)}
                      placeholder={isAr ? 'المبرر التجاري أو التقني' : 'Business / Architectural Rationale'}
                      className="text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                    <input
                      type="text"
                      value={newArtSourceRefs}
                      onChange={(e) => setNewArtSourceRefs(e.target.value)}
                      placeholder="Source Refs comma-separated (e.g. BN-001, REQ-101)"
                      className="text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewArtifactForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Save Artifact
                    </button>
                  </div>
                </form>
              )}

              {/* Edit Artifact Modal/Card */}
              {editingArtifact && (
                <form
                  onSubmit={handleSaveEditedArtifact}
                  className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      {isAr ? 'تعديل وإعادة فحص الجودة:' : 'Revise & Re-Validate Artifact:'}{' '}
                      <span className="font-mono">{editingArtifact.code}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingArtifact(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Close
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={editingArtifact.title}
                    onChange={(e) => setEditingArtifact({ ...editingArtifact, title: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                  />
                  <textarea
                    rows={3}
                    required
                    value={editingArtifact.description}
                    onChange={(e) => setEditingArtifact({ ...editingArtifact, description: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-3"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
                    >
                      {isAr ? 'حفظ التعديل وإعادة الفحص الآلي' : 'Save Revision & Re-Run Quality Gate'}
                    </button>
                  </div>
                </form>
              )}

              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
                  <input
                    type="text"
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                    placeholder={isAr ? 'بحث بالرمز أو العنوان...' : 'Search by stable ID (REQ-101, AC-402) or keyword...'}
                    className="w-full text-xs border border-slate-300 rounded-lg ps-9 pe-3 py-2"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={reqTypeFilter}
                    onChange={(e) => setReqTypeFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="all">{isAr ? 'جميع الأنواع' : 'All Artifact Types'}</option>
                    {Object.keys(artifactTypeLabels[lang]).map((k) => (
                      <option key={k} value={k}>
                        {artifactTypeLabels[lang][k as ArtifactType]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={reqStatusFilter}
                    onChange={(e) => setReqStatusFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                    <option value="approved">Approved</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="revision_requested">Revision Requested</option>
                    <option value="draft">Draft</option>
                    <option value="excluded">Excluded</option>
                  </select>
                </div>
              </div>

              {/* High-Density Structured Artifacts Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4 text-start">ID & Version</th>
                        <th className="py-3 px-4 text-start">Type</th>
                        <th className="py-3 px-4 text-start">Specification & Traceability</th>
                        <th className="py-3 px-4 text-start">Automated Validation</th>
                        <th className="py-3 px-4 text-start">Approval Status</th>
                        <th className="py-3 px-4 text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredArtifacts.map((art) => (
                        <tr key={art.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap align-top">
                            <span className="font-semibold text-slate-900">{art.code}</span>
                            <span className="text-slate-400"> · v{art.version}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 align-top">
                            {artifactTypeLabels[lang][art.type] || art.type}
                          </td>
                          <td className="py-3.5 px-4 max-w-md align-top">
                            <p className="font-semibold text-slate-900">{art.title}</p>
                            <p className="text-slate-600 mt-1 leading-relaxed">{art.description}</p>
                            <div className="text-slate-400 mt-1.5 font-mono">
                              Sources: {art.sourceRefs.join(', ') || 'None'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs align-top">
                            <div className="flex items-center gap-1.5 font-medium">
                              {art.validationStatus === 'passed' && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                              {art.validationStatus === 'warning' && (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              )}
                              {art.validationStatus === 'failed' && (
                                <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              )}
                              <span
                                className={
                                  art.validationStatus === 'passed'
                                    ? 'text-emerald-700'
                                    : art.validationStatus === 'failed'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                                }
                              >
                                {art.validationStatus.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-slate-500 mt-1">{art.validationNotes}</p>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap align-top font-medium text-slate-800">
                            {art.status}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-end align-top">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingArtifact(art)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 rounded"
                                title="Edit & Re-Validate"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await deleteDoc(doc(db, 'artifacts', art.id));
                                    await recordAuditLog('ARTIFACT_DELETED', 'artifact', art.id, `Deleted ${art.code}`);
                                  } catch (err) {
                                    handleFirestoreError(err, OperationType.DELETE, `artifacts/${art.id}`);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: REVIEWS AND APPROVALS (Individual & Bulk Approval Gate) */}
          {activeNav === 'reviews_approvals' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'reviewsHeader')}</h1>
                  <p className="text-sm text-slate-600 mt-1 max-w-3xl">{t(lang, 'reviewsSubheader')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleBulkApprove}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 self-start"
                >
                  {t(lang, 'bulkApproveBtn')}
                </button>
              </div>

              {/* Bulk Approval Gate Report Explaining Eligible vs Excluded Acceptance Criteria */}
              {bulkGateReport && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{t(lang, 'ineligibleNoticeTitle')}</h3>
                    <button
                      type="button"
                      onClick={() => setBulkGateReport(null)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Dismiss
                    </button>
                  </div>
                  {bulkGateReport.approvedCodes.length > 0 && (
                    <p className="text-xs text-emerald-700 font-medium">
                      Approved ({bulkGateReport.approvedCodes.length}):{' '}
                      <span className="font-mono">{bulkGateReport.approvedCodes.join(', ')}</span>
                    </p>
                  )}
                  {bulkGateReport.excludedItems.length > 0 && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-red-900">
                        {isAr
                          ? 'تم استبعاد معايير القبول التالية تلقائياً لعدم اجتيازها فحص قابلية الاختبار:'
                          : 'The following Acceptance Criteria were explicitly excluded because they have not passed required validation:'}
                      </p>
                      <ul className="space-y-1.5 text-xs text-red-800">
                        {bulkGateReport.excludedItems.map((ex, i) => (
                          <li key={i}>
                            <strong className="font-mono">{ex.code}</strong> ({ex.title}): {ex.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Review Queue List */}
              <div className="space-y-3">
                {artifacts.map((art) => {
                  const isIneligibleAc =
                    art.type === 'acceptance_criteria' && art.validationStatus !== 'passed';
                  return (
                    <div
                      key={art.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <input
                          type="checkbox"
                          checked={!!selectedReviewIds[art.id]}
                          onChange={(e) =>
                            setSelectedReviewIds((prev) => ({ ...prev, [art.id]: e.target.checked }))
                          }
                          className="mt-1 rounded border-slate-300 text-indigo-600"
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-bold text-slate-900 tabular-nums">{art.code}</span>
                            <span>·</span>
                            <span>{artifactTypeLabels[lang][art.type]}</span>
                            <span>·</span>
                            <span>Current Status: {art.status}</span>
                            <span>·</span>
                            <span
                              className={
                                art.validationStatus === 'passed'
                                  ? 'text-emerald-700 font-semibold'
                                  : art.validationStatus === 'failed'
                                  ? 'text-red-700 font-semibold'
                                  : 'text-amber-700 font-semibold'
                              }
                            >
                              Automated Validation: {art.validationStatus.toUpperCase()}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900">{art.title}</h3>
                          <p className="text-xs text-slate-600 leading-relaxed">{art.description}</p>
                          <p className="text-xs text-slate-500">{art.validationNotes}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isIneligibleAc}
                          onClick={() => handleReviewDecision(art, 'approved')}
                          title={
                            isIneligibleAc
                              ? 'Cannot approve acceptance criteria that failed validation'
                              : 'Approve artifact'
                          }
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          {isIneligibleAc
                            ? isAr
                              ? 'محظور (فشل التحقق)'
                              : 'Blocked (Validation Failed)'
                            : t(lang, 'approveBtn')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewDecision(art, 'revision_requested')}
                          className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {t(lang, 'requestRevisionBtn')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewDecision(art, 'excluded')}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {t(lang, 'excludeBtn')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 6: KNOWLEDGE MEMORY (Hierarchical Company / Portfolio / Project Graph) */}
          {activeNav === 'knowledge_memory' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'nav_knowledge_memory')}</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    {isAr
                      ? 'ذاكرة المعرفة الهرمية على مستوى الشركة والمحفظة والمشروع مع تتبع العلاقات والمصادر.'
                      : 'Hierarchical institutional memory across Company, Portfolio, and Project scopes with traceability links.'}
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
                  {(['all', 'company', 'portfolio', 'project'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setMemoryLevel(lvl)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                        memoryLevel === lvl ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="text-xs font-semibold text-slate-500">Company-Level Governance Rules & Constraints</div>
                  {artifacts
                    .filter((a) => a.type === 'constraint' || a.type === 'business_rule')
                    .map((a) => (
                      <div key={a.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs font-mono font-semibold text-slate-800">
                          {a.code} · {a.status}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 mt-1">{a.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{a.description}</p>
                      </div>
                    ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="text-xs font-semibold text-slate-500">Architecture Decisions (ADRs) & API Contracts</div>
                  {artifacts
                    .filter((a) => a.type === 'architecture_decision' || a.type === 'api_spec')
                    .map((a) => (
                      <div key={a.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs font-mono font-semibold text-indigo-700">
                          {a.code} · v{a.version}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 mt-1">{a.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{a.description}</p>
                      </div>
                    ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="text-xs font-semibold text-slate-500">Traceability Matrix & Visual Assets</div>
                  {artifacts
                    .filter((a) => a.type === 'business_need' || a.type === 'visual_asset' || a.type === 'requirement')
                    .map((a) => (
                      <div key={a.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs font-mono font-semibold text-slate-800">
                          {a.code} · Sources: {a.sourceRefs.join(', ') || 'Root'}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 mt-1">{a.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{a.rationale}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: LIVING DOCUMENTS */}
          {activeNav === 'living_documents' && (
            <div className="space-y-6">
              <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'livingDocsHeader')}</h1>
                  <p className="text-sm text-slate-600 mt-1 max-w-3xl">{t(lang, 'livingDocsSubheader')}</p>
                </div>

                {/* Derive New Living Document Toolbar */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value as LivingDocType)}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    {Object.keys(livingDocTypeLabels[lang]).map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleDeriveLivingDocument(newDocType, newDocProjectId || projects[0]?.id || '')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                  >
                    {t(lang, 'deriveDocBtn')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 4 Cols: Document Catalog */}
                <div className="no-print lg:col-span-4 space-y-2.5">
                  {livingDocs.map((ld) => (
                    <button
                      key={ld.id}
                      type="button"
                      onClick={() => setSelectedDocId(ld.id)}
                      className={`w-full text-start p-4 rounded-xl border transition-colors ${
                        selectedDocId === ld.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs opacity-80 font-mono">
                        <span>{ld.code} · v{ld.version}</span>
                        <span>{ld.status}</span>
                      </div>
                      <p className="text-sm font-semibold mt-1">{ld.title}</p>
                      <p className="text-xs opacity-75 mt-1 font-mono truncate">
                        Sources: {ld.sourceArtifactIds.join(', ') || 'None'}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Right 8 Cols: Internal Document Editor, Sync Banner & Export */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  {livingDocs.find((d) => d.id === selectedDocId) ? (
                    <>
                      {livingDocs.find((d) => d.id === selectedDocId)?.status === 'needs_sync' && (
                        <div className="no-print p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
                          <div className="text-xs text-amber-900">
                            <strong>Upstream Knowledge Changed:</strong> One or more source artifacts linked to this
                            document were updated. Review and sync proposed changes—approved content is never silently
                            overwritten.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const currentDoc = livingDocs.find((d) => d.id === selectedDocId);
                              if (currentDoc) {
                                handleDeriveLivingDocument(currentDoc.docType, currentDoc.projectId);
                              }
                            }}
                            className="px-3 py-1.5 bg-amber-900 text-white text-xs font-medium rounded-lg shrink-0"
                          >
                            Propose Synced Revision
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                        <input
                          type="text"
                          value={docEditorTitle}
                          onChange={(e) => setDocEditorTitle(e.target.value)}
                          className="text-base font-bold text-slate-900 border-b border-transparent focus:border-indigo-600 focus:outline-none flex-1"
                        />
                        <div className="no-print flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateLivingDoc('draft')}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg"
                          >
                            Save Version
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLivingDoc('approved')}
                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                          >
                            Approve Document
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob([docEditorContent], { type: 'text/markdown;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${docEditorTitle || 'living-document'}.md`;
                              a.click();
                            }}
                            className="px-3 py-1.5 text-xs font-medium border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{t(lang, 'exportMarkdownBtn')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-3 py-1.5 text-xs font-medium border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{t(lang, 'exportPrintPdfBtn')}</span>
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={16}
                        value={docEditorContent}
                        onChange={(e) => setDocEditorContent(e.target.value)}
                        className="w-full font-mono text-xs leading-relaxed border border-slate-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />

                      <div className="no-print text-xs text-slate-500 flex items-center justify-between pt-2">
                        <span>
                          Note: Direct Markdown (.md) and Browser Print-to-PDF exports are enabled natively. External cloud DOCX conversion server is not configured; use Markdown export to import into Word/Docs.
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Select or derive a living document to edit.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 8: CHANGE IMPACT ANALYSIS */}
          {activeNav === 'change_impact' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'impactHeader')}</h1>
                <p className="text-sm text-slate-600 mt-1">{t(lang, 'impactSubheader')}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {isAr ? 'اختر المتطلب أو القاعدة المراد تغييرها' : 'Select Target Artifact to Modify'}
                    </label>
                    <select
                      value={impactTargetId}
                      onChange={(e) => setImpactTargetId(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 bg-white"
                    >
                      {artifacts.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.code}] {a.title} ({a.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {isAr ? 'وصف التغيير المقترح' : 'Proposed Change Request Description'}
                    </label>
                    <input
                      type="text"
                      value={proposedChangeText}
                      onChange={(e) => setProposedChangeText(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={impactLoading || artifacts.length === 0}
                  onClick={handleRunChangeImpact}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-2"
                >
                  {impactLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                  <span>{t(lang, 'runImpactBtn')}</span>
                </button>
              </div>

              {impactResult && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h2 className="text-base font-bold text-slate-900">Impact Assessment Report</h2>
                    <span className="text-xs font-mono uppercase font-semibold text-amber-800">
                      Risk Level: {impactResult.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{impactResult.executiveSummary}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold text-slate-900">Affected Downstream / Upstream Artifacts</h3>
                      {impactResult.affectedArtifacts.map((item, i) => (
                        <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                          <div className="text-xs font-mono font-bold text-slate-900">
                            {item.code} — {item.title}
                          </div>
                          <p className="text-xs text-slate-600">{item.impactReason}</p>
                          <p className="text-xs text-indigo-700 font-medium">
                            Proposed Revision: {item.recommendedUpdate}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold text-slate-900">Affected Living Document Sections</h3>
                      {impactResult.affectedDocumentSections.map((sec, i) => (
                        <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                          <div className="text-xs font-mono font-bold text-slate-900">
                            {sec.docCode} ({sec.docType}) · {sec.sectionName}
                          </div>
                          <p className="text-xs text-slate-600">{sec.proposedRevision}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 9: INTEGRATIONS & AI PROVIDER ABSTRACTION */}
          {activeNav === 'integrations' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'nav_integrations')}</h1>
                <p className="text-sm text-slate-600 mt-1">
                  {isAr
                    ? 'طبقة تجريد مزودي الذكاء الاصطناعي على الخادم، وتكاملات أنظمة إدارة المشاريع الخارجية.'
                    : 'Server-side AI Provider Abstraction Layer and external ALM/ticketing connectors.'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Server-Side AI Provider Abstraction Registry</h2>
                <p className="text-xs text-slate-600">
                  All model invocations execute strictly on the Node.js server runtime (`/api/ai/*`). Client bundles never
                  receive API keys, and tenant data is never used to train general models.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(providerRegistry?.providers || []).map((prov) => (
                    <div key={prov.id} className="p-4 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{prov.name}</span>
                        <span className="font-mono text-emerald-700">{prov.status}</span>
                      </div>
                      <div className="text-xs text-slate-600 font-mono space-y-1">
                        {Object.entries(prov.models || {}).map(([k, v]) => (
                          <div key={k}>
                            {k}: {v}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-slate-500">
                        Zero Customer Data Training Policy: Verified
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">External ALM & Knowledge Connectors</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {[
                    {
                      name: 'Atlassian Jira & Confluence',
                      status: 'Not Configured',
                      fallback:
                        'External OAuth/Webhook credentials are not configured in this environment. Use the JSON/CSV Export button below to import requirements and stories into Jira manually.',
                    },
                    {
                      name: 'Azure DevOps Boards',
                      status: 'Not Configured',
                      fallback:
                        'External PAT token is not configured. Use the structured JSON bundle export below for manual work-item synchronization.',
                    },
                    {
                      name: 'ERP & Core Banking Webhooks',
                      status: 'Specification Mode',
                      fallback:
                        'API contracts (e.g. API-701) are versioned in Living Documents and ready for OpenAPI/Markdown export.',
                    },
                  ].map((conn, idx) => (
                    <div key={idx} className="p-4 border border-slate-200 rounded-lg space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{conn.name}</span>
                          <span className="text-slate-500">{conn.status}</span>
                        </div>
                        <p className="text-slate-600 mt-2 leading-relaxed">{conn.fallback}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const exportPayload = JSON.stringify({ projects, artifacts }, null, 2);
                          const blob = new Blob([exportPayload], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `mizan-artifacts-export-${Date.now()}.json`;
                          a.click();
                        }}
                        className="mt-3 w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg text-center"
                      >
                        Download Manual JSON Export
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 10: COMPANY SETTINGS & MULTI-TENANT SECURITY */}
          {activeNav === 'company_settings' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'nav_company_settings')}</h1>
                <p className="text-sm text-slate-600 mt-1">
                  {t(lang, 'provisionCompanyNotice')}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Company Default AI Operating Mode & Privacy Governance */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900">
                    {isAr ? 'إعدادات الشركة الافتراضية وحوكمة البيانات' : 'Tenant AI Operating Mode & Privacy Governance'}
                  </h2>
                  {activeCompany ? (
                    <div className="space-y-4 text-xs">
                      <div>
                        <span className="text-slate-500">Company Name:</span>{' '}
                        <strong className="text-slate-900">{activeCompany.name}</strong>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Company Default AI Operating Mode
                        </label>
                        <select
                          value={activeCompany.defaultAiMode}
                          onChange={async (e) => {
                            const nextMode = e.target.value as AiOperatingMode;
                            try {
                              await updateDoc(doc(db, 'companies', activeCompany.id), {
                                name: activeCompany.name,
                                domain: activeCompany.domain,
                                defaultAiMode: nextMode,
                                privacyVerified: activeCompany.privacyVerified,
                                updatedAt: serverTimestamp(),
                              });
                              await recordAuditLog(
                                'COMPANY_DEFAULT_AI_MODE_CHANGED',
                                'company',
                                activeCompany.id,
                                `Updated company default AI mode to ${nextMode}`
                              );
                            } catch (err) {
                              handleFirestoreError(err, OperationType.UPDATE, `companies/${activeCompany.id}`);
                            }
                          }}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        >
                          <option value="assistant">{t(lang, 'mode_assistant')}</option>
                          <option value="workflow">{t(lang, 'mode_workflow')}</option>
                          <option value="multi_agent">{t(lang, 'mode_multi_agent')}</option>
                        </select>
                      </div>
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                        Data Handling Verification: Tenant knowledge records are isolated via Firestore security rules
                        and never used to train foundation models.
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No company provisioned yet.</p>
                  )}
                </div>

                {/* Platform Admin Exclusive Company Provisioning */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">{t(lang, 'provisionCompanyTitle')}</h2>
                    <span className="text-xs font-mono text-indigo-700">
                      {isPlatformAdmin ? 'Authorized: Platform Admin' : 'Restricted'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{t(lang, 'provisionCompanyNotice')}</p>

                  {isPlatformAdmin ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newCompanyName.trim() || !currentUser) return;
                        const compId = sanitizeId(`comp_${Date.now()}`);
                        try {
                          await setDoc(doc(db, 'companies', compId), {
                            id: compId,
                            name: clampString(newCompanyName, 200),
                            domain: clampString(newCompanyDomain || 'tenant.enterprise', 200),
                            defaultAiMode: 'workflow',
                            privacyVerified: true,
                            ownerId: currentUser.uid,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          });
                          setNewCompanyName('');
                          setNewCompanyDomain('');
                          await recordAuditLog(
                            'TENANT_COMPANY_PROVISIONED',
                            'company',
                            compId,
                            `Platform Admin provisioned company ${newCompanyName}`
                          );
                        } catch (err) {
                          handleFirestoreError(err, OperationType.CREATE, `companies/${compId}`);
                        }
                      }}
                      className="space-y-3"
                    >
                      <input
                        type="text"
                        required
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="New Tenant Company Legal Name"
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                      />
                      <input
                        type="text"
                        required
                        value={newCompanyDomain}
                        onChange={(e) => setNewCompanyDomain(e.target.value)}
                        placeholder="Corporate Domain (e.g. acme-corp.sa)"
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                      >
                        Provision Tenant Company
                      </button>
                    </form>
                  ) : (
                    <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600">
                      Public self-service company creation is disabled. Contact the Platform Administrator to provision
                      a new tenant organization.
                    </div>
                  )}
                </div>
              </div>

              {/* Immutable Security & Lifecycle Audit Log */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">
                  {isAr ? 'سجل التدقيق الأمني وتغييرات دورة الحياة (غير قابل للتعديل)' : 'Immutable Security & Lifecycle Audit History'}
                </h2>
                <div className="divide-y divide-slate-200 text-xs">
                  {auditLogs.length === 0 ? (
                    <p className="text-slate-500 py-2">No audit events recorded yet.</p>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-semibold text-slate-900">{log.action}</span>
                          <span className="text-slate-400"> · </span>
                          <span className="text-slate-600">{log.details}</span>
                        </div>
                        <div className="text-slate-400 font-mono shrink-0">
                          {log.actorEmail} · {log.targetType}/{log.targetId}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
