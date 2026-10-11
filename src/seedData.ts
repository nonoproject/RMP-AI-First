import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

/**
 * Seeds a clearly labeled Demo Enterprise Dataset into Firestore for the authenticated user.
 * Follows the exact parent-child relational order mandated by firestore.rules.
 */
export async function seedDemoWorkspace(uid: string, email: string, displayName: string) {
  const companyId = `comp_${uid.slice(0, 12)}`;
  const isPlatformAdmin = email === 'awadsandal2@gmail.com';

  // 1. Company
  try {
    await setDoc(doc(db, 'companies', companyId), {
      id: companyId,
      name: '[DEMO] Al-Mizan Financial & Logistics Holdings',
      domain: 'almizan-enterprise.example',
      defaultAiMode: 'workflow',
      privacyVerified: true,
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `companies/${companyId}`);
  }

  // 2. User Profile
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: email || 'user@almizan.example',
      displayName: displayName || 'Enterprise Architect',
      role: isPlatformAdmin ? 'platform_admin' : 'company_admin',
      companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }

  // 3. Portfolios
  const port1Id = `port_fin_${uid.slice(0, 8)}`;
  const port2Id = `port_log_${uid.slice(0, 8)}`;

  try {
    await setDoc(doc(db, 'portfolios', port1Id), {
      id: port1Id,
      companyId,
      code: 'PF-FIN-01',
      name: '[DEMO] Digital Treasury & B2B Trade Finance',
      description: 'Core banking, SME invoice factoring, automated KYC/AML compliance, and instant settlement gateways.',
      status: 'active',
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'portfolios', port2Id), {
      id: port2Id,
      companyId,
      code: 'PF-LOG-02',
      name: '[DEMO] Cold-Chain & Customs Automation',
      description: 'IoT temperature telemetry, GCC customs clearance integration, and warehouse fulfillment SLA tracking.',
      status: 'planning',
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'portfolios');
  }

  // 4. Projects & Subprojects
  const proj1Id = `proj_factoring_${uid.slice(0, 8)}`;
  const proj2Id = `proj_kyc_sub_${uid.slice(0, 8)}`;
  const proj3Id = `proj_customs_${uid.slice(0, 8)}`;

  try {
    await setDoc(doc(db, 'projects', proj1Id), {
      id: proj1Id,
      companyId,
      portfolioId: port1Id,
      parentProjectId: '',
      code: 'PRJ-FAC-100',
      name: '[DEMO] SME Instant Invoice Factoring Platform',
      description: 'End-to-end B2B invoice discounting with ERP integration, credit risk scoring, and Sharia-compliant fee structures.',
      status: 'active',
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'projects', proj2Id), {
      id: proj2Id,
      companyId,
      portfolioId: port1Id,
      parentProjectId: proj1Id,
      code: 'SUB-KYC-101',
      name: '[DEMO] Subproject: Automated KYB & Beneficial Owner Verification',
      description: 'Real-time commercial registry lookup and sanctions screening subproject under SME Factoring.',
      status: 'delivery',
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'projects', proj3Id), {
      id: proj3Id,
      companyId,
      portfolioId: port2Id,
      parentProjectId: '',
      code: 'PRJ-CLD-200',
      name: '[DEMO] Smart Cold-Chain Excursion Alerting',
      description: 'Automated pharmaceutical shipment quarantine workflows when IoT thermal sensors breach thresholds.',
      status: 'discovery',
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'projects');
  }

  // 5. Structured Artifacts (Requirements, Business Rules, User Stories, Acceptance Criteria, Test Cases, ADRs, APIs)
  const artIds = {
    bn1: `art_bn1_${uid.slice(0, 8)}`,
    req1: `art_req1_${uid.slice(0, 8)}`,
    br1: `art_br1_${uid.slice(0, 8)}`,
    us1: `art_us1_${uid.slice(0, 8)}`,
    ac1Pass: `art_ac1_${uid.slice(0, 8)}`,
    ac2Fail: `art_ac2_${uid.slice(0, 8)}`,
    tc1: `art_tc1_${uid.slice(0, 8)}`,
    adr1: `art_adr1_${uid.slice(0, 8)}`,
    api1: `art_api1_${uid.slice(0, 8)}`,
    con1: `art_con1_${uid.slice(0, 8)}`,
  };

  const demoArtifacts = [
    {
      id: artIds.bn1,
      code: 'BN-001',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'business_need',
      title: '[DEMO] Reduce SME supplier invoice payout cycle from 60 days to under 4 hours',
      description:
        'SME suppliers face liquidity bottlenecks waiting 60-90 days for anchor buyer settlement. Providing automated invoice financing within 4 hours increases supplier retention by 35%.',
      rationale: 'Strategic Treasury KPI Q4: Capture $120M in annualized B2B factoring volume.',
      status: 'approved',
      validationStatus: 'passed',
      validationNotes: 'Passed completeness, quantification, and executive alignment checks.',
      version: 2,
      sourceRefs: ['EXEC-BRIEF-2026-Q4'],
      linkedArtifactIds: [artIds.req1, artIds.br1],
      authorId: uid,
    },
    {
      id: artIds.req1,
      code: 'REQ-101',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'requirement',
      title: '[DEMO] Automated E-Invoice Cryptographic Hash & Buyer ERP Reconciliation',
      description:
        'The platform shall validate uploaded ZATCA/fatoora XML e-invoices by verifying the cryptographic stamp and querying the Anchor Buyer ERP webhook within 3000ms before credit scoring.',
      rationale: 'Prevents duplicate or fraudulent invoice financing across multiple lenders.',
      status: 'approved',
      validationStatus: 'passed',
      validationNotes: 'Passed testability (3000ms SLA) and upstream traceability to BN-001.',
      version: 1,
      sourceRefs: ['BN-001'],
      linkedArtifactIds: [artIds.bn1, artIds.us1, artIds.ac1Pass, artIds.api1],
      authorId: uid,
    },
    {
      id: artIds.br1,
      code: 'BR-201',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'business_rule',
      title: '[DEMO] Maximum Single-Debtor Exposure Cap (15% of Pool)',
      description:
        'No single Anchor Buyer shall exceed 15% of the active factoring liquidity pool. Invoices exceeding this concentration limit must route to Risk Committee manual review.',
      rationale: 'Central Bank prudential credit concentration regulation.',
      status: 'approved',
      validationStatus: 'passed',
      validationNotes: 'Explicit numerical threshold (15%) verified.',
      version: 1,
      sourceRefs: ['BN-001', 'REG-CB-44'],
      linkedArtifactIds: [artIds.bn1, artIds.ac1Pass],
      authorId: uid,
    },
    {
      id: artIds.us1,
      code: 'US-301',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'user_story',
      title: '[DEMO] As an SME Finance Manager, I want instant discounting offers on verified invoices',
      description:
        'As an SME Finance Manager, when I submit a buyer-approved e-invoice, I want to view the net payout amount and fixed administrative fee immediately so I can accept liquidity in one click.',
      rationale: 'Core self-service supplier conversion journey.',
      status: 'pending_review',
      validationStatus: 'passed',
      validationNotes: 'Follows standard role-feature-reason user story template with linked AC.',
      version: 1,
      sourceRefs: ['REQ-101'],
      linkedArtifactIds: [artIds.req1, artIds.ac1Pass, artIds.ac2Fail],
      authorId: uid,
    },
    {
      id: artIds.ac1Pass,
      code: 'AC-401',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'acceptance_criteria',
      title: '[DEMO] Given a verified XML invoice under 15% debtor cap, When submitted, Then offer renders in <= 2.5s',
      description:
        'Given an authenticated SME supplier submits a cryptographically valid e-invoice where buyer exposure is <= 15%, When the ERP reconciliation API returns HTTP 200, Then the system must calculate and display the net payout within 2500ms.',
      rationale: 'Verifies both REQ-101 latency and BR-201 concentration rule.',
      status: 'pending_review',
      validationStatus: 'passed',
      validationNotes: 'Passed Testability Gate: Contains explicit Given/When/Then conditions and measurable 2500ms threshold.',
      version: 1,
      sourceRefs: ['REQ-101', 'BR-201', 'US-301'],
      linkedArtifactIds: [artIds.req1, artIds.br1, artIds.us1, artIds.tc1],
      authorId: uid,
    },
    {
      id: artIds.ac2Fail,
      code: 'AC-402',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'acceptance_criteria',
      title: '[DEMO] System should be very fast and user-friendly during high traffic',
      description:
        'The invoice dashboard should load quickly and be easy and seamless for users even when many suppliers log in.',
      rationale: 'Drafted from initial stakeholder interview—needs concrete SLA quantification.',
      status: 'pending_review',
      validationStatus: 'failed',
      validationNotes:
        'Failed Testability Gate: Contains subjective terms ("fast", "easy", "seamless") without measurable Given/When/Then criteria or latency/concurrency numbers. Approval is blocked until revised.',
      version: 1,
      sourceRefs: ['US-301'],
      linkedArtifactIds: [artIds.us1],
      authorId: uid,
    },
    {
      id: artIds.tc1,
      code: 'TC-501',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'test_case',
      title: '[DEMO] E2E Test: Valid ZATCA XML Invoice Submission & Concentration Check',
      description:
        '1. Upload signed XML invoice #INV-9921 ($45,000). 2. Mock ERP webhook 200 OK in 420ms. 3. Assert debtor pool utilization is 11.4% (<15%). 4. Assert payout offer modal displays within 2.5s.',
      rationale: 'Automated regression test covering AC-401.',
      status: 'pending_review',
      validationStatus: 'passed',
      validationNotes: 'Deterministic test steps and assertions linked to AC-401.',
      version: 1,
      sourceRefs: ['AC-401'],
      linkedArtifactIds: [artIds.ac1Pass],
      authorId: uid,
    },
    {
      id: artIds.adr1,
      code: 'ADR-601',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'architecture_decision',
      title: '[DEMO] Event-Driven Idempotent Ledger using Outbox Pattern',
      description:
        'All invoice state transitions and disbursement instructions shall be persisted atomically with an outbox event table to guarantee exactly-once settlement instruction delivery to the payment rail.',
      rationale: 'Eliminates dual-write race conditions during bank API timeouts.',
      status: 'approved',
      validationStatus: 'passed',
      validationNotes: 'Reviewed by Solution Architecture Agent.',
      version: 1,
      sourceRefs: ['REQ-101'],
      linkedArtifactIds: [artIds.req1, artIds.api1],
      authorId: uid,
    },
    {
      id: artIds.api1,
      code: 'API-701',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'api_spec',
      title: '[DEMO] POST /v1/factoring/invoices/verify — Anchor ERP Verification Webhook',
      description:
        'Accepts { invoiceUuid, sha256Hash, buyerTaxId, grossAmount, currency }. Requires mTLS + HMAC-SHA256 signature header X-Mizan-Signature. Returns { verified: boolean, erpVoucherId: string, disputeFlag: boolean }.',
      rationale: 'Contract for Anchor Buyer ERP integration.',
      status: 'approved',
      validationStatus: 'passed',
      validationNotes: 'Complete request/response payload and security header specification.',
      version: 1,
      sourceRefs: ['REQ-101', 'ADR-601'],
      linkedArtifactIds: [artIds.req1, artIds.adr1],
      authorId: uid,
    },
    {
      id: artIds.con1,
      code: 'CON-801',
      companyId,
      portfolioId: port1Id,
      projectId: proj1Id,
      type: 'constraint',
      title: '[DEMO] In-Kingdom Data Residency & Zero External AI Model Training',
      description:
        'All financial records, KYB documents, and requirement specifications must reside in approved regional cloud zones and must never be used to train public foundation models.',
      rationale: 'Mandatory regulatory data sovereignty compliance.',
      status: 'approved',
      validationStatus: 'passed',
      validationNotes: 'Verified against platform security controls.',
      version: 1,
      sourceRefs: ['REG-NDMO-09'],
      linkedArtifactIds: [artIds.bn1],
      authorId: uid,
    },
  ];

  try {
    for (const art of demoArtifacts) {
      await setDoc(doc(db, 'artifacts', art.id), {
        ...art,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'artifacts');
  }

  // 6. Living Documents
  const docBrdId = `doc_brd_${uid.slice(0, 8)}`;
  const docFrdId = `doc_frd_${uid.slice(0, 8)}`;
  const docSrsId = `doc_srs_${uid.slice(0, 8)}`;

  const demoDocs = [
    {
      id: docBrdId,
      code: 'DOC-BRD-01',
      companyId,
      projectId: proj1Id,
      docType: 'BRD',
      title: '[DEMO] BRD — SME Instant Invoice Factoring Platform',
      content: `# Business Requirements Document (BRD)
## 1. Executive Summary & Business Need (Source: BN-001)
SME suppliers experience 60-90 day cash-flow gaps waiting for invoice settlement. This platform reduces payout turnaround to under 4 hours.

## 2. Core Business Rules (Source: BR-201)
- **BR-201 Single-Debtor Concentration Cap**: No single Anchor Buyer may represent more than 15% of active pool liquidity.

## 3. Regulatory & Sovereignty Constraints (Source: CON-801)
- **CON-801**: Strict regional data residency and zero training on tenant data.`,
      status: 'approved',
      version: 2,
      sourceArtifactIds: ['BN-001', 'BR-201', 'CON-801'],
      authorId: uid,
    },
    {
      id: docFrdId,
      code: 'DOC-FRD-01',
      companyId,
      projectId: proj1Id,
      docType: 'FRD',
      title: '[DEMO] FRD — Functional & Verification Specifications',
      content: `# Functional Requirements Document (FRD)
## 1. E-Invoice Cryptographic & ERP Reconciliation (Source: REQ-101)
- Validates ZATCA XML cryptographic stamp.
- Queries Anchor Buyer ERP via \`POST /v1/factoring/invoices/verify\` (Source: API-701) within 3000ms.

## 2. User Journey & Acceptance Criteria (Source: US-301, AC-401)
- **US-301**: Instant discounting offer display for SME Finance Managers.
- **AC-401**: Given verified XML invoice <= 15% debtor cap, When ERP returns HTTP 200, Then net payout renders within 2500ms.`,
      status: 'approved',
      version: 1,
      sourceArtifactIds: ['REQ-101', 'US-301', 'AC-401', 'API-701'],
      authorId: uid,
    },
    {
      id: docSrsId,
      code: 'DOC-SRS-01',
      companyId,
      projectId: proj1Id,
      docType: 'SRS',
      title: '[DEMO] SRS — Software Architecture & API Specification',
      content: `# Software Requirements Specification (SRS)
## 1. Architectural Pattern (Source: ADR-601)
- Event-driven idempotent ledger utilizing the transactional Outbox pattern.

## 2. External Interfaces (Source: API-701)
- Endpoint: \`POST /v1/factoring/invoices/verify\`
- Security: mTLS + \`X-Mizan-Signature\` HMAC-SHA256 header.

## 3. Verification & Test Plan Link (Source: TC-501)
- Covered by automated E2E scenario TC-501.`,
      status: 'needs_sync',
      version: 1,
      sourceArtifactIds: ['ADR-601', 'API-701', 'TC-501'],
      authorId: uid,
    },
  ];

  try {
    for (const d of demoDocs) {
      await setDoc(doc(db, 'livingDocuments', d.id), {
        ...d,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'livingDocuments');
  }

  // 7. Initial AI Task Record
  const task1Id = `task_demo_${uid.slice(0, 8)}`;
  try {
    await setDoc(doc(db, 'aiTasks', task1Id), {
      id: task1Id,
      companyId,
      projectId: proj1Id,
      intent: '[DEMO] Automate SME e-invoice verification against Anchor Buyer ERP with concentration risk guardrails.',
      inferredContext: 'Inferred Project: PRJ-FAC-100 ([DEMO] SME Instant Invoice Factoring Platform) · Confidence: 96%',
      mode: 'multi_agent',
      currentStage: 9,
      status: 'awaiting_approval',
      clarificationQuestions: '1. Should invoices exceeding the 15% debtor cap be partially funded up to the cap or routed in full to manual review?',
      planSummary: 'BA Agent extracted BN-001 & BR-201; Architect Agent defined ADR-601 & API-701; QA Agent validated AC-401 (Passed) and flagged AC-402 (Failed testability).',
      generatedArtifactIds: ['BN-001', 'REQ-101', 'BR-201', 'US-301', 'AC-401', 'AC-402'],
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'aiTasks');
  }

  // 8. Audit Log Entry
  const log1Id = `log_init_${Date.now()}`;
  try {
    await setDoc(doc(db, 'auditLogs', log1Id), {
      id: log1Id,
      companyId,
      actorId: uid,
      actorEmail: email || 'user@almizan.example',
      action: 'DEMO_DATASET_INITIALIZED',
      targetType: 'company',
      targetId: companyId,
      details: 'Initialized labeled [DEMO] enterprise portfolios, projects, traceable artifacts, and living documents.',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'auditLogs');
  }
}
