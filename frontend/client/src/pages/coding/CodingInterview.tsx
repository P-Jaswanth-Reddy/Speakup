import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play, Send, Lightbulb, ChevronRight, Loader2, Terminal,
  AlertTriangle, CheckCircle2, XCircle, Clock, Trophy, GripVertical
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { auth } from "@/firebase";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

const LANG_MONACO_MAP: Record<string, string> = {
  python: "python",
  java: "java",
  cpp: "cpp",
};

const LANG_DISPLAY: Record<string, string> = {
  python: "Python",
  java: "Java",
  cpp: "C++",
};

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface TestResult {
  testCase: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  errors: string;
  time?: string;
  memory?: number;
  statusDescription?: string;
}

interface SubmitResult {
  totalTests: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  results: TestResult[];
  problemTitle: string;
  language: string;
  difficulty: string;
  topic: string;
}

interface Problem {
  sessionId: string;
  problemId: string;
  title: string;
  description: string;
  examples: { input: string; output: string; explanation: string }[];
  constraints: string[];
  starterCodes: Record<string, string>;
  difficulty: string;
  topic: string;
  hints: string[];
  functionName: string;
  parameters?: string;
  testCases: TestCase[];
  optimalComplexity?: { time: string; space: string };
  timeLimit?: number;
}

export default function CodingInterview() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState("python");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [errors, setErrors] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"output" | "testcases">("output");
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const problemId = params.get("problem");

    if (problemId) {
      loadProblem(problemId);
    } else {
      const stored = sessionStorage.getItem("codingSession");
      if (stored) {
        const data = JSON.parse(stored);
        setProblem(data);
        setCodes(data.starterCodes || {});
        setLanguage("python");
      } else {
        navigate("/coding");
      }
    }
  }, [navigate, searchString]);

  const getToken = async () => await auth.currentUser?.getIdToken();

  const loadProblem = async (problemId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/coding/problem/${problemId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setProblem(data);
        setCodes(data.starterCodes || {});
        setLanguage("python");
        setOutput("");
        setErrors("");
        setSubmitResult(null);
        setActiveTab("output");
        sessionStorage.setItem("codingSession", JSON.stringify(data));
      }
    } catch (err) {
      console.error("Failed to load problem:", err);
    }
  };

  const handleRun = async () => {
    if (!problem) return;
    setRunning(true);
    setOutput("");
    setErrors("");
    setSubmitResult(null);
    setActiveTab("output");

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/coding/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId: problem.sessionId, code: codes[language] || "", language }),
      });
      const data = await res.json();
      setOutput(data.output || "");
      setErrors(data.errors || "");
    } catch {
      setErrors("Failed to execute code. Is Judge0 running?");
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!problem || !user) return;
    setSubmitting(true);
    setSubmitResult(null);
    setOutput("");
    setErrors("");

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/coding/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId: problem.sessionId, userId: user.uid, code: codes[language] || "", language }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmitResult(data);
        setActiveTab("testcases");
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrors(errData.detail || "Submission failed");
        setActiveTab("output");
      }
    } catch {
      setErrors("Failed to submit code. Please try again.");
      setActiveTab("output");
    } finally {
      setSubmitting(false);
    }
  };

  if (!problem) {
    return (
      <div className="h-screen flex bg-background">
        <Sidebar />
        <div className="flex-1 md:ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const diffColor =
    problem.difficulty === "easy"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : problem.difficulty === "medium"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-rose-100 text-rose-700 border-rose-200";

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col overflow-hidden">
        <MobileNav />
        {/* Main content: fixed height, no page scroll */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Panel: Problem */}
          <div className="lg:w-[42%] w-full flex flex-col border-r bg-white overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={diffColor}>{problem.difficulty}</Badge>
                  <Badge variant="outline" className="text-xs">{problem.topic}</Badge>
                  {problem.timeLimit && (
                    <Badge variant="outline" className="text-xs text-slate-500">
                      <Clock className="w-3 h-3 mr-1" /> {problem.timeLimit}min
                    </Badge>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-800">{problem.title}</h2>
              </div>

              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{problem.description}</p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Examples</h3>
                {problem.examples?.slice(0, 2).map((ex, i) => (
                  <div key={i} className="bg-slate-50 border rounded-lg p-3 space-y-1.5 text-xs">
                    <div>
                      <span className="font-semibold text-slate-500">Input: </span>
                      <code className="bg-white px-1.5 py-0.5 rounded text-slate-800 border">{ex.input}</code>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Output: </span>
                      <code className="bg-white px-1.5 py-0.5 rounded text-slate-800 border">{ex.output}</code>
                    </div>
                    {ex.explanation && (
                      <div className="text-slate-500 italic pt-1">
                        <span className="font-semibold">Explanation: </span>{ex.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {problem.constraints?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2">Constraints</h3>
                  <ul className="space-y-1">
                    {problem.constraints.map((c, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-cyan-500 shrink-0" />
                        <code className="text-xs">{c}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {problem.optimalComplexity && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h3 className="text-xs font-bold text-blue-700 mb-1">Optimal Complexity</h3>
                  <div className="flex gap-4 text-xs text-blue-600">
                    <span>Time: <strong>{problem.optimalComplexity.time}</strong></span>
                    <span>Space: <strong>{problem.optimalComplexity.space}</strong></span>
                  </div>
                </div>
              )}

              {problem.hints?.length > 0 && (
                <div>
                  <Button variant="outline" size="sm" onClick={() => setShowHints(!showHints)} className="text-xs">
                    <Lightbulb className="w-3 h-3 mr-1 text-yellow-500" />
                    {showHints ? "Hide Hints" : "Show Hints"}
                  </Button>
                  {showHints && (
                    <div className="mt-2 space-y-2">
                      {problem.hints.slice(0, hintIndex + 1).map((h, i) => (
                        <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                          💡 Hint {i + 1}: {h}
                        </div>
                      ))}
                      {hintIndex < problem.hints.length - 1 && (
                        <Button variant="ghost" size="sm" onClick={() => setHintIndex(hintIndex + 1)} className="text-xs text-yellow-700">
                          Show next hint
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Editor + Console */}
          <div className="lg:w-[58%] w-full flex flex-col bg-[#1e1e1e] overflow-hidden">
            {/* Editor toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
              <div className="flex items-center gap-1">
                {Object.entries(LANG_DISPLAY).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setLanguage(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      language === key
                        ? "bg-cyan-600 text-white"
                        : "text-[#999] hover:text-white hover:bg-[#3c3c3c]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRun}
                  disabled={running || submitting}
                  className="h-7 text-xs bg-transparent border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                >
                  {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1 fill-current" />}
                  Run
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting || running}
                  className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white border-none"
                >
                  {submitting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                  Submit
                </Button>
              </div>
            </div>

            {/* Monaco editor and Console container */}
            <PanelGroup direction="vertical" className="flex-1 overflow-hidden">
              <Panel defaultSize={70} minSize={30} className="flex flex-col min-h-0">
                <Editor
                  height="100%"
                  language={LANG_MONACO_MAP[language] || "python"}
                  value={codes[language] || ""}
                  onChange={(val) => setCodes(prev => ({ ...prev, [language]: val || "" }))}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: "on",
                    padding: { top: 12 },
                  }}
                />
              </Panel>

              {/* Resize Handle */}
              <PanelResizeHandle className="h-2 bg-[#1e1e1e] flex items-center justify-center hover:bg-[#2d2d30] hover:h-2 transition-colors cursor-row-resize border-y border-[#3c3c3c] group">
                <div className="w-8 h-1 bg-[#3c3c3c] rounded-full group-hover:bg-[#007acc] transition-colors" />
              </PanelResizeHandle>

              {/* Console / Test Results */}
              <Panel defaultSize={30} minSize={15} className="flex flex-col bg-[#1e1e1e]">
              <div className="flex items-center gap-3 px-4 py-1.5 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
                <button
                  onClick={() => setActiveTab("output")}
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    activeTab === "output" ? "bg-[#37373d] text-white" : "text-[#858585] hover:text-white"
                  }`}
                >
                  <Terminal className="w-3 h-3 inline mr-1" />
                  Console
                </button>
                <button
                  onClick={() => setActiveTab("testcases")}
                  className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${
                    activeTab === "testcases" ? "bg-[#37373d] text-white" : "text-[#858585] hover:text-white"
                  }`}
                >
                  {submitResult ? (
                    submitResult.allPassed
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      : <XCircle className="w-3 h-3 text-rose-400" />
                  ) : <CheckCircle2 className="w-3 h-3" />}
                  Test Results
                  {submitResult && (
                    <span className={`text-[10px] font-bold ml-0.5 ${submitResult.allPassed ? "text-emerald-400" : "text-rose-400"}`}>
                      {submitResult.passed}/{submitResult.totalTests}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
                {activeTab === "output" && (
                  <>
                    {running && (
                      <div className="text-cyan-400 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Running...
                      </div>
                    )}
                    {submitting && (
                      <div className="text-cyan-400 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Submitting against test cases...
                      </div>
                    )}
                    {errors && (
                      <div className="text-red-400 flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <pre className="whitespace-pre-wrap">{errors}</pre>
                      </div>
                    )}
                    {output && <pre className="text-emerald-400 whitespace-pre-wrap">{output}</pre>}
                    {!running && !submitting && !output && !errors && (
                      <div className="text-[#858585]">
                        Click <span className="text-emerald-400 font-bold">"Run"</span> to check syntax, or{" "}
                        <span className="text-cyan-400 font-bold">"Submit"</span> to test against all cases...
                      </div>
                    )}
                  </>
                )}

                {activeTab === "testcases" && (
                  <>
                    {!submitResult ? (
                      <div className="text-[#858585] text-center py-6">
                        <Trophy className="w-6 h-6 mx-auto mb-2 text-[#555]" />
                        Submit your code to see test results
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                          submitResult.allPassed
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-rose-500/10 border-rose-500/30"
                        }`}>
                          <div className="flex items-center gap-2">
                            {submitResult.allPassed
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              : <XCircle className="w-4 h-4 text-rose-400" />}
                            <span className={`font-bold text-xs ${submitResult.allPassed ? "text-emerald-400" : "text-rose-400"}`}>
                              {submitResult.allPassed ? "All Tests Passed! 🎉" : `${submitResult.failed} Test(s) Failed`}
                            </span>
                          </div>
                          <span className="text-xs text-[#aaa] font-mono">
                            {submitResult.passed}/{submitResult.totalTests} passed
                          </span>
                        </div>

                        {submitResult.results.map((tc) => (
                          <div key={tc.testCase} className={`rounded-lg border px-3 py-2 ${
                            tc.passed
                              ? "border-emerald-500/20 bg-emerald-500/5"
                              : "border-rose-500/20 bg-rose-500/5"
                          }`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-[#999]">Test Case {tc.testCase}</span>
                              {tc.passed ? (
                                <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" /> Passed
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-400 text-[10px] font-bold">
                                  <XCircle className="w-3 h-3" /> Failed
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div>
                                <div className="text-[#666] uppercase font-bold mb-0.5">Input</div>
                                <pre className="bg-[#2d2d2d] rounded px-2 py-1 text-[#ccc] whitespace-pre-wrap overflow-x-auto">{tc.input}</pre>
                              </div>
                              <div>
                                <div className="text-[#666] uppercase font-bold mb-0.5">Expected</div>
                                <pre className="bg-[#2d2d2d] rounded px-2 py-1 text-[#ccc] whitespace-pre-wrap overflow-x-auto">{tc.expected}</pre>
                              </div>
                              <div>
                                <div className="text-[#666] uppercase font-bold mb-0.5">Got</div>
                                <pre className={`bg-[#2d2d2d] rounded px-2 py-1 whitespace-pre-wrap overflow-x-auto ${
                                  tc.passed ? "text-emerald-400" : "text-rose-400"
                                }`}>{tc.actual || "(empty)"}</pre>
                              </div>
                            </div>
                            {tc.errors && (
                              <div className="mt-1.5 text-rose-400 text-[10px]">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                {tc.errors}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
    </div>
  );
}
