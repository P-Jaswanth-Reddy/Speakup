import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useAptitudeHistory, useInterviewHistory, useGdHistory, useResumeHistory, useCodingHistory } from "@/hooks/use-api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User as UserIcon, Briefcase, Calendar, MapPin, Edit2, Check, FileText, TrendingUp, Clock, Sparkles, Code2, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

const AVATARS = [
  // Male Avatars
  { id: 'm1', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix' },
  { id: 'm2', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Chase' },
  { id: 'm3', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack' },
  { id: 'm4', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Derek' },
  // Female Avatars
  { id: 'f1', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Molly' },
  { id: 'f2', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lisa' },
  { id: 'f3', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Annie' },
  { id: 'f4', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Chloe' },
];

function ResumeDetailModal({ result }: { result: any }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <p className="font-bold text-lg">{result.fileName}</p>
            <p className="text-sm text-muted-foreground">{format(new Date(result.createdAt), 'PPp')}</p>
          </div>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-600">{result.atsScore}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">ATS Score</div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          AI Suggestions
        </h4>
        <div className="grid gap-2">
          {result.suggestions?.map((suggestion: string, i: number) => (
            <div key={i} className="p-3 bg-muted/20 rounded-md border text-sm">
              {suggestion}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Detail Modal Components
function AptitudeDetailModal({ result }: { result: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Score</p>
          <p className="text-3xl font-bold text-primary">{result.score}%</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Performance</p>
          <p className="text-xl font-semibold">{result.performanceLevel || "N/A"}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{result.correctAnswers || 0}</p>
          <p className="text-xs text-muted-foreground">Correct</p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-center">
          <p className="text-2xl font-bold text-red-600">{result.incorrectAnswers || 0}</p>
          <p className="text-xs text-muted-foreground">Incorrect</p>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
          <p className="text-2xl font-bold">{result.unansweredQuestions || 0}</p>
          <p className="text-xs text-muted-foreground">Unanswered</p>
        </div>
      </div>

      <div className="p-4 bg-muted/30 rounded-lg space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total Questions</span>
          <span className="font-semibold">{result.totalQuestions}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Time Taken</span>
          <span className="font-semibold">{Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Accuracy</span>
          <span className="font-semibold">{result.accuracy}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Date</span>
          <span className="font-semibold">{format(new Date(result.createdAt), 'PPp')}</span>
        </div>
      </div>
    </div>
  );
}

function InterviewDetailModal({ result }: { result: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{result.communicationScore}</p>
          <p className="text-xs text-muted-foreground">Communication</p>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg text-center">
          <p className="text-2xl font-bold text-purple-600">{result.confidenceScore}</p>
          <p className="text-xs text-muted-foreground">Confidence</p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{result.relevanceScore}</p>
          <p className="text-xs text-muted-foreground">Relevance</p>
        </div>
      </div>

      {result.interviewType && (
        <div className="p-4 bg-muted/30 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Interview Type</span>
            <span className="font-semibold">{result.interviewType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Job Role</span>
            <span className="font-semibold">{result.jobRole || "General"}</span>
          </div>
          {result.questionCount && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Questions Asked</span>
              <span className="font-semibold">{result.questionCount}</span>
            </div>
          )}
          {result.sessionDuration && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="font-semibold">{result.sessionDuration} minutes</span>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-muted/30 rounded-lg">
        <p className="text-sm font-semibold mb-2">Feedback</p>
        <p className="text-sm text-muted-foreground">{result.feedback}</p>
      </div>

      <p className="text-xs text-muted-foreground">{format(new Date(result.createdAt), 'PPp')}</p>
    </div>
  );
}

function GDDetailModal({ result }: { result: any }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-lg">
        <p className="text-sm text-muted-foreground">Overall Score</p>
        <p className="text-4xl font-bold text-orange-600">{result.score}</p>
      </div>

      {(result.verbalAbility || result.confidence) && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {result.verbalAbility !== undefined && (
              <div className="p-3 bg-muted/40 rounded text-center">
                <p className="text-lg font-bold">{result.verbalAbility}</p>
                <p className="text-[10px] text-muted-foreground">Verbal</p>
              </div>
            )}
            {result.confidence !== undefined && (
              <div className="p-3 bg-muted/40 rounded text-center">
                <p className="text-lg font-bold">{result.confidence}</p>
                <p className="text-[10px] text-muted-foreground">Confidence</p>
              </div>
            )}
            {result.interactivity !== undefined && (
              <div className="p-3 bg-muted/40 rounded text-center">
                <p className="text-lg font-bold">{result.interactivity}</p>
                <p className="text-[10px] text-muted-foreground">Interactive</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {result.argumentQuality !== undefined && (
              <div className="p-3 bg-muted/40 rounded text-center">
                <p className="text-lg font-bold">{result.argumentQuality}</p>
                <p className="text-[10px] text-muted-foreground">Arguments</p>
              </div>
            )}
            {result.topicRelevance !== undefined && (
              <div className="p-3 bg-muted/40 rounded text-center">
                <p className="text-lg font-bold">{result.topicRelevance}</p>
                <p className="text-[10px] text-muted-foreground">Relevance</p>
              </div>
            )}
            {result.leadership !== undefined && (
              <div className="p-3 bg-muted/40 rounded text-center">
                <p className="text-lg font-bold">{result.leadership}</p>
                <p className="text-[10px] text-muted-foreground">Leadership</p>
              </div>
            )}
          </div>
        </>
      )}

      {result.strengths && result.strengths.length > 0 && (
        <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">✓ Strengths</p>
          <ul className="list-disc list-inside space-y-1">
            {result.strengths.map((s: string, i: number) => (
              <li key={i} className="text-sm text-muted-foreground">{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.improvements && result.improvements.length > 0 && (
        <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
          <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2">→ Areas for Improvement</p>
          <ul className="list-disc list-inside space-y-1">
            {result.improvements.map((imp: string, i: number) => (
              <li key={i} className="text-sm text-muted-foreground">{imp}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between items-center p-3 bg-muted/30 rounded">
        <span className="text-sm">Duration: {result.duration} mins</span>
        {result.pauseCount > 0 && (
          <span className="text-sm text-orange-600">Pauses: {result.pauseCount} (-{result.pausePenalty} pts)</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{format(new Date(result.createdAt), 'PPp')}</p>
    </div>
  );
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [, navigate] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.name || '',
    age: user?.age || '',
    gender: user?.gender || '',
    occupation: user?.occupation || '',
    avatarUrl: user?.avatarUrl || ''
  });

  const { data: aptitudeData, isLoading: aptLoading } = useAptitudeHistory(user?.uid || "");
  const { data: interviewData, isLoading: intLoading } = useInterviewHistory(user?.uid || "");
  const { data: gdData, isLoading: gdLoading } = useGdHistory(user?.uid || "");
  const { data: resumeData, isLoading: resumeLoading } = useResumeHistory(user?.uid || "");
  const { data: codingData, isLoading: codingLoading } = useCodingHistory(user?.uid || "");

  const [selectedAptitude, setSelectedAptitude] = useState<any>(null);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [selectedGD, setSelectedGD] = useState<any>(null);
  const [selectedResume, setSelectedResume] = useState<any>(null);
  const [selectedCoding, setSelectedCoding] = useState<any>(null);

  if (!user) return null;

  const handleSave = async () => {
    await updateProfile({
      ...editData,
      age: editData.age ? Number(editData.age) : null
    });
    setIsEditing(false);
  };

  const handleAvatarSelect = (url: string) => {
    setEditData({ ...editData, avatarUrl: url });
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Profile Header */}
        <div className="bg-card p-8 rounded-2xl border shadow-sm relative group">
          <div className="absolute top-4 right-4">
            <Button 
              variant={isEditing ? "default" : "outline"} 
              size="sm"
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
            >
              {isEditing ? <Check className="h-4 w-4 mr-2" /> : <Edit2 className="h-4 w-4 mr-2" />}
              {isEditing ? "Save" : "Edit"}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {/* Avatar Section */}
            <div className="relative">
              {isEditing ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="cursor-pointer group-hover:opacity-80 transition">
                      <Avatar className="h-32 w-32 border-4 border-primary">
                        <AvatarImage src={editData.avatarUrl} alt={editData.name} />
                        <AvatarFallback><UserIcon className="h-16 w-16" /></AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition">
                        <Edit2 className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Choose Avatar</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-4 gap-4 p-4">
                      {AVATARS.map((avatar) => (
                        <div
                          key={avatar.id}
                          onClick={() => handleAvatarSelect(avatar.url)}
                          className={`cursor-pointer p-2 rounded-lg border-2 transition ${
                            editData.avatarUrl === avatar.url ? 'border-primary' : 'border-transparent hover:border-primary/50'
                          }`}
                        >
                          <Avatar className="h-20 w-20 mx-auto">
                            <AvatarImage src={avatar.url} />
                          </Avatar>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Avatar className="h-32 w-32 border-4 border-primary">
                  <AvatarImage src={user?.avatarUrl ?? undefined} alt={user.name} />
                  <AvatarFallback><UserIcon className="h-16 w-16" /></AvatarFallback>
                </Avatar>
              )}
            </div>

            <div className="flex-1 space-y-4 text-center md:text-left">
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input 
                      value={editData.name} 
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Occupation</Label>
                    <Select 
                      value={editData.occupation} 
                      onValueChange={(val) => setEditData({...editData, occupation: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select occupation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="professional">Working Professional</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input 
                      type="number" 
                      value={editData.age} 
                      onChange={(e) => setEditData({...editData, age: e.target.value})}
                      placeholder="Age"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select 
                      value={editData.gender} 
                      onValueChange={(val) => setEditData({...editData, gender: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold">{user.name}</h1>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start text-muted-foreground">
                    {user.occupation && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        <span className="capitalize">{user.occupation}</span>
                      </div>
                    )}
                    {user.age && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{user.age} years old</span>
                      </div>
                    )}
                    {user.gender && (
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        <span className="capitalize">{user.gender}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* History Tabs */}
        <Tabs defaultValue="aptitude" className="w-full">
          <TabsList className="bg-muted p-1 rounded-xl">
            <TabsTrigger value="aptitude" className="rounded-lg">Aptitude</TabsTrigger>
            <TabsTrigger value="interview" className="rounded-lg">Interviews</TabsTrigger>
            <TabsTrigger value="gd" className="rounded-lg">GD Sessions</TabsTrigger>
            <TabsTrigger value="resume" className="rounded-lg">Resume</TabsTrigger>
            <TabsTrigger value="coding" className="rounded-lg">Coding</TabsTrigger>
          </TabsList>

          {/* Aptitude Tab */}
          <TabsContent value="aptitude">
            <Card>
              <CardHeader>
                <CardTitle>Aptitude Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {aptLoading ? (
                  <Loader2 className="animate-spin" />
                ) : aptitudeData?.length === 0 ? (
                  <p className="text-muted-foreground">No aptitude tests taken yet.</p>
                ) : (
                  <div className="space-y-4">
                    {aptitudeData?.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => setSelectedAptitude(item)}
                        className="flex justify-between items-center p-4 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-all hover:scale-[1.02]"
                      >
                        <div>
                          <p className="font-bold capitalize">{item.topic}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(item.createdAt!), 'PPp')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{item.score}%</p>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interview Tab */}
          <TabsContent value="interview">
            <Card>
              <CardHeader>
                <CardTitle>Interview Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {intLoading ? (
                  <Loader2 className="animate-spin" />
                ) : interviewData?.length === 0 ? (
                  <p className="text-muted-foreground">No mock interviews taken yet.</p>
                ) : (
                  <div className="space-y-4">
                    {interviewData?.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => setSelectedInterview(item)}
                        className="flex justify-between items-center p-4 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-all hover:scale-[1.02]"
                      >
                        <div>
                          <p className="font-bold">{item.interviewType || "Mock Interview"}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(item.createdAt!), 'PPp')}</p>
                        </div>
                        <div className="flex gap-4 text-center">
                          <div>
                            <p className="font-bold">{item.communicationScore}</p>
                            <p className="text-[10px] text-muted-foreground">Comm.</p>
                          </div>
                          <div>
                            <p className="font-bold">{item.confidenceScore}</p>
                            <p className="text-[10px] text-muted-foreground">Conf.</p>
                          </div>
                          <div>
                            <p className="font-bold">{item.relevanceScore}</p>
                            <p className="text-[10px] text-muted-foreground">Rel.</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GD Tab */}
          <TabsContent value="gd">
            <Card>
              <CardHeader>
                <CardTitle>GD Participation</CardTitle>
              </CardHeader>
              <CardContent>
                {gdLoading ? (
                  <Loader2 className="animate-spin" />
                ) : gdData?.length === 0 ? (
                  <p className="text-muted-foreground">No GD sessions attended yet.</p>
                ) : (
                  <div className="space-y-4">
                    {gdData?.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => setSelectedGD(item)}
                        className="flex justify-between items-center p-4 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-all hover:scale-[1.02]"
                      >
                        <div>
                          <p className="font-bold">{item.topic}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(item.createdAt!), 'PPp')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-600">{item.score}</p>
                          <p className="text-xs text-muted-foreground">Perf. Score</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resume Tab */}
          <TabsContent value="resume">
            <Card>
              <CardHeader>
                <CardTitle>Resume Analysis History</CardTitle>
              </CardHeader>
              <CardContent>
                {resumeLoading ? (
                  <Loader2 className="animate-spin" />
                ) : resumeData?.length === 0 ? (
                  <p className="text-muted-foreground">No resume analyses yet.</p>
                ) : (
                  <div className="space-y-4">
                    {resumeData?.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => setSelectedResume(item)}
                        className="p-4 bg-muted/30 rounded-lg space-y-3 cursor-pointer hover:bg-muted/50 transition-all hover:scale-[1.02]"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="font-semibold">{item.fileName}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(item.createdAt!), 'PPp')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600">{item.atsScore}</p>
                            <p className="text-xs text-muted-foreground">ATS Score</p>
                          </div>
                        </div>
                        {item.suggestions && item.suggestions.length > 0 && (
                          <div className="pl-7 space-y-1">
                            <p className="text-sm font-semibold">Suggestions:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {item.suggestions.slice(0, 3).map((s: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground">{s}</li>
                              ))}
                            </ul>
                            {item.suggestions.length > 3 && (
                              <p className="text-xs text-muted-foreground italic">+{item.suggestions.length - 3} more...</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coding Tab */}
          <TabsContent value="coding">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-cyan-600" />
                  Coding Practice History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {codingLoading ? (
                  <Loader2 className="animate-spin" />
                ) : !codingData || codingData.length === 0 ? (
                  <p className="text-muted-foreground">No coding problems attempted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {codingData.map((item: any) => {
                      const diffColor = item.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : item.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
                      return (
                        <div
                          key={item.problemId}
                          onClick={() => setSelectedCoding(item)}
                          className="flex justify-between items-center p-4 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-all hover:scale-[1.02]"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold">{item.problemTitle}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffColor}`}>{item.difficulty}</span>
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">{item.topic} • {item.totalSubmissions} submission{item.totalSubmissions !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span className="text-sm font-bold text-emerald-600">{item.successCount}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-rose-500" />
                              <span className="text-sm font-bold text-rose-600">{item.failCount}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Detail Modals */}
        <Dialog open={!!selectedAptitude} onOpenChange={() => setSelectedAptitude(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="capitalize">{selectedAptitude?.topic} Test</DialogTitle>
              <DialogDescription>Detailed breakdown of your aptitude test performance</DialogDescription>
            </DialogHeader>
            {selectedAptitude && <AptitudeDetailModal result={selectedAptitude} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedInterview} onOpenChange={() => setSelectedInterview(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedInterview?.interviewType || "Mock Interview"}</DialogTitle>
              <DialogDescription>Detailed analysis of your interview performance</DialogDescription>
            </DialogHeader>
            {selectedInterview && <InterviewDetailModal result={selectedInterview} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedGD} onOpenChange={() => setSelectedGD(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedGD?.topic}</DialogTitle>
              <DialogDescription>Comprehensive GD performance analysis</DialogDescription>
            </DialogHeader>
            {selectedGD && <GDDetailModal result={selectedGD} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedResume} onOpenChange={() => setSelectedResume(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resume Analysis</DialogTitle>
              <DialogDescription>Detailed ATS analysis and suggestions</DialogDescription>
            </DialogHeader>
            {selectedResume && <ResumeDetailModal result={selectedResume} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedCoding} onOpenChange={() => setSelectedCoding(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-cyan-600" />
                {selectedCoding?.problemTitle}
              </DialogTitle>
              <DialogDescription>Submission history and attempt details</DialogDescription>
            </DialogHeader>
            {selectedCoding && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">{selectedCoding.totalSubmissions}</p>
                    <p className="text-xs text-muted-foreground">Total Attempts</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{selectedCoding.successCount}</p>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950 rounded-lg text-center">
                    <p className="text-2xl font-bold text-rose-600">{selectedCoding.failCount}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Difficulty</span>
                    <span className="font-semibold capitalize">{selectedCoding.difficulty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Topic</span>
                    <span className="font-semibold capitalize">{selectedCoding.topic}</span>
                  </div>
                </div>

                {/* Individual submissions */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Submission History</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedCoding.submissions?.map((sub: any, i: number) => (
                      <div key={sub.submissionId || i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {sub.allPassed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {sub.allPassed ? 'All Tests Passed' : `${sub.passed}/${sub.totalTests} Passed`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sub.createdAt ? format(new Date(sub.createdAt), 'PPp') : 'Unknown time'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground capitalize">{sub.language}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
