import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Loader2, ChevronDown, Sparkles, Target, BookOpen, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";

type TeachMeCache = {
  [questionId: string]: {
    context: string;
    example: string;
    focusAreas: string[];
  }
};

export default function InterviewResults() {
  const { toast } = useToast();
  const [results, setResults] = useState<any>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [showTeachMe, setShowTeachMe] = useState(false);
  const [currentTeachMe, setCurrentTeachMe] = useState<any>(null);
  const [teachMeLoading, setTeachMeLoading] = useState(false);
  const [teachMeCache, setTeachMeCache] = useState<TeachMeCache>({});

  useEffect(() => {
    const saved = sessionStorage.getItem("interview_results");
    if (saved) {
      const parsed = JSON.parse(saved);
      setResults(parsed);
    } else {
      toast({ title: "No results found", description: "Please complete an interview first", variant: "destructive" });
      setTimeout(() => window.location.href = "/interview", 2000);
    }
  }, []);

  const toggleQuestion = (index: number) => {
    // Accordion behavior - only one open at a time
    if (expandedQuestions.has(index)) {
      setExpandedQuestions(new Set()); // Close current
    } else {
      setExpandedQuestions(new Set([index])); // Open only this one
    }
  };

  const handleTeachMe = async (questionId: string, questionText: string, userAnswer: string) => {
    // Check cache first
    if (teachMeCache[questionId]) {
      setCurrentTeachMe(teachMeCache[questionId]);
      setShowTeachMe(true);
      return;
    }

    // Fetch from API
    setShowTeachMe(true);
    setTeachMeLoading(true);
    setCurrentTeachMe(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/interview/teach-me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          questionText,
          userAnswer
        })
      });

      const data = await res.json();
      
      // Backend now returns structured data: { context, example, focusAreas }
      const structured = {
        context: data.context || "This question tests important interview skills.",
        example: data.example || "Practice with specific examples from your experience.",
        focusAreas: data.focusAreas || ["Be specific", "Show impact", "Stay concise"]
      };
      
      // Cache it
      setTeachMeCache(prev => ({
        ...prev,
        [questionId]: structured
      }));
      
      setCurrentTeachMe(structured);
      setTeachMeLoading(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setShowTeachMe(false);
      setTeachMeLoading(false);
    }
  };


  if (!results) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const isGradedMode = results.mode === "graded" || results.overallScore !== undefined;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Interview Results</h1>
          <p className="text-muted-foreground">
            {isGradedMode ? "Review your scores and feedback" : "Review your feedback and areas for growth"}
          </p>
        </div>

        {/* Completion Metrics */}
        {results.completionMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <Card className="border-none shadow-sm bg-muted/30">
               <CardContent className="pt-4 pb-4 text-center">
                 <div className="text-2xl font-bold text-primary">{results.completionMetrics.questionsAnswered}/{results.completionMetrics.totalQuestions}</div>
                 <p className="text-xs font-medium text-muted-foreground">Questions Answered</p>
               </CardContent>
             </Card>
             <Card className="border-none shadow-sm bg-muted/30">
               <CardContent className="pt-4 pb-4 text-center">
                 <div className="text-2xl font-bold text-primary">{results.completionMetrics.sessionDurationMinutes}m</div>
                 <p className="text-xs font-medium text-muted-foreground">Duration</p>
               </CardContent>
             </Card>
             <Card className="border-none shadow-sm bg-muted/30 col-span-2">
                 <CardContent className="pt-4 pb-4 flex items-center justify-center h-full gap-6">
                    <div className="text-center">
                       <div className="text-2xl font-bold text-primary">{results.completionMetrics.completionPercentage}%</div>
                       <p className="text-xs font-medium text-muted-foreground">Completion</p>
                    </div>
                    <div>
                        {!results.completionMetrics.isFullyCompleted ? (
                            <Badge variant="destructive">Ended Early</Badge>
                        ) : (
                            <Badge className="bg-green-600 hover:bg-green-700">Fully Completed</Badge>
                        )}
                    </div>
                 </CardContent>
             </Card>
          </div>
        )}

        {/* Scores */}
        {isGradedMode && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {results.metrics && (
              <>
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold mb-1 text-blue-600">{results.metrics.technicalAccuracy}%</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Technical</div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold mb-1 text-emerald-600">{results.metrics.communicationClarity}%</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Communication</div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold mb-1 text-purple-600">{results.metrics.confidence}%</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Confidence</div>
                  </CardContent>
                </Card>
              </>
            )}
            <Card className="border-none shadow-sm bg-primary/5">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold mb-1 text-primary">{results.overallScore}%</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Overall</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bonus */}
        {results.greetingBonus > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <p className="text-sm text-green-800">
                🎉 <strong>+{results.greetingBonus} bonus points</strong> for professional greeting!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Overall Feedback */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader><CardTitle className="text-lg">Overall Feedback</CardTitle></CardHeader>
          <CardContent><p className="text-sm leading-relaxed">{results.overallFeedback}</p></CardContent>
        </Card>

        {/* Confidence & Structure Breakdown (Phase 3) */}
        {(results.confidenceSummary || results.structureSummary) && (
          <div className="grid md:grid-cols-2 gap-6">
            {results.confidenceSummary && (
              <Card className="border-purple-200 bg-purple-50/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-xs">🎯</span>
                    </div>
                    Confidence Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-xl font-black text-purple-600">{results.confidenceSummary.totalHesitationsAcrossAnswers}</div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Hesitation Phrases</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-xl font-black text-purple-600">{results.confidenceSummary.answersWithAssertiveLanguage}/{results.confidenceSummary.totalAnswers}</div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Assertive Answers</p>
                    </div>
                  </div>
                  {results.confidenceSummary.tips?.length > 0 && (
                    <div className="space-y-2">
                      {results.confidenceSummary.tips.map((tip: string, i: number) => (
                        <p key={i} className="text-xs text-purple-800 bg-white rounded-lg p-2 border border-purple-100">💡 {tip}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {results.structureSummary && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs">📐</span>
                    </div>
                    Answer Structure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-xl font-black text-blue-600">{results.structureSummary.answersWithStarStructure}/{results.structureSummary.totalAnswers}</div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">STAR Format</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-xl font-black text-blue-600">{results.structureSummary.answersWithLogicalFlow}/{results.structureSummary.totalAnswers}</div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Logical Flow</p>
                    </div>
                  </div>
                  {results.structureSummary.tips?.length > 0 && (
                    <div className="space-y-2">
                      {results.structureSummary.tips.map((tip: string, i: number) => (
                        <p key={i} className="text-xs text-blue-800 bg-white rounded-lg p-2 border border-blue-100">💡 {tip}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Strengths & Improvements */}
        <div className="grid md:grid-cols-2 gap-6">
          {results.strengths && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.strengths.length > 0 ? (
                  <ul className="space-y-3">
                    {results.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-sm flex-1 pt-1">{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No specific strengths were identified. Try answering more questions for detailed feedback.</p>
                )}
              </CardContent>
            </Card>
          )}
          
          {results.areasForImprovement && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.areasForImprovement.length > 0 ? (
                  <ul className="space-y-3">
                    {results.areasForImprovement.map((a: string, i: number) => (
                      <li key={i} className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Target className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="text-sm flex-1 pt-1">{a}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No specific improvement areas identified.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Question Breakdown - Colorful & Fully Clickable */}
        {results.questionBreakdown && results.questionBreakdown.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Question-by-Question Review</h2>
            {results.questionBreakdown.map((qa: any, i: number) => {
              const isExpanded = expandedQuestions.has(i);
              
              return (
                <Card key={i} className="overflow-hidden border-primary/20 hover:border-primary/40 transition-colors">
                  {/* Fully Clickable Header */}
                  <div 
                    onClick={() => toggleQuestion(i)}
                    className="p-4 bg-gradient-to-r from-primary/5 to-purple-500/5 border-b cursor-pointer hover:from-primary/10 hover:to-purple-500/10 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <ChevronDown className={`w-4 h-4 text-primary transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                          <span className="text-xs font-bold text-primary">QUESTION {qa.questionNumber || i + 1}</span>
                          {isGradedMode && qa.score !== undefined && (
                            <Badge variant={qa.score >= 7 ? "default" : "secondary"} className={qa.score >= 7 ? "bg-green-600" : ""}>
                              {qa.score}/10
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium pl-7">{qa.questionText}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="gap-2 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTeachMe(qa.questionId, qa.questionText, qa.userAnswer);
                        }}
                      >
                        <HelpCircle className="w-4 h-4" />
                        Teach Me
                      </Button>
                    </div>
                  </div>
                  
                  {/* Collapsible Content with Colors */}
                  {isExpanded && (
                    <CardContent className="p-4 space-y-4 animate-in slide-in-from-top-2">
                      {/* Answer Section - Green */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                          <p className="text-[11px] font-bold text-green-700">YOUR ANSWER</p>
                        </div>
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                          <p className="text-sm text-green-900 italic">"{qa.userAnswer}"</p>
                        </div>
                      </div>
                      
                      {/* Feedback Section - Yellow/Orange */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                          <p className="text-[11px] font-bold text-amber-700">FEEDBACK</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                          <p className="text-sm text-amber-900">{qa.feedback}</p>
                        </div>
                      </div>
                      
                      {/* Tips Section - Blue (if exists) */}
                      {qa.improvementTips && qa.improvementTips.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                            <p className="text-[11px] font-bold text-blue-700">TIPS FOR IMPROVEMENT</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <ul className="text-sm space-y-2">
                              {qa.improvementTips.map((tip: string, idx: number) => (
                                <li key={idx} className="flex gap-2 text-blue-900">
                                  <span className="text-blue-600">•</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Action Button - Only Dashboard */}
        <div className="flex justify-center pt-4">
          <Button 
            onClick={() => window.location.href = "/dashboard"} 
            size="lg"
            className="px-8 font-bold"
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Teach Me Dialog */}
        <Dialog open={showTeachMe} onOpenChange={setShowTeachMe}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Coaching
              </DialogTitle>
              <DialogDescription>Learn how to master this question</DialogDescription>
            </DialogHeader>
            
            {teachMeLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin w-8 h-8 text-primary" />
              </div>
            ) : currentTeachMe ? (
              <div className="space-y-6 py-4">
                {/* Context */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-sm">Context</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                    {currentTeachMe.context}
                  </p>
                </div>

                {/* Example */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-sm">Example</h3>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg ml-10">
                    <p className="text-sm leading-relaxed">
                      {currentTeachMe.example}
                    </p>
                  </div>
                </div>

                {/* Focus Areas */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <Target className="w-4 h-4 text-orange-600" />
                    </div>
                    <h3 className="font-semibold text-sm">Key Focus Areas</h3>
                  </div>
                  <ul className="space-y-2 pl-10">
                    {currentTeachMe.focusAreas.map((area: string, idx: number) => (
                      <li key={idx} className="flex gap-2 items-start">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-sm flex-1">{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
