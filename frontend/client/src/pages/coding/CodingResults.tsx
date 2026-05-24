import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Code2, ArrowRight, Trophy, Zap, Eye, BarChart3, Loader2 } from "lucide-react";

interface CodingResult {
  overallScore: number;
  correctness: number;
  codeQuality: number;
  efficiency: number;
  readability: number;
  timeComplexity: string;
  spaceComplexity: string;
  isOptimal: boolean;
  feedback: string;
  strengths: string[];
  improvements: string[];
  betterApproach: string;
  modelSolution: string;
  testResults: {
    totalTests: number;
    passed: number;
    failed: number;
    allPassed: boolean;
    results: {
      testCase: number;
      input: string;
      expected: string;
      actual: string;
      passed: boolean;
      errors: string;
    }[];
  };
  problemTitle: string;
  language: string;
  difficulty: string;
  topic: string;
  optimalComplexity: { time: string; space: string };
}

export default function CodingResults() {
  const [, navigate] = useLocation();
  const [results, setResults] = useState<CodingResult | null>(null);
  const [showModel, setShowModel] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("codingResults");
    if (stored) {
      setResults(JSON.parse(stored));
    } else {
      navigate("/coding");
    }
  }, [navigate]);

  if (!results) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const scoreColor = results.overallScore >= 80 ? "text-green-600" : results.overallScore >= 50 ? "text-yellow-600" : "text-red-600";
  const diffColor = results.difficulty === "easy" ? "bg-green-100 text-green-700" : results.difficulty === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

  const metrics = [
    { label: "Correctness", value: results.correctness, icon: CheckCircle2, color: "text-green-500" },
    { label: "Code Quality", value: results.codeQuality, icon: Code2, color: "text-blue-500" },
    { label: "Efficiency", value: results.efficiency, icon: Zap, color: "text-yellow-500" },
    { label: "Readability", value: results.readability, icon: Eye, color: "text-purple-500" },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className={`w-8 h-8 ${scoreColor}`} />
          </div>
          <h1 className="text-3xl font-bold">Coding Results</h1>
          <div className="flex justify-center gap-2">
            <Badge className={diffColor}>{results.difficulty}</Badge>
            <Badge variant="outline">{results.topic}</Badge>
            <Badge variant="outline">{results.language}</Badge>
          </div>
          <h2 className="text-lg font-semibold text-muted-foreground">{results.problemTitle}</h2>
        </div>

        {/* Overall Score */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-white to-cyan-50/30">
          <CardContent className="pt-8 pb-8 text-center">
            <div className={`text-6xl font-black ${scoreColor} mb-2`}>{results.overallScore}</div>
            <p className="text-sm text-muted-foreground font-medium">Overall Score</p>
          </CardContent>
        </Card>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <Card key={m.label} className="border-none shadow-sm">
              <CardContent className="pt-5 text-center">
                <m.icon className={`w-5 h-5 mx-auto mb-2 ${m.color}`} />
                <div className="text-2xl font-black text-slate-800">{m.value}%</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{m.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Complexity */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Your Complexity</p>
                  <p className="text-lg font-bold mt-1">Time: {results.timeComplexity}</p>
                  <p className="text-lg font-bold">Space: {results.spaceComplexity}</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${results.isOptimal ? 'bg-green-100' : 'bg-orange-100'}`}>
                  <BarChart3 className={`w-6 h-6 ${results.isOptimal ? 'text-green-600' : 'text-orange-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Optimal Complexity</p>
                <p className="text-lg font-bold mt-1">Time: {results.optimalComplexity?.time || "N/A"}</p>
                <p className="text-lg font-bold">Space: {results.optimalComplexity?.space || "N/A"}</p>
              </div>
              <Badge className={`mt-2 ${results.isOptimal ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {results.isOptimal ? '✅ Optimal Solution' : '⚡ Can Be Optimized'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Test Cases
              <Badge className={results.testResults.allPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {results.testResults.passed}/{results.testResults.totalTests} Passed
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.testResults.results.map((tc) => (
              <div key={tc.testCase} className={`rounded-lg border p-3 ${tc.passed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Test Case {tc.testCase}</span>
                  {tc.passed ? (
                    <div className="flex items-center gap-1 text-green-600 text-xs font-bold"><CheckCircle2 className="w-3 h-3" /> Passed</div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-bold"><XCircle className="w-3 h-3" /> Failed</div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Input:</span><pre className="bg-white rounded p-1 mt-0.5 overflow-x-auto">{tc.input}</pre></div>
                  <div><span className="text-muted-foreground">Expected:</span><pre className="bg-white rounded p-1 mt-0.5 overflow-x-auto">{tc.expected}</pre></div>
                  <div><span className="text-muted-foreground">Got:</span><pre className="bg-white rounded p-1 mt-0.5 overflow-x-auto">{tc.actual || "(empty)"}</pre></div>
                </div>
                {tc.errors && <p className="text-xs text-red-600 mt-2">{tc.errors}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Feedback */}
        <Card className="border-cyan-200 bg-cyan-50/50">
          <CardHeader><CardTitle className="text-base">💬 Feedback</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-700">{results.feedback}</p>
          </CardContent>
        </Card>

        {/* Strengths & Improvements */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader><CardTitle className="text-base text-green-700">✅ Strengths</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {results.strengths?.map((s, i) => (
                  <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50/30">
            <CardHeader><CardTitle className="text-base text-orange-700">🔧 Improvements</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {results.improvements?.map((s, i) => (
                  <li key={i} className="text-sm text-orange-800 flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Better Approach */}
        {results.betterApproach && (
          <Card>
            <CardHeader><CardTitle className="text-base">💡 Better Approach</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-700">{results.betterApproach}</p>
            </CardContent>
          </Card>
        )}

        {/* Model Solution */}
        {results.modelSolution && (
          <div>
            <Button variant="outline" onClick={() => setShowModel(!showModel)} className="mb-3">
              {showModel ? "Hide" : "Show"} Model Solution
            </Button>
            {showModel && (
              <Card className="bg-[#1e1e1e] text-white border-none">
                <CardContent className="pt-4">
                  <pre className="text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{results.modelSolution}</pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center pt-4">
          <Link href="/coding">
            <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-600">
              Try Another Problem
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
