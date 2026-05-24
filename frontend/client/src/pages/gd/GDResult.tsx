import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, CheckCircle, XCircle, ArrowRight, Home, Share2, Activity, Brain, MessageSquare, Target, Mic, Users, RefreshCcw } from "lucide-react";
import { GDEndResponse } from "@/types/api-types";

interface GDResultProps {
    result: GDEndResponse;
    onBack?: () => void;
}

export default function GDResult({ result, onBack }: GDResultProps) {
  if (!result) return null;
  
  const handleHome = () => window.location.href = "/";
  const handleNew = () => window.location.href = "/gd/setup";

  const metrics = [
    { label: "Verbal Ability", score: result.verbalAbility, icon: Mic, color: "text-blue-500", bg: "bg-blue-500" },
    { label: "Confidence", score: result.confidence, icon: Trophy, color: "text-amber-500", bg: "bg-amber-500" },
    { label: "Interactivity", score: result.interactivity, icon: Users, color: "text-green-500", bg: "bg-green-500" },
    { label: "Argument Quality", score: result.argumentQuality, icon: Brain, color: "text-purple-500", bg: "bg-purple-500" },
    { label: "Topic Relevance", score: result.topicRelevance, icon: Target, color: "text-red-500", bg: "bg-red-500" },
    { label: "Leadership", score: result.leadership, icon: Activity, color: "text-indigo-500", bg: "bg-indigo-500" },
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Performance Report</span>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">GD Session Analysis</h1>
          </div>
          <Button onClick={handleHome}>
            <Home className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>

        {/* Completion Metrics */}
        {result.completionMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <Card className="border-none shadow-sm bg-muted/30">
               <CardContent className="pt-4 pb-4 text-center">
                 <div className="text-2xl font-bold text-primary">{result.completionMetrics.sessionDurationMinutes}m</div>
                 <p className="text-xs font-medium text-muted-foreground">Session Duration</p>
               </CardContent>
             </Card>
             <Card className="border-none shadow-sm bg-muted/30">
               <CardContent className="pt-4 pb-4 text-center">
                 <div className="text-2xl font-bold text-primary">{result.completionMetrics.userTurns}/{result.completionMetrics.totalTurns}</div>
                 <p className="text-xs font-medium text-muted-foreground">Your Turns vs Total</p>
               </CardContent>
             </Card>
             <Card className="border-none shadow-sm bg-muted/30 col-span-2">
                 <CardContent className="pt-4 pb-4 flex items-center justify-center h-full gap-6">
                    <div className="text-center">
                       <div className="text-2xl font-bold text-primary">{result.completionMetrics.completionPercentage}%</div>
                       <p className="text-xs font-medium text-muted-foreground">Time Completed</p>
                    </div>
                    <div>
                        {!result.completionMetrics.isFullyCompleted ? (
                            <Badge variant="destructive">Ended Early</Badge>
                        ) : (
                            <Badge className="bg-green-600 hover:bg-green-700">Fully Completed</Badge>
                        )}
                    </div>
                 </CardContent>
             </Card>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Main Score Card */}
            <div className="md:col-span-4 space-y-6">
                <Card className="overflow-hidden border-2 border-primary/10 shadow-lg bg-gradient-to-br from-white to-blue-50/50">
                    <CardHeader className="text-center pb-2">
                        <CardTitle className="text-lg text-muted-foreground font-medium">Overall Score</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <div className="relative w-40 h-40 flex items-center justify-center mb-4">
                            <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle className="text-slate-100" strokeWidth="8" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                                <circle 
                                    className="text-primary transition-all duration-1000 ease-out" 
                                    strokeWidth="8" 
                                    strokeLinecap="round" 
                                    stroke="currentColor" 
                                    fill="transparent" 
                                    r="40" 
                                    cx="50" 
                                    cy="50"
                                    strokeDasharray="251.2"
                                    strokeDashoffset={251.2 * (1 - result.overallScore / 100)} 
                                />
                            </svg>
                            <span className="text-4xl font-black text-slate-800 tracking-tighter">{result.overallScore}</span>
                        </div>
                        <Badge variant={result.overallScore >= 80 ? "default" : result.overallScore >= 60 ? "secondary" : "destructive"} className="text-sm px-3 py-1">
                            {result.overallScore >= 80 ? "Excellent" : result.overallScore >= 60 ? "Good" : "Needs Improvement"}
                        </Badge>
                        
                        {result.pauseCount != undefined && result.pauseCount > 0 && (
                            <div className="mt-6 w-full bg-orange-50 border border-orange-100 rounded-lg p-3 flex items-center gap-3 text-xs text-orange-700">
                                <div className="bg-orange-100 p-1.5 rounded-full"><Activity className="w-3 h-3" /></div>
                                <span>{result.pauseCount} pauses detected (Penalty applied)</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Metrics Breakdown */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Skill Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {metrics.map((m) => (
                            <div key={m.label} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-medium">
                                    <div className="flex items-center gap-2">
                                        <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
                                        <span>{m.label}</span>
                                    </div>
                                    <span className="font-bold">{m.score}/100</span>
                                </div>
                                <Progress value={m.score} className={`h-2 [&>div]:${m.bg}`} />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Feedback */}
            <div className="md:col-span-8">
                <Tabs defaultValue="feedback" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="feedback">Analysis</TabsTrigger>
                        <TabsTrigger value="strengths">Strengths</TabsTrigger>
                        <TabsTrigger value="improvements">Improvements</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="feedback" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                         <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-primary" />
                                    Detailed Feedback
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                    {result.feedback}
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="strengths" className="animate-in fade-in slide-in-from-bottom-2">
                        <Card className="border-green-100 bg-green-50/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-green-700">
                                    <CheckCircle className="w-5 h-5" />
                                    Key Strengths
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    {result.strengths.map((str, i) => (
                                        <li key={i} className="flex gap-3 text-sm text-slate-700 bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                            {str}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="improvements" className="animate-in fade-in slide-in-from-bottom-2">
                        <Card className="border-red-100 bg-red-50/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-700">
                                    <Target className="w-5 h-5" />
                                    Areas for Improvement
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    {result.improvements.map((imp, i) => (
                                        <li key={i} className="flex gap-3 text-sm text-slate-700 bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                            {imp}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
      </div>
    </Layout>
  );
}
