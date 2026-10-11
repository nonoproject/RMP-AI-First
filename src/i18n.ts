import { Language, NavSection, AiOperatingMode, ArtifactType, LivingDocType } from './types';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    appName: 'Mizan AI',
    appTagline: 'Requirements & Solution Lifecycle Platform',
    signInTitle: 'Enterprise Requirements & Solution Lifecycle Platform',
    signInSubtitle:
      'Transform natural-language business needs into structured, traceable, reviewable solution artifacts with multi-tenant governance.',
    signInWithGoogle: 'Sign in with Google Workspace',
    signOut: 'Sign Out',
    demoDataBtn: 'Load Labeled Demo Dataset',
    loadingWorkspace: 'Synchronizing tenant workspace...',
    // Navigation
    nav_ai_workspace: 'AI Workspace',
    nav_ai_conversation: 'AI Conversation',
    nav_portfolios_projects: 'Portfolios & Projects',
    nav_requirements: 'Requirements & Artifacts',
    nav_reviews_approvals: 'Reviews & Approvals',
    nav_knowledge_memory: 'Knowledge Memory',
    nav_living_documents: 'Living Documents',
    nav_change_impact: 'Change Impact Analysis',
    nav_integrations: 'Integrations & Providers',
    nav_company_settings: 'Company Settings',
    // Operating Modes
    mode_assistant: 'Assistant Mode',
    mode_workflow: 'Automated Workflow',
    mode_multi_agent: 'Multi-Agent Council',
    modeDesc_assistant: 'Step-by-step execution with human direction at each decision point.',
    modeDesc_workflow: 'Sequential 11-stage pipeline with automated validation and approval gates.',
    modeDesc_multi_agent: 'Cooperative BA, Solution Architect, and QA Validator agents reviewing outputs.',
    // AI Workspace
    intentHeader: 'Intent-Driven Solution Lifecycle',
    intentSubheader:
      'Describe your business need, problem, or opportunity in natural language. You do not need to pick a project first—AI infers context from your authorized knowledge.',
    intentPlaceholder:
      'Example: We need an instant B2B invoice factoring approval workflow for SME suppliers with automated KYC verification, Sharia-compliant fee calculation, and real-timeERP webhook notifications...',
    clarificationPlaceholder: 'Provide answers to the AI clarification questions so uncertain rules can be finalized...',
    runOrchestration: 'Orchestrate Lifecycle',
    runningOrchestration: 'Orchestrating 11-Stage Lifecycle...',
    inferredContextLabel: 'Inferred Project Context',
    overrideContextLabel: 'Override / Correct Target Project',
    autoInferOption: 'Auto-infer from authorized knowledge',
    taskOverrideMode: 'Task Mode Override (Does not alter company default)',
    lifecycleStagesTitle: '11-Stage AI Lifecycle Execution',
    pauseTask: 'Pause',
    resumeTask: 'Resume',
    retryTask: 'Retry',
    commitProposals: 'Save Selected Proposals as Pending Review',
    visionStudioTab: 'Visual Diagram & Image Intelligence',
    intentOrchestratorTab: 'Intent Orchestrator & Pipeline',
    // 11 Stages
    stage_1: '01. Understand Intent',
    stage_2: '02. Search Authorized Knowledge',
    stage_3: '03. Detect Missing / Conflicting Info',
    stage_4: '04. Targeted Clarifications',
    stage_5: '05. Plan Work & Expected Outputs',
    stage_6: '06. Generate Structured Artifacts',
    stage_7: '07. Validate Quality & Testability',
    stage_8: '08. Independent Multi-Agent Review',
    stage_9: '09. Present for Human Review',
    stage_10: '10. Apply Approved Changes Only',
    stage_11: '11. Update Traceability & Audit Log',
    // Reviews & Approvals
    reviewsHeader: 'Review & Approval Governance Gate',
    reviewsSubheader:
      'Automated quality validation is strictly separated from human approval. Acceptance criteria that fail validation cannot be approved.',
    bulkApproveBtn: 'Bulk Approve Eligible Artifacts',
    approveBtn: 'Approve',
    requestRevisionBtn: 'Request Revision',
    excludeBtn: 'Exclude',
    ineligibleNoticeTitle: 'Bulk Approval Gate Report',
    // Living Documents
    livingDocsHeader: 'Living Solution Documents',
    livingDocsSubheader:
      'Derived from structured, approved knowledge. When upstream requirements change, affected sections are flagged without silently overwriting approved content.',
    deriveDocBtn: 'Derive / Sync Document from Approved Knowledge',
    exportMarkdownBtn: 'Export Markdown',
    exportPrintPdfBtn: 'Print / Save PDF',
    // Change Impact
    impactHeader: 'Change Impact Analysis',
    impactSubheader:
      'Simulate downstream ripple effects across requirements, acceptance criteria, test cases, and living documents before approving a change.',
    runImpactBtn: 'Analyze Ripple Impact with Gemini 3.1 Pro',
    // Multi-tenant & Settings
    platformAdminBadge: 'Platform Admin',
    companyAdminBadge: 'Company Admin',
    provisionCompanyTitle: 'Platform Admin: Provision New Tenant Company',
    provisionCompanyNotice: 'Only the Platform Admin can create a company and invite its first Company Admin. Public self-service creation is disabled.',
  },
  ar: {
    appName: 'ميزان الذكي',
    appTagline: 'منصة إدارة دورة حياة المتطلبات والحلول',
    signInTitle: 'منصة المؤسسات لإدارة دورة حياة المتطلبات والحلول بالذكاء الاصطناعي',
    signInSubtitle:
      'حوّل احتياجات العمل والمشكلات والفرص المكتوبة باللغة الطبيعية إلى مخرجات ومواصفات مهيكلة وقابلة للتتبع والمراجعة.',
    signInWithGoogle: 'تسجيل الدخول عبر Google Workspace',
    signOut: 'تسجيل الخروج',
    demoDataBtn: 'تحميل بيانات تجريبية معنونة',
    loadingWorkspace: 'جاري مزامنة مساحة العمل المؤسسية...',
    // Navigation
    nav_ai_workspace: 'مساحة عمل الذكاء الاصطناعي',
    nav_ai_conversation: 'المحادثة الذكية',
    nav_portfolios_projects: 'المحافظ والمشاريع',
    nav_requirements: 'المتطلبات والمخرجات',
    nav_reviews_approvals: 'المراجعات والاعتمادات',
    nav_knowledge_memory: 'ذاكرة المعرفة المؤسسية',
    nav_living_documents: 'المستندات الحية',
    nav_change_impact: 'تحليل أثر التغيير',
    nav_integrations: 'التكاملات ومزودو الذكاء',
    nav_company_settings: 'إعدادات الشركة والحوكمة',
    // Operating Modes
    mode_assistant: 'وضع المساعد الموجه',
    mode_workflow: 'سير العمل الآلي المعتمد',
    mode_multi_agent: 'الوكلاء المتعددون (Multi-Agent)',
    modeDesc_assistant: 'تنفيذ خطوة بخطوة بتوجيه مباشر من المستخدم.',
    modeDesc_workflow: 'مراحل متسلسلة مع بوابات تحقق واعتماد بشري.',
    modeDesc_multi_agent: 'تعاون وكيل محلل الأعمال ومهندس الحلول ومراجع الجودة.',
    // AI Workspace
    intentHeader: 'دورة حياة الحلول القائمة على القصد (Intent-Driven AI)',
    intentSubheader:
      'اشرح احتياج العمل أو المشكلة باللغة الطبيعية دون الحاجة لاختيار مشروع مسبقاً؛ سيقوم النظام باستنتاج السياق من المعرفة المصرح بها.',
    intentPlaceholder:
      'مثال: نحتاج إلى نظام تمويل فواتير فوري للموردين من المنشآت الصغيرة والمتوسطة مع تحقق آلي من الهوية KYC، وحساب رسوم متوافق مع الضوابط الشرعية، وربط فوري مع نظام ERP...',
    clarificationPlaceholder: 'أدخل إجاباتك على أسئلة الاستيضاح لحسم القواعد غير المؤكدة...',
    runOrchestration: 'بدء هندسة المتطلبات والحلول',
    runningOrchestration: 'جاري تنفيذ مراحل دورة الحياة الـ 11...',
    inferredContextLabel: 'سياق المشروع المستنتج تلقائياً',
    overrideContextLabel: 'تصحيح أو تغيير المشروع المستهدف',
    autoInferOption: 'استنتاج تلقائي من قاعدة المعرفة',
    taskOverrideMode: 'تخصيص وضع التشغيل لهذه المهمة فقط',
    lifecycleStagesTitle: 'تقدم مراحل التنفيذ الإحدى عشرة',
    pauseTask: 'إيقاف مؤقت',
    resumeTask: 'استئناف',
    retryTask: 'إعادة المحاولة',
    commitProposals: 'حفظ المخرجات المقترحة للمراجعة البشرية',
    visionStudioTab: 'استوديو تحليل وتوليد المخططات والصور',
    intentOrchestratorTab: 'محرك القصد ومراحل التنفيذ',
    // 11 Stages
    stage_1: '01. فهم قصد المستخدم',
    stage_2: '02. البحث في المعرفة المصرح بها',
    stage_3: '03. كشف النواقص والتعارضات',
    stage_4: '04. طرح أسئلة الاستيضاح الموجهة',
    stage_5: '05. تخطيط العمل والمخرجات المتوقعة',
    stage_6: '06. توليد المخرجات المهيكلة',
    stage_7: '07. التحقق من الجودة وقابلية الاختبار',
    stage_8: '08. المراجعة المستقلة متعددة الوكلاء',
    stage_9: '09. العرض للمراجعة البشرية',
    stage_10: '10. تطبيق التغييرات المعتمدة فقط',
    stage_11: '11. تحديث الترابط وسجل التدقيق',
    // Reviews & Approvals
    reviewsHeader: 'بوابة المراجعة والاعتماد البشري',
    reviewsSubheader:
      'يتم فصل التحقق الآلي عن الاعتماد البشري. يُمنع اعتماد معايير القبول التي لم تجتز فحص قابلية الاختبار.',
    bulkApproveBtn: 'اعتماد جماعي للمخرجات المؤهلة',
    approveBtn: 'اعتماد',
    requestRevisionBtn: 'طلب تعديل',
    excludeBtn: 'استبعاد',
    ineligibleNoticeTitle: 'تقرير بوابة الاعتماد الجماعي',
    // Living Documents
    livingDocsHeader: 'المستندات الحية المشتقة',
    livingDocsSubheader:
      'مستندات مشتقة من المعرفة المعتمدة مع تتبع للمصادر وتنبيه بالأقسام المتأثرة عند تغير المتطلبات دون الكتابة الصامتة فوق المحتوى المعتمد.',
    deriveDocBtn: 'تحديث / اشتقاق المستند من المعرفة المعتمدة',
    exportMarkdownBtn: 'تصدير Markdown',
    exportPrintPdfBtn: 'طباعة / حفظ PDF',
    // Change Impact
    impactHeader: 'تحليل أثر التغيير',
    impactSubheader:
      'تحليل الارتباطات العلوية والسفلية وتقييم المخاطر والأقسام المتأثرة في المستندات قبل اعتماد أي طلب تغيير.',
    runImpactBtn: 'تحليل أثر التغيير عبر Gemini 3.1 Pro',
    // Multi-tenant & Settings
    platformAdminBadge: 'مدير المنصة العام',
    companyAdminBadge: 'مدير الشركة',
    provisionCompanyTitle: 'مدير المنصة: تأسيس شركة جديدة ودعوة مسؤولها الأول',
    provisionCompanyNotice: 'فقط مدير المنصة العام يمكنه إنشاء شركة جديدة ودعوة أول مدير لها. التسجيل الذاتي العام للشركات غير مسموح.',
  },
};

export const navItems: { id: NavSection; labelKey: string }[] = [
  { id: 'ai_workspace', labelKey: 'nav_ai_workspace' },
  { id: 'ai_conversation', labelKey: 'nav_ai_conversation' },
  { id: 'portfolios_projects', labelKey: 'nav_portfolios_projects' },
  { id: 'requirements', labelKey: 'nav_requirements' },
  { id: 'reviews_approvals', labelKey: 'nav_reviews_approvals' },
  { id: 'knowledge_memory', labelKey: 'nav_knowledge_memory' },
  { id: 'living_documents', labelKey: 'nav_living_documents' },
  { id: 'change_impact', labelKey: 'nav_change_impact' },
  { id: 'integrations', labelKey: 'nav_integrations' },
  { id: 'company_settings', labelKey: 'nav_company_settings' },
];

export const artifactTypeLabels: Record<Language, Record<ArtifactType, string>> = {
  en: {
    business_need: 'Business Need',
    requirement: 'Requirement',
    business_rule: 'Business Rule',
    user_story: 'User Story',
    acceptance_criteria: 'Acceptance Criteria',
    test_case: 'Test Case',
    architecture_decision: 'Architecture Decision (ADR)',
    api_spec: 'API & Integration Spec',
    assumption: 'Assumption',
    constraint: 'Constraint',
    change_request: 'Change Request',
    visual_asset: 'Visual Diagram / Asset',
  },
  ar: {
    business_need: 'احتياج عمل',
    requirement: 'متطلب وظيفي/غير وظيفي',
    business_rule: 'قاعدة عمل',
    user_story: 'قصة مستخدم',
    acceptance_criteria: 'معيار قبول',
    test_case: 'حالة اختبار',
    architecture_decision: 'قرار معماري (ADR)',
    api_spec: 'مواصفة واجهة برمجية API',
    assumption: 'افتراض',
    constraint: 'قيد',
    change_request: 'طلب تغيير',
    visual_asset: 'مخطط بصري / تصميم',
  },
};

export const livingDocTypeLabels: Record<Language, Record<LivingDocType, string>> = {
  en: {
    BRD: 'BRD — Business Requirements Document',
    FRD: 'FRD — Functional Requirements Document',
    SRS: 'SRS — Software Requirements Specification',
    BUSINESS_RULES: 'Business Rules Catalog',
    USER_STORIES: 'User Stories & Acceptance Criteria',
    ARCH_DECISIONS: 'Architecture Decisions (ADR)',
    API_SPECS: 'API & Integration Specifications',
    TEST_PLANS: 'Test Plans & Test Cases',
    SECURITY_NFR: 'Security & Non-Functional Requirements',
    HANDOVER: 'Implementation & Handover Documentation',
  },
  ar: {
    BRD: 'BRD — وثيقة متطلبات الأعمال',
    FRD: 'FRD — وثيقة المتطلبات الوظيفية',
    SRS: 'SRS — مواصفات متطلبات البرمجيات',
    BUSINESS_RULES: 'سجل قواعد العمل',
    USER_STORIES: 'قصص المستخدمين ومعايير القبول',
    ARCH_DECISIONS: 'القرارات المعمارية (ADR)',
    API_SPECS: 'مواصفات الواجهات والتكامل API',
    TEST_PLANS: 'خطط وحالات الاختبار',
    SECURITY_NFR: 'الأمان والمتطلبات غير الوظيفية',
    HANDOVER: 'وثائق التنفيذ والتسليم',
  },
};

export function t(lang: Language, key: string): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}
