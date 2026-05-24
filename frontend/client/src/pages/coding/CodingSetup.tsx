import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Loader2, Flame, BrainCircuit, Sparkles,
  BookOpen, ChevronRight, Search, Filter
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { auth } from "@/firebase";

const TOPICS = [
  "Arrays", "Strings", "Linked Lists", "Trees",
  "Dynamic Programming", "Sorting", "Searching",
  "Stacks & Queues", "Graphs", "Math"
];

const DIFFICULTIES = [
  { value: "easy", label: "Easy", color: "text-emerald-600", bg: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-400" },
  { value: "medium", label: "Medium", color: "text-amber-600", bg: "bg-amber-100 text-amber-700", ring: "ring-amber-400" },
  { value: "hard", label: "Hard", color: "text-rose-600", bg: "bg-rose-100 text-rose-700", ring: "ring-rose-400" },
];

interface BankQuestion {
  problemId: string;
  title: string;
  topic: string;
  difficulty: string;
  functionName: string;
}

export default function CodingSetup() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Question bank state
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [filterTopic, setFilterTopic] = useState<string>("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // AI generation state
  const [aiTopic, setAiTopic] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch bank questions on mount
  useEffect(() => {
    fetchBankQuestions();
  }, []);

  const fetchBankQuestions = async () => {
    setBankLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/coding/bank-questions`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setBankQuestions(data);
      }
    } catch (err) {
      console.error("Failed to load bank questions:", err);
    } finally {
      setBankLoading(false);
    }
  };

  const handleBankQuestionClick = (problemId: string) => {
    navigate(`/coding/solve?problem=${problemId}`);
  };

  const handleAIGenerate = async () => {
    if (!aiTopic || !user) return;
    setAiLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/coding/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.uid,
          topic: aiTopic,
          difficulty: aiDifficulty,
          language: "python",
          useAI: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem("codingSession", JSON.stringify(data));
        navigate("/coding/solve");
      }
    } catch (err) {
      console.error("Failed to generate AI problem:", err);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter questions
  const filtered = bankQuestions.filter((q) => {
    if (filterTopic && q.topic !== filterTopic) return false;
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Group by topic
  const grouped: Record<string, BankQuestion[]> = {};
  for (const q of filtered) {
    if (!grouped[q.topic]) grouped[q.topic] = [];
    grouped[q.topic].push(q);
  }

  const getDiffBadge = (diff: string) => {
    if (diff === "easy") return "bg-emerald-100 text-emerald-700";
    if (diff === "medium") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-64 overflow-hidden">
        <MobileNav />
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-muted/30">

        {/* LEFT: Question Bank */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 flex flex-col border-r bg-background overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b bg-white shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center border border-cyan-200">
                <BookOpen className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Code Practice</h1>
                <p className="text-xs text-slate-400">Browse & solve pre-built coding problems</p>
              </div>
            </div>

            {/* Search + Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[180px] relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search problems..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="">All Topics</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="">All Levels</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Question List */}
          <div className="flex-1 overflow-y-auto p-4">
            {bankLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-400">Loading questions...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-400">No questions available yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  {bankQuestions.length === 0
                    ? "Question bank is empty — use AI mode to generate problems"
                    : "No questions match your filters"}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {Object.entries(grouped).map(([topic, questions]) => (
                  <div key={topic}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Filter className="w-3 h-3 text-slate-400" />
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{topic}</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">{questions.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {questions.map((q) => (
                        <button
                          key={q.problemId}
                          onClick={() => handleBankQuestionClick(q.problemId)}
                          className="w-full text-left px-4 py-3 rounded-xl border border-slate-100 bg-white hover:border-cyan-200 hover:bg-cyan-50/30 transition-all hover:shadow-sm group flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-slate-700 group-hover:text-cyan-700 transition-colors truncate block">
                              {q.title}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{q.functionName}()</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getDiffBadge(q.difficulty)}`}>
                              {q.difficulty}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-cyan-500 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* RIGHT: AI Generation Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:w-[380px] w-full bg-background border-l flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto">
            {/* AI Header */}
            <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 border-b p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
              <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-violet-200 shadow-sm">
                <Sparkles className="w-7 h-7 text-violet-600" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-800 mb-1">AI Generated</h2>
              <p className="text-xs text-slate-500">Get a unique, AI-crafted problem on any topic</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Topic Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  Topic
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setAiTopic(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        aiTopic === t
                          ? "bg-violet-600 text-white shadow-md ring-2 ring-violet-600 ring-offset-1"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent hover:border-violet-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5" />
                  Difficulty
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((d) => {
                    const isSelected = aiDifficulty === d.value;
                    return (
                      <button
                        key={d.value}
                        onClick={() => setAiDifficulty(d.value)}
                        className={`py-2.5 rounded-xl border flex items-center justify-center font-bold text-xs transition-all ${
                          isSelected
                            ? `${d.bg} border-current ring-1 ${d.ring} shadow-sm`
                            : "border-border bg-card hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Button */}
              <Button
                size="lg"
                className="w-full h-12 text-sm font-bold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg rounded-xl transition-all"
                disabled={!aiTopic || aiLoading}
                onClick={handleAIGenerate}
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Problem
                  </>
                )}
              </Button>

              <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                AI generates a unique problem with 5 test cases.
                <br />Uses Groq AI — may take a few seconds.
              </p>
            </div>
          </div>
        </motion.div>
        </div>
      </div>
    </div>
  );
}
