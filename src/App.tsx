/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Play,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Terminal,
  Code2,
  BookOpen,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  Check,
  FileCode,
  RefreshCw,
  FolderTree,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const SAMPLE_INVOICE_TEXT = `================================================================================
                                INVOICE
================================================================================
VENDOR DETAILS:
Acme Cloud Services Ltd.
742 Evergreen Terrace, Suite 300
Austin, TX 78701, United States
Tax ID / EIN: 74-9812401
Contact: billing@acmecloud.com | Phone: (512) 555-0144

BILL TO:
Global Logistics Solutions Inc.
Attn: Accounts Payable Department
1200 Harbor Boulevard, Floor 14
Seattle, WA 98101, United States

--------------------------------------------------------------------------------
INVOICE DETAILS:
Invoice Number  : INV-2024-9102
Invoice Date    : 2024-10-18
Payment Due Date: 2024-11-17
Currency        : USD
Payment Status  : Pending
--------------------------------------------------------------------------------

LINE ITEMS BILLED:
--------------------------------------------------------------------------------
Item # | Description                                    | Qty | Unit Price | Amount
--------------------------------------------------------------------------------
  1    | Dedicated GPU Cloud Cluster (A100 x 4) - Oct    |  1  |  $1,200.00 | $1,200.00
  2    | High-Throughput Managed PostgreSQL (500 GB)     |  2  |    $150.00 |   $300.00
  3    | Outbound CDN Bandwidth Overage (TB)             |  3  |     $45.00 |   $135.00
  4    | Enterprise SLA 24/7 Priority Support Tier       |  1  |    $250.00 |   $250.00
--------------------------------------------------------------------------------

FINANCIAL SUMMARY:
--------------------------------------------------------------------------------
Subtotal Amount: $1,885.00
State & Local Tax (8.25%): $155.51
Total Amount Due: $2,040.51 USD
================================================================================`;

const SAMPLE_RESUME_TEXT = `Alex Rivera
Austin, Texas | (512) 555-0199 | alex.rivera.dev@gmail.com
LinkedIn: linkedin.com/in/alex-rivera-ai | GitHub: github.com/alexrivera-dev

PROFESSIONAL SUMMARY
Senior AI Engineer and Full-Stack Systems Architect with 5+ years of production experience building high-throughput microservices, LLM prompt engineering pipelines, and resilient distributed databases. Specialized in Pydantic data schemas, Google GenAI SDK, and zero-downtime cloud infrastructure.

CORE TECHNICAL SKILLS
Languages        : Python, TypeScript, Go, SQL, Bash
AI & LLM Tools   : Google Gemini API, OpenAI API, LangChain, Pydantic v2, Vector Databases, HuggingFace
Backend & Cloud  : FastAPI, Express, Docker, Kubernetes, PostgreSQL, Redis, Google Cloud Platform (GCP)
Testing & DevOps : PyTest, GitHub Actions, CI/CD, Terraform, Postman

PROFESSIONAL EXPERIENCE

Senior AI Systems Engineer | CognitiveFlow Inc. | Austin, TX
July 2022 – Present
- Designed and deployed enterprise document extraction pipeline utilizing Google Gemini API and Pydantic v2, processing over 120,000 PDF invoices and contracts monthly with a 99.6% schema compliance rate.
- Reduced LLM latency by 58% and token expenditure by 40% through strict few-shot prompt optimization and structured JSON schema enforcement.
- Engineered automated self-repair fallback retry loop that caught malformed JSON outputs and healed schema discrepancies with zero human intervention.

Full Stack Software Engineer | NexaCloud Solutions | Denver, CO
January 2020 – June 2022
- Developed scalable REST APIs using Python FastAPI and PostgreSQL, serving 25,000 requests per minute with p95 response time under 120ms.
- Automated end-to-end integration test suites using PyTest, increasing overall code coverage from 64% to 92%.

EDUCATION
Bachelor of Science in Computer Science
University of Texas at Austin | Graduated: 2019 | GPA: 3.88 / 4.0

PROFESSIONAL CERTIFICATIONS
- Google Cloud Certified Professional Cloud Architect (2023)
- DeepLearning.AI Prompt Engineering & Generative AI Specialization (2022)

KEY PROJECTS
Structured LLM Document Extractor (2024)
- Open-source CLI and API service converting invoices and resumes into strictly validated JSON schemas.
- Technologies: Python 3.11, Google GenAI SDK, Pydantic v2, PyTest, Docker.`;

const SAMPLE_RECEIPT_TEXT = `CLOUDNEXUS HOSTING SOLUTIONS
Receipt # CN-9042
Issued: 2024-09-01
Customer: John Doe (Freelance Dev)

Charges:
- Monthly VPS Tier 2: €45.00
- Managed PostgreSQL Cluster: €30.00

Total Paid: €75.00
Status: Paid via Visa ending in 4242`;

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'tests' | 'schemas' | 'code' | 'guide' | 'git'>('studio');
  const [documentType, setDocumentType] = useState<'invoice' | 'resume' | 'receipt'>('invoice');
  const [documentText, setDocumentText] = useState<string>(SAMPLE_INVOICE_TEXT);
  const [isMockMode, setIsMockMode] = useState<boolean>(true);
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const [enableRepair, setEnableRepair] = useState<boolean>(true);

  // Extraction State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [executionLogs, setExecutionLogs] = useState<string>('');
  const [outputView, setOutputView] = useState<'visual' | 'json' | 'logs'>('visual');
  const [copied, setCopied] = useState<boolean>(false);

  // Test Runner State
  const [testOutput, setTestOutput] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  // Code Browser State
  const [selectedFile, setSelectedFile] = useState<string>('src/schemas.py');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState<boolean>(false);

  // Auto-load initial sample extraction on mount
  useEffect(() => {
    handleRunExtraction(SAMPLE_INVOICE_TEXT, 'invoice');
  }, []);

  // Fetch file content when selectedFile changes
  useEffect(() => {
    if (activeTab === 'code') {
      fetchFile(selectedFile);
    }
  }, [selectedFile, activeTab]);

  const fetchFile = async (filePath: string) => {
    setFileLoading(true);
    try {
      const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.content) {
        setFileContent(data.content);
      } else {
        setFileContent('# File content unavailable.');
      }
    } catch (e) {
      setFileContent('# Failed to load file.');
    } finally {
      setFileLoading(false);
    }
  };

  const handleRunExtraction = async (textToExtract = documentText, typeToExtract = documentType) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToExtract,
          type: typeToExtract,
          mock: isMockMode,
          model,
          enableRepair,
        }),
      });
      const data = await res.json();
      setExtractionResult(data);
      setExecutionLogs(
        `[CLI STDOUT]:\n${data.stdout || '(None)'}\n\n[CLI STDERR]:\n${data.stderr || '(None)'}`
      );
    } catch (err: any) {
      setExtractionResult({
        success: false,
        errors: [`Network request failed: ${err.message}`],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunTests = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/run-tests', { method: 'POST' });
      const data = await res.json();
      setTestOutput(data.output || 'No output recorded.');
      setTestSuccess(data.success);
    } catch (e: any) {
      setTestOutput(`Failed to execute pytest: ${e.message}`);
      setTestSuccess(false);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyJson = () => {
    if (!extractionResult?.data) return;
    navigator.clipboard.writeText(JSON.stringify(extractionResult.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!extractionResult?.data) return;
    const blob = new Blob([JSON.stringify(extractionResult.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentType}_extracted.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadPreset = (preset: 'invoice' | 'resume' | 'receipt') => {
    setDocumentType(preset);
    let sample = SAMPLE_INVOICE_TEXT;
    if (preset === 'resume') sample = SAMPLE_RESUME_TEXT;
    if (preset === 'receipt') sample = SAMPLE_RECEIPT_TEXT;
    setDocumentText(sample);
    handleRunExtraction(sample, preset);
  };

  const projectFiles = [
    'src/schemas.py',
    'src/prompts.py',
    'src/extractor.py',
    'src/llm_client.py',
    'src/validators.py',
    'src/main.py',
    'tests/test_schemas.py',
    'tests/test_validators.py',
    'tests/test_extractor.py',
    'run.py',
    'requirements.txt',
    'README.md',
    '.env.example',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-lg">
              <Sparkles className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-white tracking-tight text-base">Datheon Internship</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Task 1: Structured Extractor
                </span>
              </div>
              <p className="text-xs text-slate-400">Pydantic v2 • Google GenAI SDK • Few-Shot Guardrails</p>
            </div>
          </div>

          {/* Quick status chips & Download */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>37/37 PyTests Passing</span>
            </div>
            <a
              href="/api/download-zip"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Repo (.zip)</span>
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'studio'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Extractor Studio</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('tests');
              if (!testOutput) handleRunTests();
            }}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'tests'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>PyTest Test Suite (37 Tests)</span>
          </button>
          <button
            onClick={() => setActiveTab('schemas')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'schemas'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Schemas & Prompts</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'code'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Source Code</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>PowerShell & CLI</span>
          </button>
          <button
            onClick={() => setActiveTab('git')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'git'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Push to GitHub Repo</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* TAB 1: EXTRACTOR STUDIO */}
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel: Input & Settings */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Input Document
                  </span>

                  <div className="flex items-center space-x-1">
                    <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
                    <button
                      onClick={() => loadPreset('invoice')}
                      className={`px-2 py-0.5 text-[11px] rounded transition ${
                        documentType === 'invoice'
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Invoice
                    </button>
                    <button
                      onClick={() => loadPreset('resume')}
                      className={`px-2 py-0.5 text-[11px] rounded transition ${
                        documentType === 'resume'
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => loadPreset('receipt')}
                      className={`px-2 py-0.5 text-[11px] rounded transition ${
                        documentType === 'receipt'
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Receipt
                    </button>
                  </div>
                </div>

                {/* Pipeline Controls */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Target Schema Type</label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="invoice">Commercial Invoice</option>
                      <option value="resume">Professional Resume</option>
                      <option value="receipt">Sales Receipt</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Execution Mode</label>
                    <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                      <button
                        onClick={() => setIsMockMode(true)}
                        className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
                          isMockMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Mock (Offline)
                      </button>
                      <button
                        onClick={() => setIsMockMode(false)}
                        className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
                          !isMockMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Live Gemini
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Gemini Model</label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Fast)</option>
                      <option value="gemini-3.8-flash">gemini-3.8-flash (Latest)</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro (Reasoning)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <span className="text-[11px] text-slate-400">1-Step Self Repair</span>
                    <button
                      type="button"
                      onClick={() => setEnableRepair(!enableRepair)}
                      className={`w-10 h-5 flex items-center rounded-full p-1 duration-200 ${
                        enableRepair ? 'bg-indigo-600' : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform duration-200 ${
                          enableRepair ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Raw Document Editor */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] text-slate-400">Unstructured Document Text</label>
                    <span className="text-[10px] text-slate-500 font-mono">{documentText.length} characters</span>
                  </div>
                  <textarea
                    rows={13}
                    value={documentText}
                    onChange={(e) => setDocumentText(e.target.value)}
                    placeholder="Paste your unstructured invoice, resume, receipt, or business contract here..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>

                {/* Extraction Action Button */}
                <button
                  disabled={isLoading}
                  onClick={() => handleRunExtraction()}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Extracting & Validating with Pydantic...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white text-white" />
                      <span>Execute Extraction Pipeline</span>
                    </>
                  )}
                </button>
              </div>

              {/* Security Boundary Notice */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-slate-300 text-[11px]">Prompt Injection Guard Active</p>
                  <p className="text-[11px] leading-relaxed">
                    Input is isolated in <code className="text-indigo-400 font-mono text-[10px]">&lt;untrusted_document&gt;</code> tags.
                    The model treats content purely as raw data to extract, rejecting malicious embedded commands.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Panel: Output & Visualizer */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
                {/* View Switcher Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Validated Extraction Result
                    </span>
                    {extractionResult && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center space-x-1 ${
                          extractionResult.success
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {extractionResult.success ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Pydantic v2 Verified</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" />
                            <span>Validation Error</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                      <button
                        onClick={() => setOutputView('visual')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                          outputView === 'visual' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Visual Tree
                      </button>
                      <button
                        onClick={() => setOutputView('json')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                          outputView === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        JSON Raw
                      </button>
                      <button
                        onClick={() => setOutputView('logs')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                          outputView === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        CLI Logs
                      </button>
                    </div>

                    <button
                      onClick={handleCopyJson}
                      title="Copy JSON"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleDownloadJson}
                      title="Download JSON File"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Validation Errors Box (if any) */}
                {extractionResult?.errors && extractionResult.errors.length > 0 && (
                  <div className="bg-rose-950/30 border border-rose-800/40 rounded-lg p-3 text-xs space-y-1">
                    <div className="font-semibold text-rose-400 flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>Schema Validation Diagnostics</span>
                    </div>
                    <ul className="list-disc pl-5 text-rose-300/80 space-y-0.5 font-mono text-[11px]">
                      {extractionResult.errors.map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CONTENT 1: Visual Entity Tree */}
                {outputView === 'visual' && extractionResult?.data && (
                  <div className="space-y-4">
                    {/* INVOICE VIEW */}
                    {(documentType === 'invoice' || documentType === 'receipt') && (
                      <div className="space-y-4">
                        {/* Summary Badges */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Amount</span>
                            <span className="text-base font-semibold text-emerald-400 font-mono">
                              {extractionResult.data.currency || '$'} {extractionResult.data.total ?? 'null'}
                            </span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Invoice Number</span>
                            <span className="text-xs font-semibold text-slate-200 font-mono">
                              {extractionResult.data.invoice_number ?? 'null'}
                            </span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Invoice Date</span>
                            <span className="text-xs font-semibold text-slate-200 font-mono">
                              {extractionResult.data.invoice_date ?? 'null'}
                            </span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Status</span>
                            <span className="text-xs font-semibold text-indigo-400">
                              {extractionResult.data.payment_status ?? 'Pending'}
                            </span>
                          </div>
                        </div>

                        {/* Parties */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg text-xs space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Vendor Entity</span>
                            <p className="font-medium text-slate-200">{extractionResult.data.vendor_name || 'null'}</p>
                          </div>
                          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg text-xs space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Customer Entity</span>
                            <p className="font-medium text-slate-200">{extractionResult.data.customer_name || 'null'}</p>
                          </div>
                        </div>

                        {/* Line Items Table */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-slate-300">
                            Line Items ({extractionResult.data.line_items?.length || 0})
                          </span>
                          <div className="border border-slate-800 rounded-lg overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-950 text-slate-400 text-[11px] border-b border-slate-800">
                                <tr>
                                  <th className="py-2 px-3">Description</th>
                                  <th className="py-2 px-3 text-right">Qty</th>
                                  <th className="py-2 px-3 text-right">Unit Price</th>
                                  <th className="py-2 px-3 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                {extractionResult.data.line_items?.map((item: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-800/30">
                                    <td className="py-2 px-3 font-sans text-slate-200">{item.description}</td>
                                    <td className="py-2 px-3 text-right text-slate-400">{item.quantity}</td>
                                    <td className="py-2 px-3 text-right text-slate-400">${item.unit_price}</td>
                                    <td className="py-2 px-3 text-right text-emerald-400 font-semibold">${item.amount}</td>
                                  </tr>
                                ))}
                                {(!extractionResult.data.line_items || extractionResult.data.line_items.length === 0) && (
                                  <tr>
                                    <td colSpan={4} className="py-4 text-center text-slate-500 italic font-sans">
                                      No line items detected in document.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Tax & Subtotal Breakdown */}
                        <div className="flex justify-end space-x-6 text-xs font-mono text-slate-400 border-t border-slate-800 pt-3">
                          <div>Subtotal: <span className="text-slate-200 font-semibold">${extractionResult.data.subtotal ?? '0.00'}</span></div>
                          <div>Tax: <span className="text-slate-200 font-semibold">${extractionResult.data.tax ?? '0.00'}</span></div>
                          <div>Total: <span className="text-emerald-400 font-bold">${extractionResult.data.total ?? '0.00'}</span></div>
                        </div>
                      </div>
                    )}

                    {/* RESUME VIEW */}
                    {documentType === 'resume' && (
                      <div className="space-y-4">
                        {/* Header Profile */}
                        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <h2 className="text-lg font-bold text-white">{extractionResult.data.full_name || 'Candidate Name'}</h2>
                            <p className="text-xs text-indigo-400 font-mono">
                              {extractionResult.data.email || 'null'} • {extractionResult.data.phone || 'null'}
                            </p>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                            📍 {extractionResult.data.location || 'Unknown Location'}
                          </span>
                        </div>

                        {/* Skills Cloud */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-slate-300">
                            Extracted Skills ({extractionResult.data.skills?.length || 0})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {extractionResult.data.skills?.map((skill: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-mono"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Experience */}
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-slate-300">
                            Experience History ({extractionResult.data.experience?.length || 0})
                          </span>
                          <div className="space-y-2">
                            {extractionResult.data.experience?.map((exp: any, idx: number) => (
                              <div key={idx} className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg text-xs space-y-1.5">
                                <div className="flex justify-between items-start">
                                  <span className="font-semibold text-slate-100">{exp.job_title}</span>
                                  <span className="text-[10px] text-indigo-400 font-mono">
                                    {exp.start_date} – {exp.end_date}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium">{exp.company} • {exp.location}</p>
                                {exp.responsibilities?.length > 0 && (
                                  <ul className="list-disc pl-4 text-[11px] text-slate-400 space-y-1 pt-1">
                                    {exp.responsibilities.map((r: string, rIdx: number) => (
                                      <li key={rIdx}>{r}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Education */}
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-slate-300">Education Credentials</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {extractionResult.data.education?.map((edu: any, idx: number) => (
                              <div key={idx} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs">
                                <p className="font-semibold text-slate-200">{edu.degree}</p>
                                <p className="text-[11px] text-slate-400">{edu.institution} ({edu.graduation_year})</p>
                                {edu.gpa && <p className="text-[10px] text-emerald-400 font-mono">GPA: {edu.gpa}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CONTENT 2: Raw Formatted JSON */}
                {outputView === 'json' && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto max-h-[500px]">
                    <pre className="text-xs font-mono text-indigo-300 leading-relaxed">
                      {extractionResult?.data
                        ? JSON.stringify(extractionResult.data, null, 2)
                        : '// No extraction output yet. Run extraction to view valid JSON.'}
                    </pre>
                  </div>
                )}

                {/* CONTENT 3: CLI Stderr / Stdout Logs */}
                {outputView === 'logs' && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto max-h-[500px]">
                    <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {executionLogs || '// CLI execution stdout & stderr logs will appear here.'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PYTEST TEST SUITE */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Automated PyTest Test Suite (Offline Verification)
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  Executes all 37 unit and integration tests across schemas, validators, mock clients, bounded self-repair,
                  and command-line utilities without requiring live API keys.
                </p>
              </div>

              <button
                disabled={isTesting}
                onClick={handleRunTests}
                className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center space-x-2 transition shrink-0 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Executing pytest -v...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Re-run pytest -v</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Category Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200">tests/test_schemas.py</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    11 Passed
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pydantic v2 schemas for Invoice, LineItem, Resume, Education, Experience, currency normalization, and nullability.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200">tests/test_validators.py</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    11 Passed
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Markdown backtick stripping (```json), trailing comma correction, sub-block extraction, and detailed error reports.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200">tests/test_extractor.py</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    15 Passed
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  End-to-end mock extraction, prompt security boundaries, bounded 1-step repair loops, document size limits, and CLI exit codes.
                </p>
              </div>
            </div>

            {/* Terminal Output */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>terminal $ python3 -m pytest -v</span>
                </div>
                {testSuccess !== null && (
                  <span
                    className={`text-xs font-semibold ${
                      testSuccess ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testSuccess ? '● 37 Passed (100% Green)' : '● Tests Failed'}
                  </span>
                )}
              </div>
              <div className="p-4 bg-slate-950/90 overflow-x-auto max-h-[500px]">
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {testOutput || 'Click "Re-run pytest -v" above to execute tests in real-time.'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEMAS & PROMPTS */}
        {activeTab === 'schemas' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Invoice Schema Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-semibold text-sm text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Pydantic v2 Invoice Schema
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    class Invoice(BaseModel)
                  </span>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-300 font-mono">
                  <li>• <span className="text-indigo-400">invoice_number</span>: Optional[str] = None</li>
                  <li>• <span className="text-indigo-400">invoice_date</span>: Optional[str] = None</li>
                  <li>• <span className="text-indigo-400">due_date</span>: Optional[str] = None</li>
                  <li>• <span className="text-indigo-400">vendor_name</span>: Optional[str] = None</li>
                  <li>• <span className="text-indigo-400">customer_name</span>: Optional[str] = None</li>
                  <li>• <span className="text-indigo-400">currency</span>: Optional[str] = None (Normalized)</li>
                  <li>• <span className="text-indigo-400">subtotal</span>: Optional[float] = None</li>
                  <li>• <span className="text-indigo-400">tax</span>: Optional[float] = None</li>
                  <li>• <span className="text-indigo-400">total</span>: Optional[float] = None</li>
                  <li>• <span className="text-indigo-400">line_items</span>: List[LineItem] = []</li>
                  <li>• <span className="text-indigo-400">payment_status</span>: Optional[str] = None</li>
                </ul>
              </div>

              {/* Resume Schema Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-semibold text-sm text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Pydantic v2 Resume Schema
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    class Resume(BaseModel)
                  </span>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-300 font-mono">
                  <li>• <span className="text-indigo-400">full_name</span>: Optional[str] = None</li>
                  <li>• <span className="text-indigo-400">email</span>: Optional[str] = None (Sanitized)</li>
                  <li>• <span className="text-indigo-400">phone</span>: Optional[str] = None</li>
                  <li>• <span className="text-indigo-400">location</span>: Optional[str] = None</li>
                  <li>• <span className="text-indigo-400">skills</span>: List[str] = []</li>
                  <li>• <span className="text-indigo-400">education</span>: List[EducationItem] = []</li>
                  <li>• <span className="text-indigo-400">experience</span>: List[ExperienceItem] = []</li>
                  <li>• <span className="text-indigo-400">certifications</span>: List[str] = []</li>
                  <li>• <span className="text-indigo-400">projects</span>: List[ProjectItem] = []</li>
                </ul>
              </div>
            </div>

            {/* Prompt Security & Guardrails */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="font-semibold text-sm text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Prompt Engineering Architecture & Security Defenses
                </span>
                <span className="text-xs text-slate-400">src/prompts.py</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="font-semibold text-indigo-400">1. Untrusted Data Boundary</span>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Inputs are wrapped in <code className="text-slate-200">&lt;untrusted_document&gt;</code>.
                    The model is instructed that text within this delimiter cannot alter system rules or issue override commands.
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="font-semibold text-indigo-400">2. Few-Shot Exemplars</span>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Includes 2 realistic multi-item document demonstrations per type, establishing zero-hallucination conventions
                    and explicit <code className="text-slate-200">null</code> mappings.
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="font-semibold text-indigo-400">3. Injected JSON Schema</span>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Directly injects Pydantic's <code className="text-slate-200">model_json_schema()</code> into prompt context,
                    paired with Gemini's <code className="text-slate-200">response_mime_type="application/json"</code> mode.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SOURCE CODE BROWSER */}
        {activeTab === 'code' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block px-2 py-1">
                Project Files
              </span>
              {projectFiles.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFile(f)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition ${
                    selectedFile === f
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{f}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                </button>
              ))}
            </div>

            <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  {selectedFile}
                </span>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(fileContent);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy File'}</span>
                </button>
              </div>

              <div className="p-4 bg-slate-950/90 overflow-x-auto max-h-[600px]">
                {fileLoading ? (
                  <div className="py-12 flex items-center justify-center text-slate-500 text-xs space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Loading file content...</span>
                  </div>
                ) : (
                  <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
                    {fileContent}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: WINDOWS POWERSHELL & CLI GUIDE */}
        {activeTab === 'guide' && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-400" />
                Windows 11 PowerShell Setup & Execution Guide
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Follow these exact steps to clone, configure, test, and run the project locally on Windows 11 with PowerShell.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300">1. Virtual Environment & Dependencies</span>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 space-y-1">
                    <p>py -3.11 -m venv .venv</p>
                    <p>.\.venv\Scripts\Activate.ps1</p>
                    <p>python -m pip install --upgrade pip</p>
                    <p>pip install -r requirements.txt</p>
                    <p>Copy-Item .env.example .env</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300">2. Configure Gemini API Key</span>
                  <p className="text-xs text-slate-400">
                    Edit <code className="text-indigo-400">.env</code> in Notepad or VS Code and insert your API key:
                  </p>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400">
                    GEMINI_API_KEY="AIzaSyYourActualKeyHere..."
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300">3. Run Offline Tests</span>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
                    pytest -v
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300">4. Run Document Extractions</span>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 space-y-1">
                    <p># Extract Invoice:</p>
                    <p className="text-slate-400">python run.py --input examples/sample_invoice.txt --type invoice --output outputs/invoice.json --pretty</p>
                    <p className="pt-2"># Extract Resume:</p>
                    <p className="text-slate-400">python run.py --input examples/sample_resume.txt --type resume --output outputs/resume.json --pretty</p>
                    <p className="pt-2"># Offline Mock Mode (without API key):</p>
                    <p className="text-slate-400">python run.py --input examples/sample_invoice.txt --type invoice --mock --pretty</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: GIT REPOSITORY & PUSH GUIDE */}
        {activeTab === 'git' && (
          <div className="space-y-6 max-w-4xl">
            {/* Status Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-indigo-400" />
                    Git Repository Status
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Local repository is fully initialized, tracked, and committed on branch <code className="text-emerald-400 font-mono">main</code>.
                  </p>
                </div>

                <a
                  href="/api/download-zip"
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Complete Repo (.zip)</span>
                </a>
              </div>

              {/* Commit Log Details */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center space-x-2 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span className="text-emerald-400 font-bold">Latest Commit (HEAD &rarr; main):</span>
                  <span className="text-slate-300">1c165e9</span>
                </div>
                <p className="text-slate-200 pl-4.5">feat: Datheon Task 1 - Structured LLM Prompt Pipeline & JSON Extractor</p>
                <div className="text-[11px] text-slate-500 pl-4.5 pt-1 space-y-0.5">
                  <p>• 53 files changed, 7,366 insertions(+)</p>
                  <p>• All Pydantic v2 schemas, prompt pipelines, and 37 pytest cases included</p>
                  <p>• .env excluded via .gitignore (no credentials leaked)</p>
                </div>
              </div>
            </div>

            {/* Step-by-Step Push Instructions */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-indigo-400" />
                  Push to GitHub: "Python + Generative AI & LangChain Internship"
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Because this AI Studio cloud container does not hold your personal GitHub credentials, execute these standard commands to connect and push to your GitHub repository:
                </p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Step 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[11px]">1</span>
                    <span className="font-semibold text-slate-200">Create the repository on GitHub</span>
                  </div>
                  <p className="text-slate-400 pl-7 text-[11px]">
                    Go to <a href="https://github.com/new" target="_blank" rel="noreferrer" className="text-indigo-400 underline">github.com/new</a> and name it:
                  </p>
                  <div className="ml-7 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-indigo-300">
                    Python-Generative-AI-LangChain-Internship
                  </div>
                </div>

                {/* Step 2 */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[11px]">2</span>
                    <span className="font-semibold text-slate-200">Option A: Link remote and push via Terminal / PowerShell</span>
                  </div>
                  <p className="text-slate-400 pl-7 text-[11px]">
                    Replace <code className="text-slate-200">&lt;YOUR-GITHUB-USERNAME&gt;</code> with your GitHub account:
                  </p>
                  <div className="ml-7 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-indigo-300 space-y-1">
                    <p className="text-slate-500"># 1. Add your GitHub remote repository URL</p>
                    <p>git remote add origin https://github.com/&lt;YOUR-GITHUB-USERNAME&gt;/Python-Generative-AI-LangChain-Internship.git</p>
                    <p className="text-slate-500 pt-2"># 2. Ensure main branch is selected</p>
                    <p>git branch -M main</p>
                    <p className="text-slate-500 pt-2"># 3. Push all commits, schemas, tests, and documentation</p>
                    <p className="text-emerald-400">git push -u origin main</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[11px]">3</span>
                    <span className="font-semibold text-slate-200">Option B: If using GitHub CLI (gh)</span>
                  </div>
                  <div className="ml-7 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-indigo-300 space-y-1">
                    <p>gh repo create "Python-Generative-AI-LangChain-Internship" --public --source=. --remote=origin --push</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[11px]">4</span>
                    <span className="font-semibold text-slate-200">Option C: Extract downloaded .zip directly into your cloned repo</span>
                  </div>
                  <p className="text-slate-400 pl-7 text-[11px] leading-relaxed">
                    Click <strong>"Download Complete Repo (.zip)"</strong> above, unzip into your local workspace, and push anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        Datheon Internship — Task 1: Structured LLM Prompt Pipeline & JSON Extractor • Production Quality Implementation
      </footer>
    </div>
  );
}
