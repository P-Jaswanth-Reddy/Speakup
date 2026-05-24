import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {  ChevronDown, CheckCircle2, XCircle, Clock, Target } from "lucide-react";
import { useLocation } from "wouter";

export default function AptitudeResults() {
  const [, setLocation] = useLocation();
  const [results, setResults] = useState<any>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("aptitude_results");
    if (saved) {
      setResults(JSON.parse(saved));
    } else {
      // Redirect if no results found
      setLocation("/aptitude");
    }
  }, [setLocation]);

  const toggleQuestion = (index: number) => {
    setExpandedQuestion(prev => prev === index ? null : index);
  };

  if (!results) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Test Results</h1>
          <p className="text-muted-foreground capitalize">{results.topic} Aptitude Test</p>
        </div>

        {/* Score Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-around gap-6">
              {/* Main Score */}
              <div className="text-center">
                <div className="text-6xl font-bold text-primary mb-2">{results.score}%</div>
                <Badge variant={results.score >= 75 ? "default" : results.score >= 50 ? "secondary" : "destructive"} className="text-sm">
                  {results.performanceLevel}
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">{results.correctAnswers}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Correct</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-2xl font-bold text-red-600">{results.incorrectAnswers}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Incorrect</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Target className="w-4 h-4 text-gray-600" />
                    <span className="text-2xl font-bold text-gray-600">{results.unansweredQuestions}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-2xl font-bold text-blue-600">{results.completionMetrics.timeTakenMinutes}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Minutes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completion Status */}
        {results.completionMetrics && !results.completionMetrics.isFullyCompleted && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <p className="text-sm text-orange-800">
                ⚠️ Test partially completed: {results.completionMetrics.questionsAnswered}/{results.completionMetrics.totalQuestions} questions ({results.completionMetrics.completionPercentage}%)
              </p>
            </CardContent>
          </Card>
        )}

        {/* Question Breakdown */}
        {results.questionBreakdown && results.questionBreakdown.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Question Review</h2>
            {results.questionBreakdown.map((q: any, i: number) => {
              const isExpanded = expandedQuestion === i;
              const statusColor = 
                q.status === "correct" ? "border-green-200 bg-green-50/30" :
                q.status === "incorrect" ? "border-red-200 bg-red-50/30" :
                "border-gray-200 bg-gray-50/30";
              
              return (
                <Card key={i} className={`overflow-hidden ${statusColor} hover:border-primary/40 transition-colors`}>
                  <div 
                    onClick={() => toggleQuestion(i)}
                    className="p-4 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <ChevronDown className={`w-4 h-4 text-primary transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                          <span className="text-xs font-bold text-primary">QUESTION {q.questionNumber}</span>
                          {q.status === "correct" && (
                            <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Correct</Badge>
                          )}
                          {q.status === "incorrect" && (
                            <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Incorrect</Badge>
                          )}
                          {q.status === "unanswered" && (
                            <Badge variant="secondary">Skipped</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium pl-7">{q.questionText}</p>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <CardContent className="p-4 pt-0 space-y-4 animate-in slide-in-from-top-2">
                      {/* Options */}
                      <div className="space-y-2 pl-7">
                        {q.options.map((option: string, idx: number) => {
                          const isCorrect = idx === q.correctAnswer;
                          const isUserAnswer = idx === q.userAnswer;
                          
                          let bgColor = "";
                          if (isCorrect) bgColor = "bg-green-100 border-green-300";
                          else if (isUserAnswer && !isCorrect) bgColor = "bg-red-100 border-red-300";
                          else bgColor = "bg-gray-50 border-gray-200";
                          
                          return (
                            <div key={idx} className={`p-3 rounded-lg border ${bgColor} flex items-center gap-2`}>
                              {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                              {isUserAnswer && !isCorrect && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                              <span className="text-sm">
                                <strong>{String.fromCharCode(65 + idx)}.</strong> {option}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="space-y-2 pl-7">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                            <p className="text-[11px] font-bold text-blue-700">EXPLANATION</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <p className="text-sm text-blue-900">{q.explanation}</p>
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

        {/* Action Button */}
        <div className="flex justify-center pt-4">
          <Button 
            onClick={() => setLocation("/dashboard")} 
            size="lg"
            className="px-8 font-bold"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </Layout>
  );
}
