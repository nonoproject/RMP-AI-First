import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OrchestrateParams {
  intent: string;
  language?: string;
  mode?: string;
  projects?: Record<string, unknown>[];
  existingArtifacts?: Record<string, unknown>[];
  clarificationAnswers?: string;
}

interface ChatParams {
  messages: { role: string; content: string }[];
  language?: string;
  projectContext?: unknown;
  artifactsContext?: unknown[];
}

interface AnalyzeImageParams {
  base64Image: string;
  mimeType?: string;
  prompt?: string;
  language?: string;
  projectContext?: unknown;
}

interface GenerateImageParams {
  prompt: string;
  base64Image?: string;
  mimeType?: string;
  aspectRatio?: string;
  imageSize?: string;
}

interface ImpactParams {
  targetArtifact: unknown;
  proposedChange: string;
  allArtifacts?: unknown[];
  livingDocs?: Record<string, unknown>[];
  language?: string;
}

/**
 * Provider Abstraction Layer
 * Allows additional AI providers to be registered and swapped without changing business or UI layers.
 */
class GeminiAIProvider {
  id = 'google-gemini';
  name = 'Google Gemini Enterprise Gateway';
  trainsOnTenantData = false;

  getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async orchestrateIntent({
    intent,
    language,
    mode,
    projects,
    existingArtifacts,
    clarificationAnswers,
  }: OrchestrateParams) {
    const ai = this.getClient();
    const langInstruction =
      language === 'ar'
        ? 'Respond with all human-readable titles, descriptions, rationales, questions, and summaries in professional Arabic.'
        : 'Respond with all human-readable titles, descriptions, rationales, questions, and summaries in clear professional English.';

    const contextSummary = JSON.stringify({
      availableProjects: (projects || []).map((p: Record<string, unknown>) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        portfolioId: p.portfolioId,
        description: p.description,
      })),
      existingArtifactsSample: (existingArtifacts || []).slice(0, 20).map((a: Record<string, unknown>) => ({
        code: a.code,
        type: a.type,
        title: a.title,
        projectId: a.projectId,
        status: a.status,
      })),
      clarificationAnswers: clarificationAnswers || '',
      operatingMode: mode || 'workflow',
    });

    const systemInstruction = `You are the AI Orchestration Engine for Mizan AI, an enterprise Requirements & Solution Lifecycle Platform.
${langInstruction}
Follow these strict lifecycle rules:
1. Do NOT invent missing material business rules or technical decisions. If critical details are ambiguous and no clarificationAnswers were provided yet, list 1 to 3 targeted clarificationQuestions and keep uncertain artifacts marked with validationStatus="warning" or "failed".
2. Infer the most relevant project from availableProjects based on the user's natural-language intent.
3. Decompose the user's intent into structured, traceable artifacts across the lifecycle:
   - business_need
   - requirement
   - business_rule
   - user_story
   - acceptance_criteria (Must be testable using Given/When/Then or measurable thresholds. If vague or untestable, set validationStatus="failed" and explain why in validationNotes so human approval is blocked until resolved.)
   - test_case
   - architecture_decision
   - api_spec
   - assumption
   - constraint
4. Validate every generated artifact for completeness, duplication against existingArtifactsSample, contradictions, testability, and traceability.
5. Include independent multi-agent review findings (Business Analyst Agent, Solution Architect Agent, QA Validator Agent).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `User Intent:\n${intent}\n\nAuthorized Workspace Context:\n${contextSummary}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            inferredProjectId: {
              type: Type.STRING,
              description: 'ID of the best matching project from availableProjects, or empty string if none matches.',
            },
            inferredProjectReasoning: {
              type: Type.STRING,
              description: 'Explanation of why this project/portfolio context was inferred from the intent.',
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: 'Confidence from 0 to 100 in the inferred context.',
            },
            needsClarification: {
              type: Type.BOOLEAN,
              description: 'True if material ambiguity exists that requires user clarification before final approval.',
            },
            clarificationQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Targeted questions for missing or conflicting business rules.',
            },
            planSummary: {
              type: Type.STRING,
              description: 'Structured execution plan and independent review summary across BA, Architect, and QA roles.',
            },
            stageLogs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stageNumber: { type: Type.INTEGER },
                  stageName: { type: Type.STRING },
                  agentRole: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  status: { type: Type.STRING },
                },
                required: ['stageNumber', 'stageName', 'agentRole', 'summary', 'status'],
              },
            },
            proposedArtifacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    description:
                      'One of: business_need, requirement, business_rule, user_story, acceptance_criteria, test_case, architecture_decision, api_spec, assumption, constraint',
                  },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  validationStatus: {
                    type: Type.STRING,
                    description: 'passed, warning, or failed',
                  },
                  validationNotes: {
                    type: Type.STRING,
                    description: 'Automated quality check details (completeness, testability, duplication, traceability).',
                  },
                  sourceRefs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['code', 'type', 'title', 'description', 'rationale', 'validationStatus', 'validationNotes', 'sourceRefs'],
              },
            },
          },
          required: [
            'inferredProjectId',
            'inferredProjectReasoning',
            'confidenceScore',
            'needsClarification',
            'clarificationQuestions',
            'planSummary',
            'stageLogs',
            'proposedArtifacts',
          ],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  async chatWithContext({ messages, language, projectContext, artifactsContext }: ChatParams) {
    const ai = this.getClient();
    const langInstruction =
      language === 'ar'
        ? 'Respond in fluent, professional Arabic. Cite artifact codes (e.g., REQ-101, BR-201) where relevant.'
        : 'Respond in clear, professional English. Cite artifact codes (e.g., REQ-101, BR-201) where relevant.';

    const systemInstruction = `You are the Mizan AI Requirements & Solution Lifecycle Assistant.
${langInstruction}
You help product managers, business analysts, architects, and QA engineers refine business needs, uncover missing business rules, write testable Given/When/Then acceptance criteria, and trace dependencies.
Never fabricate business policy—point out ambiguities and suggest concrete, reviewable options.
Current Project Context: ${JSON.stringify(projectContext || {})}
Authorized Knowledge Artifacts: ${JSON.stringify((artifactsContext || []).slice(0, 25))}`;

    const formattedContents = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: formattedContents.length > 0 ? formattedContents : 'Hello',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            inferredContextNote: { type: Type.STRING },
            clarificationQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedArtifacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  validationStatus: { type: Type.STRING },
                  validationNotes: { type: Type.STRING },
                },
                required: ['type', 'title', 'description', 'rationale', 'validationStatus', 'validationNotes'],
              },
            },
          },
          required: ['reply', 'inferredContextNote', 'clarificationQuestions', 'suggestedArtifacts'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  async analyzeImage({ base64Image, mimeType, prompt, language, projectContext }: AnalyzeImageParams) {
    const ai = this.getClient();
    const cleanBase64 = String(base64Image || '').replace(/^data:[^;]+;base64,/, '');
    const langInstruction =
      language === 'ar'
        ? 'Provide the analysis and extracted requirements in professional Arabic.'
        : 'Provide the analysis and extracted requirements in professional English.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: `${prompt || 'Analyze this diagram, whiteboard, or interface image and extract structured requirements, business rules, and acceptance criteria.'}\n\nProject Context: ${JSON.stringify(projectContext || {})}\n${langInstruction}`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            detectedElements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            ambiguitiesOrRisks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            extractedArtifacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  validationStatus: { type: Type.STRING },
                  validationNotes: { type: Type.STRING },
                },
                required: ['type', 'title', 'description', 'rationale', 'validationStatus', 'validationNotes'],
              },
            },
          },
          required: ['summary', 'detectedElements', 'ambiguitiesOrRisks', 'extractedArtifacts'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  async generateOrEditImage({ prompt, base64Image, mimeType, aspectRatio, imageSize }: GenerateImageParams) {
    const ai = this.getClient();
    const parts: Record<string, unknown>[] = [];

    if (base64Image) {
      const cleanBase64 = String(base64Image).replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/png',
        },
      });
    }

    parts.push({
      text: prompt || 'Clean enterprise solution architecture diagram, high contrast, legible labels, modern technical blueprint style.',
    });

    const response = await ai.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || '16:9',
          imageSize: imageSize || '1K',
        },
      },
    });

    let imageUrl = '';
    let captionText = '';

    const candidateParts = response.candidates?.[0]?.content?.parts || [];
    for (const part of candidateParts) {
      if (part.inlineData?.data) {
        const outMime = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${outMime};base64,${part.inlineData.data}`;
      } else if (part.text) {
        captionText += part.text;
      }
    }

    if (!imageUrl) {
      throw new Error('Model did not return an image part. Try refining the visual prompt.');
    }

    return {
      imageUrl,
      captionText,
      modelUsed: 'gemini-nano-banana-2.1',
    };
  }

  async analyzeChangeImpact({ targetArtifact, proposedChange, allArtifacts, livingDocs, language }: ImpactParams) {
    const ai = this.getClient();
    const langInstruction =
      language === 'ar'
        ? 'Provide the impact assessment in professional Arabic.'
        : 'Provide the impact assessment in professional English.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Target Artifact: ${JSON.stringify(targetArtifact)}\nProposed Change: ${proposedChange}\nAll Project Artifacts: ${JSON.stringify(
        (allArtifacts || []).slice(0, 30)
      )}\nLiving Documents: ${JSON.stringify(
        (livingDocs || []).map((d: Record<string, unknown>) => ({
          id: d.id,
          code: d.code,
          docType: d.docType,
          title: d.title,
          sourceArtifactIds: d.sourceArtifactIds,
        }))
      )}\n${langInstruction}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, description: 'low, medium, high, or critical' },
            executiveSummary: { type: Type.STRING },
            affectedArtifacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  title: { type: Type.STRING },
                  impactReason: { type: Type.STRING },
                  recommendedUpdate: { type: Type.STRING },
                },
                required: ['code', 'title', 'impactReason', 'recommendedUpdate'],
              },
            },
            affectedDocumentSections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  docCode: { type: Type.STRING },
                  docType: { type: Type.STRING },
                  sectionName: { type: Type.STRING },
                  proposedRevision: { type: Type.STRING },
                },
                required: ['docCode', 'docType', 'sectionName', 'proposedRevision'],
              },
            },
          },
          required: ['riskLevel', 'executiveSummary', 'affectedArtifacts', 'affectedDocumentSections'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }
}

const activeProvider = new GeminiAIProvider();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  app.get('/api/ai/providers', (_req, res) => {
    res.json({
      activeProviderId: activeProvider.id,
      privacyPolicyEnforced: true,
      trainsOnCustomerData: false,
      providers: [
        {
          id: 'google-gemini',
          name: 'Google Gemini Server-Side Runtime',
          status: process.env.GEMINI_API_KEY ? 'connected' : 'missing_key',
          models: {
            reasoningAndLifecycle: 'gemini-3.1-pro-preview',
            imageUnderstanding: 'gemini-3.1-pro-preview',
            imageGenerationAndEditing: 'gemini-nano-banana-2.1',
          },
          zeroTrainingGuarantee: true,
        },
        {
          id: 'vertex-enterprise-adapter',
          name: 'Vertex AI Custom Endpoint (Provider Abstraction Ready)',
          status: 'standby',
          models: {
            reasoningAndLifecycle: 'Configurable via Provider Interface',
          },
          zeroTrainingGuarantee: true,
        },
      ],
    });
  });

  app.post('/api/ai/orchestrate', async (req, res) => {
    try {
      const { intent, language, mode, projects, existingArtifacts, clarificationAnswers } = req.body || {};
      if (!intent || typeof intent !== 'string') {
        return res.status(400).json({ error: 'Intent description is required.' });
      }
      const result = await activeProvider.orchestrateIntent({
        intent,
        language: language || 'en',
        mode: mode || 'workflow',
        projects: projects || [],
        existingArtifacts: existingArtifacts || [],
        clarificationAnswers: clarificationAnswers || '',
      });
      return res.json(result);
    } catch (error) {
      console.error('AI Orchestration Error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to execute AI lifecycle orchestration.',
      });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, language, projectContext, artifactsContext } = req.body || {};
      const result = await activeProvider.chatWithContext({
        messages: messages || [],
        language: language || 'en',
        projectContext,
        artifactsContext,
      });
      return res.json(result);
    } catch (error) {
      console.error('AI Chat Error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'AI conversation request failed.',
      });
    }
  });

  app.post('/api/ai/analyze-image', async (req, res) => {
    try {
      const { base64Image, mimeType, prompt, language, projectContext } = req.body || {};
      if (!base64Image) {
        return res.status(400).json({ error: 'An uploaded image is required for analysis.' });
      }
      const result = await activeProvider.analyzeImage({
        base64Image,
        mimeType,
        prompt,
        language: language || 'en',
        projectContext,
      });
      return res.json(result);
    } catch (error) {
      console.error('AI Image Analysis Error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Image analysis failed.',
      });
    }
  });

  app.post('/api/ai/generate-image', async (req, res) => {
    try {
      const { prompt, base64Image, mimeType, aspectRatio, imageSize } = req.body || {};
      if (!prompt) {
        return res.status(400).json({ error: 'A text prompt is required to create or edit an image.' });
      }
      const result = await activeProvider.generateOrEditImage({
        prompt,
        base64Image,
        mimeType,
        aspectRatio: aspectRatio || '16:9',
        imageSize: imageSize || '1K',
      });
      return res.json(result);
    } catch (error) {
      console.error('AI Image Generation Error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Image generation or editing failed.',
      });
    }
  });

  app.post('/api/ai/impact-analysis', async (req, res) => {
    try {
      const { targetArtifact, proposedChange, allArtifacts, livingDocs, language } = req.body || {};
      if (!targetArtifact || !proposedChange) {
        return res.status(400).json({ error: 'Target artifact and proposed change are required.' });
      }
      const result = await activeProvider.analyzeChangeImpact({
        targetArtifact,
        proposedChange,
        allArtifacts: allArtifacts || [],
        livingDocs: livingDocs || [],
        language: language || 'en',
      });
      return res.json(result);
    } catch (error) {
      console.error('AI Change Impact Error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Change impact analysis failed.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mizan AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
