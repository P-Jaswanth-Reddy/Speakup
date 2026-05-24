import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, UserCheck, Terminal, Upload, X, Target, GraduationCap, Award, Briefcase } from "lucide-react";

export default function InterviewSetup() {
  const [, setLocation] = useLocation();
  const [type, setType] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("mid");
  const [mode, setMode] = useState<string>("graded");
  const [jobRole, setJobRole] = useState<string>("Software Engineer");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
    }
  };

  const handleStart = () => {
    if (!type) return;
    
    // Store setup in sessionStorage for the interview flow
    const state = {
      interviewType: type,
      difficulty,
      mode,
      jobRole,
      resumeFile: resumeFile ? resumeFile.name : null,
      hasResume: !!resumeFile
    };

    sessionStorage.setItem("interview_setup", JSON.stringify(state));
    setLocation("/interview/start");
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8 py-8 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Mock Interview Setup</h1>
          <p className="text-muted-foreground">Configure your AI-powered interview experience</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resume Upload (Optional)</CardTitle>
            <CardDescription>Upload your resume for personalized, resume-based questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!resumeFile ? (
              <div 
                className="border-2 border-dashed rounded-lg p-4 flex flex-col sm:flex-row items-center justify-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="text-center sm:text-left flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <p className="text-sm font-medium">Click to upload PDF resume</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">•</p>
                  <p className="text-xs text-muted-foreground">Accepts PDF only</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf" 
                  onChange={handleFileUpload} 
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <FileText className="w-5 h-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{resumeFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(resumeFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setResumeFile(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interview Configuration</CardTitle>
            <CardDescription>Customize interview type, difficulty, and mode</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Interview Type */}
            <div className="space-y-2">
              <Label>Interview Type</Label>
              <Select onValueChange={setType} value={type}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose interview type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      <span>Technical Interview</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="hr">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      <span>HR Interview</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="behavioral">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Behavioral Interview</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty Level */}
            <div className="space-y-2">
              <Label>Difficulty Level</Label>
              <Select onValueChange={setDifficulty} value={difficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Junior Level</span>
                        <span className="text-xs text-muted-foreground">Entry-level questions</span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="mid">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Mid Level</span>
                        <span className="text-xs text-muted-foreground">Intermediate complexity</span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="senior">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Senior Level</span>
                        <span className="text-xs text-muted-foreground">Advanced concepts</span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Job Role Input */}
            <div className="space-y-2">
              <Label>Target Job Role</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="e.g. Product Manager, Backend Developer" 
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Practice vs Graded Mode */}
            <div className="space-y-2">
              <Label>Interview Mode</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`p-4 rounded-lg border-2 transition-all ${
                    mode === "practice" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setMode("practice")}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <FileText className={`w-5 h-5 ${mode === "practice" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-semibold text-sm">Practice Mode</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Feedback only, no scoring</p>
                    </div>
                  </div>
                </button>
                
                <button
                  className={`p-4 rounded-lg border-2 transition-all ${
                    mode === "graded" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setMode("graded")}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Award className={`w-5 h-5 ${mode === "graded" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-semibold text-sm">Graded Mode</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Full scoring + feedback</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <Button 
              className="w-full h-11 text-base font-semibold shadow-sm" 
              onClick={handleStart} 
              disabled={!type}
            >
              Start Interview
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
