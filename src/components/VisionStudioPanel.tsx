import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Wand2, ScanSearch, PlusCircle, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Language, Project, ArtifactType } from '../types';

interface ExtractedCandidate {
  type: string;
  title: string;
  description: string;
  rationale: string;
  validationStatus: string;
  validationNotes: string;
}

interface VisionStudioPanelProps {
  lang: Language;
  projects: Project[];
  selectedProjectId: string;
  onSaveArtifact: (item: {
    type: ArtifactType;
    title: string;
    description: string;
    rationale: string;
    projectId: string;
    sourceRefs: string[];
  }) => Promise<void>;
}

/**
 * Generates a clean SVG architecture whiteboard image in base64 PNG/SVG data URL
 * so users can test Gemini 3.1 Pro Image Analysis or Nano Banana 2.1 Image Editing in one click
 * or upload their own photo from disk.
 */
function createSampleWhiteboardDataUrl(): { dataUrl: string; mimeType: string } {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
    <rect width="900" height="520" fill="#F8FAFC"/>
    <rect x="24" y="24" width="852" height="472" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
    <text x="50" y="65" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0F172A">Whiteboard: Instant Supplier Invoice Factoring Flow</text>
    <rect x="60" y="120" width="200" height="110" rx="8" fill="#EFF6FF" stroke="#2563EB" stroke-width="2"/>
    <text x="80" y="160" font-family="sans-serif" font-size="15" font-weight="bold" fill="#1E40AF">1. SME Supplier Portal</text>
    <text x="80" y="185" font-family="sans-serif" font-size="12" fill="#334155">Uploads ZATCA XML Invoice</text>
    <text x="80" y="205" font-family="sans-serif" font-size="12" fill="#334155">Max file size: 5MB</text>
    <line x1="260" y1="175" x2="340" y2="175" stroke="#475569" stroke-width="2"/>
    <rect x="340" y="120" width="220" height="110" rx="8" fill="#F0FDF4" stroke="#16A34A" stroke-width="2"/>
    <text x="360" y="160" font-family="sans-serif" font-size="15" font-weight="bold" fill="#166534">2. KYB &amp; Risk Engine</text>
    <text x="360" y="185" font-family="sans-serif" font-size="12" fill="#334155">Rule: Debtor Cap &lt;= 15%</text>
    <text x="360" y="205" font-family="sans-serif" font-size="12" fill="#334155">SLA: Score in &lt; 2.5 sec</text>
    <line x1="560" y1="175" x2="640" y2="175" stroke="#475569" stroke-width="2"/>
    <rect x="640" y="120" width="200" height="110" rx="8" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
    <text x="660" y="160" font-family="sans-serif" font-size="15" font-weight="bold" fill="#92400E">3. Core Treasury</text>
    <text x="660" y="185" font-family="sans-serif" font-size="12" fill="#334155">Instant IBAN Payout</text>
    <text x="660" y="205" font-family="sans-serif" font-size="12" fill="#DC2626">Question: Weekend cutoff?</text>
    <rect x="60" y="290" width="780" height="160" rx="8" fill="#F1F5F9" stroke="#94A3B8" stroke-width="1.5"/>
    <text x="85" y="325" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0F172A">Notes from Architecture Session:</text>
    <text x="85" y="355" font-family="sans-serif" font-size="13" fill="#334155">- Must verify Anchor Buyer ERP webhook signature (HMAC-SHA256) before approval.</text>
    <text x="85" y="385" font-family="sans-serif" font-size="13" fill="#334155">- Dual-approval required if single invoice exceeds 500,000 SAR.</text>
    <text x="85" y="415" font-family="sans-serif" font-size="13" fill="#B91C1C">- Open Issue: What happens if Buyer ERP webhook times out after 3 seconds?</text>
  </svg>`;
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return { dataUrl: `data:image/svg+xml;base64,${base64}`, mimeType: 'image/svg+xml' };
}

export const VisionStudioPanel: React.FC<VisionStudioPanelProps> = ({
  lang,
  projects,
  selectedProjectId,
  onSaveArtifact,
}) => {
  const isAr = lang === 'ar';
  const targetProjectId = selectedProjectId || projects[0]?.id || '';

  // Image Analysis State (gemini-3.1-pro-preview)
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [uploadedMimeType, setUploadedMimeType] = useState<string>('image/png');
  const [analysisPrompt, setAnalysisPrompt] = useState<string>(
    isAr
      ? 'حلل هذا المخطط واستخرج المتطلبات وقواعد العمل ومعايير القبول وأي نقاط غموض.'
      : 'Analyze this architecture whiteboard/screenshot and extract structured requirements, business rules, acceptance criteria, and open ambiguities.'
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    summary: string;
    detectedElements: string[];
    ambiguitiesOrRisks: string[];
    extractedArtifacts: ExtractedCandidate[];
  } | null>(null);
  const [savedIndices, setSavedIndices] = useState<Record<number, boolean>>({});

  // Image Generation & Editing State (gemini-nano-banana-2.1)
  const [genPrompt, setGenPrompt] = useState<string>(
    isAr
      ? 'مخطط معماري مؤسسي واضح لنظام تمويل الفواتير الفوري يربط بوابة الموردين ومحرك المخاطر ونظام ERP'
      : 'Clean enterprise solution architecture diagram showing SME Supplier Portal, Automated KYB Risk Engine, Anchor Buyer ERP Webhook, and Instant Treasury Settlement Ledger'
  );
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [imageSize, setImageSize] = useState<string>('1K');
  const [useSourceImageForEdit, setUseSourceImageForEdit] = useState<boolean>(false);
  const [generatingImage, setGeneratingImage] = useState<boolean>(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const [generatedCaption, setGeneratedCaption] = useState<string>('');
  const [visualSaved, setVisualSaved] = useState<boolean>(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedMimeType(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedImage(reader.result);
        setAnalysisError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSampleWhiteboard = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');
    const sample = createSampleWhiteboardDataUrl();
    const img = new Image();
    img.onload = () => {
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        setUploadedImage(pngUrl);
        setUploadedMimeType('image/png');
      }
    };
    img.src = sample.dataUrl;
  };

  const handleAnalyzeImage = async () => {
    if (!uploadedImage) {
      setAnalysisError(isAr ? 'يرجى رفع صورة أو تحميل نموذج المخطط أولاً.' : 'Please upload a photo/diagram or load the sample whiteboard first.');
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    setSavedIndices({});
    try {
      const activeProject = projects.find((p) => p.id === targetProjectId) || projects[0];
      const res = await fetch('/api/ai/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Image: uploadedImage,
          mimeType: uploadedMimeType,
          prompt: analysisPrompt,
          language: lang,
          projectContext: activeProject,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }
      setAnalysisResult(data);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Image analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveExtracted = async (candidate: ExtractedCandidate, idx: number) => {
    if (!targetProjectId) return;
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
    ];
    const mappedType: ArtifactType = validTypes.includes(candidate.type as ArtifactType)
      ? (candidate.type as ArtifactType)
      : 'requirement';

    await onSaveArtifact({
      type: mappedType,
      title: candidate.title,
      description: candidate.description,
      rationale: candidate.rationale || 'Extracted from visual diagram via Gemini 3.1 Pro Image Analysis',
      projectId: targetProjectId,
      sourceRefs: ['IMG-ANALYSIS-GEMINI-3.1-PRO'],
    });
    setSavedIndices((prev) => ({ ...prev, [idx]: true }));
  };

  const handleGenerateOrEditImage = async () => {
    if (!genPrompt.trim()) return;
    setGeneratingImage(true);
    setGenError(null);
    setVisualSaved(false);
    try {
      const sourceBase64 = useSourceImageForEdit ? generatedImageUrl || uploadedImage : '';
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: genPrompt,
          base64Image: sourceBase64 || undefined,
          mimeType: sourceBase64 ? 'image/png' : undefined,
          aspectRatio,
          imageSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Image generation failed');
      }
      setGeneratedImageUrl(data.imageUrl);
      setGeneratedCaption(data.captionText || '');
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSaveVisualAssetArtifact = async () => {
    if (!targetProjectId || !generatedImageUrl) return;
    await onSaveArtifact({
      type: 'visual_asset',
      title: genPrompt.slice(0, 120),
      description: `Generated Visual Architecture / Wireframe Artifact (Model: gemini-nano-banana-2.1, Aspect Ratio: ${aspectRatio}, Size: ${imageSize}). ${generatedCaption}`,
      rationale: 'Visual solution artifact generated in AI Workspace Studio.',
      projectId: targetProjectId,
      sourceRefs: ['GEMINI-NANO-BANANA-2.1'],
    });
    setVisualSaved(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Analyze Uploaded Photo / Diagram (gemini-3.1-pro-preview) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ScanSearch className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  {isAr
                    ? 'تحليل المخططات والصور لاستخراج المتطلبات'
                    : 'Analyze Diagrams & Photos for Requirements'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isAr
                  ? 'ارفع صورة سبورة بيضاء أو لقطة شاشة أو مخطط معماري لتحليله عبر نموذج gemini-3.1-pro-preview'
                  : 'Upload a whiteboard photo, wireframe, or system diagram to extract traceable artifacts using gemini-3.1-pro-preview'}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 shrink-0">gemini-3.1-pro-preview</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>{isAr ? 'رفع صورة أو مخطط' : 'Upload Photo / Diagram'}</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
            <button
              type="button"
              onClick={handleLoadSampleWhiteboard}
              className="px-3.5 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isAr ? 'تحميل مخطط سبورة تجريبي' : 'Load Sample Whiteboard Diagram'}
            </button>
          </div>

          {uploadedImage && (
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <img
                src={uploadedImage}
                alt="Uploaded diagram for requirement extraction"
                referrerPolicy="no-referrer"
                className="w-full max-h-56 object-contain"
              />
            </div>
          )}

          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {isAr ? 'تعليمات التحليل والاستخراج' : 'Analysis & Extraction Prompt'}
            </label>
            <textarea
              rows={2}
              value={analysisPrompt}
              onChange={(e) => setAnalysisPrompt(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="mt-3">
            <button
              type="button"
              disabled={analyzing}
              onClick={handleAnalyzeImage}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
              <span>
                {analyzing
                  ? isAr
                    ? 'جاري تحليل الصورة عبر Gemini 3.1 Pro...'
                    : 'Analyzing Image with Gemini 3.1 Pro...'
                  : isAr
                  ? 'تحليل الصورة واستخراج المتطلبات'
                  : 'Analyze Image & Extract Requirements'}
              </span>
            </button>
          </div>

          {analysisError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{analysisError}</span>
            </div>
          )}

          {analysisResult && (
            <div className="mt-5 space-y-4 border-t border-slate-200 pt-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">
                  {isAr ? 'ملخص التحليل البصري' : 'Visual Understanding Summary'}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{analysisResult.summary}</p>
              </div>

              {analysisResult.ambiguitiesOrRisks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-800">
                    {isAr ? 'نقاط الغموض أو المخاطر المكتشفة في المخطط' : 'Detected Ambiguities & Missing Decisions'}
                  </h4>
                  <ul className="mt-1 space-y-1 text-xs text-amber-700 list-disc list-inside">
                    {analysisResult.ambiguitiesOrRisks.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-slate-900 mb-2">
                  {isAr ? 'المخرجات والمتطلبات المستخرجة (قابلة للحفظ)' : 'Extracted Candidate Artifacts'}
                </h4>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {(analysisResult.extractedArtifacts || []).map((cand, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono font-medium text-slate-700">{cand.type}</span>
                          <span> · </span>
                          <span>{cand.validationStatus}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5">{cand.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{cand.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!!savedIndices[idx]}
                        onClick={() => handleSaveExtracted(cand, idx)}
                        className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-60 rounded-md shrink-0 flex items-center gap-1"
                      >
                        {savedIndices[idx] ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isAr ? 'تم الحفظ' : 'Saved'}</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{isAr ? 'إضافة للمشروع' : 'Add to Project'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Create & Edit Solution Images / Diagrams (gemini-nano-banana-2.1) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  {isAr
                    ? 'توليد وتعديل المخططات والصور بالذكاء الاصطناعي'
                    : 'Create & Edit Solution Visuals'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isAr
                  ? 'استخدم الأوامر النصية لتوليد مخططات معمارية أو تعديل الصور عبر نموذج gemini-nano-banana-2.1'
                  : 'Use text prompts to create or edit visual architecture diagrams and mockups powered by gemini-nano-banana-2.1'}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 shrink-0">gemini-nano-banana-2.1</span>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {isAr ? 'وصف المخطط أو التعديل المطلوب' : 'Visual Prompt (Create or Edit Instruction)'}
            </label>
            <textarea
              rows={3}
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              placeholder={
                isAr
                  ? 'صف المخطط المعماري أو التعديل البصري المطلوب...'
                  : 'Describe the solution diagram, process flow, or visual edit instruction...'
              }
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">{isAr ? 'نسبة العرض' : 'Aspect Ratio'}</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
              >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="4:3">4:3 (Board)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="3:4">3:4 (Portrait)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{isAr ? 'الدقة' : 'Resolution'}</label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
              >
                <option value="1K">1K Standard</option>
                <option value="2K">2K High-Res</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={useSourceImageForEdit}
                  onChange={(e) => setUseSourceImageForEdit(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>{isAr ? 'تعديل الصورة الحالية' : 'Edit active image'}</span>
              </label>
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              disabled={generatingImage}
              onClick={handleGenerateOrEditImage}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {generatingImage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              <span>
                {generatingImage
                  ? isAr
                    ? 'جاري توليد/تعديل الصورة عبر Nano Banana 2.1...'
                    : 'Generating with gemini-nano-banana-2.1...'
                  : useSourceImageForEdit
                  ? isAr
                    ? 'تطبيق التعديل على الصورة'
                    : 'Edit Image with gemini-nano-banana-2.1'
                  : isAr
                  ? 'توليد مخطط بصري جديد'
                  : 'Generate Visual with gemini-nano-banana-2.1'}
              </span>
            </button>
          </div>

          {genError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{genError}</span>
            </div>
          )}

          {generatedImageUrl && (
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                <img
                  src={generatedImageUrl}
                  alt="Generated solution architecture visual"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-64 object-contain"
                />
              </div>
              {generatedCaption && <p className="text-xs text-slate-600">{generatedCaption}</p>}
              <div className="flex items-center justify-between gap-3">
                <a
                  href={generatedImageUrl}
                  download={`mizan-visual-${Date.now()}.png`}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  {isAr ? 'تنزيل الصورة PNG' : 'Download PNG'}
                </a>
                <button
                  type="button"
                  disabled={visualSaved}
                  onClick={handleSaveVisualAssetArtifact}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5"
                >
                  {visualSaved ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isAr ? 'تم الحفظ في ذاكرة المعرفة' : 'Saved to Knowledge Memory'}</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>{isAr ? 'حفظ كمخرج بصري في المشروع' : 'Save as Project Visual Artifact'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
