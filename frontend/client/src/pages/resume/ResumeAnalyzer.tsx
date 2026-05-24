import { useCallback, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useUploadResume } from "@/hooks/use-api";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, CheckCircle, AlertTriangle, Loader2, RotateCcw, Star, Briefcase, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { ResumeUploadResponse } from "@/types/api-types";

export default function ResumeAnalyzer() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResumeUploadResponse | null>(null);
  
  const uploadResume = useUploadResume();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  const handleAnalyze = async () => {
    if (!file || !user) return;
    
    const formData = new FormData();
    formData.append("userId", user?.uid || "");
    formData.append("file", file);

    try {
      const analysisData = await uploadResume.mutateAsync(formData);
      setResult(analysisData);
    } catch (error: any) {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    }
  };

  // Determine ATS score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: "text-emerald-600", bg: "from-emerald-50 to-green-50", border: "border-emerald-200", label: "Excellent" };
    if (score >= 60) return { text: "text-yellow-600", bg: "from-yellow-50 to-amber-50", border: "border-yellow-200", label: "Good" };
    return { text: "text-red-500", bg: "from-red-50 to-orange-50", border: "border-red-200", label: "Needs Work" };
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-10 pb-12">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 mb-2">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold font-display">Resume Analyzer</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Upload your resume to check ATS compatibility and get AI-powered suggestions for improvement.
          </p>
        </div>

        {!result ? (
          <Card className="p-10 border-none shadow-xl bg-gradient-to-br from-white to-slate-50">
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-2xl min-h-[320px] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                isDragActive 
                  ? "border-emerald-400 bg-emerald-50/60 scale-[1.01]" 
                  : "border-muted-foreground/25 hover:border-emerald-400/60 hover:bg-slate-50"
              }`}
            >
              <input {...getInputProps()} />
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDragActive ? "bg-emerald-100 text-emerald-600" : "bg-blue-50 text-blue-500"}`}>
                <UploadCloud className="w-10 h-10" />
              </div>
              {file ? (
                <div className="text-center space-y-2">
                  <div className="flex items-center gap-2 justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <p className="font-bold text-xl text-emerald-700">{file.name}</p>
                  </div>
                  <p className="text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB • PDF</p>
                  <p className="text-sm text-muted-foreground mt-1">Click or drop to change file</p>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <p className="font-bold text-xl text-slate-700">
                    {isDragActive ? "Drop your resume here!" : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-muted-foreground">PDF files only · Max 5MB</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                onClick={handleAnalyze} 
                disabled={!file || uploadResume.isPending}
                className="min-w-[220px] h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20"
              >
                {uploadResume.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing your resume...
                  </>
                ) : (
                  "Analyze Resume →"
                )}
              </Button>
              {file && !uploadResume.isPending && (
                <Button variant="ghost" size="lg" className="h-12" onClick={() => setFile(null)}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Clear
                </Button>
              )}
            </div>

          </Card>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            {/* ATS Score Card */}
            {(() => {
              const sc = getScoreColor(result.atsScore);
              return (
                <Card className={`p-10 text-center bg-gradient-to-br ${sc.bg} border ${sc.border} shadow-xl`}>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-xl font-bold text-slate-700">ATS Compatibility Score</h2>
                    <Star className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className={`text-8xl font-black mb-3 ${sc.text}`}>{result.atsScore}</div>
                  <div className="text-slate-500 text-lg font-medium mb-4">out of 100</div>
                  <span className={`inline-block px-5 py-2 rounded-full text-sm font-bold border ${sc.border} ${sc.text} bg-white/70`}>
                    {sc.label}
                  </span>
                  <p className="text-slate-500 mt-5 text-base max-w-sm mx-auto">
                    {result.atsScore >= 80 
                      ? "Your resume is well-optimized for ATS systems. Great work!" 
                      : result.atsScore >= 60
                      ? "Your resume is fairly good. A few tweaks will make it stand out."
                      : "Your resume needs improvements to pass ATS filters effectively."}
                  </p>
                </Card>
              );
            })()}

            {/* Extracted Information */}
            <Card className="p-8 border-none shadow-lg">
              <h3 className="font-bold text-xl mb-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                Extracted Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Skills */}
                <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">Skills Detected</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.parsedData?.skills.length > 0 ? (
                      result.parsedData.skills.map((skill: string) => (
                        <span key={skill} className="bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-full font-semibold border border-blue-200">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No skills detected</p>
                    )}
                  </div>
                </div>

                {/* Experience */}
                <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-purple-500" />
                    <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">Experience Summary</p>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{result.parsedData?.experience || "No experience information detected."}</p>
                </div>

                {/* Education */}
                <div className="p-6 bg-slate-50 rounded-2xl space-y-4 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">Education</p>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{result.parsedData?.education || "No education information detected."}</p>
                </div>
              </div>
            </Card>

            {/* Suggestions */}
            <Card className="p-8 border-none shadow-lg">
              <h3 className="font-bold text-xl mb-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                Suggestions for Improvement
              </h3>
              <ul className="space-y-4">
                {result.suggestions.map((suggestion: string, idx: number) => (
                  <li key={idx} className="flex gap-4 items-start p-5 rounded-2xl bg-orange-50 border border-orange-100 text-orange-900">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-orange-500" />
                    <span className="text-sm leading-relaxed">{suggestion}</span>
                  </li>
                ))}
                <li className="flex gap-4 items-start p-5 rounded-2xl bg-green-50 border border-green-100 text-green-900">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />
                  <span className="text-sm leading-relaxed">Contact information is clear and professional.</span>
                </li>
              </ul>
            </Card>

            {/* Analyze Another */}
            <div className="flex justify-center pt-2">
              <Button 
                variant="outline" 
                size="lg"
                className="min-w-[220px] h-12 rounded-xl font-semibold"
                onClick={() => { setFile(null); setResult(null); }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Analyze Another Resume
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
