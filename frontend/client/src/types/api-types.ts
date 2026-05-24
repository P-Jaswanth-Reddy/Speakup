export interface StartInterviewRequest {
  userId: string;
  interviewType: string;
  jobRole?: string;
  useResume: boolean;
  resumeText?: string;
  adaptiveDifficultyEnabled: boolean;
}

export interface StartInterviewResponse {
  sessionId: string;
  firstQuestion: string;
  totalQuestions: number;
  interviewType: string;
  jobRole?: string;
}

export interface AnswerRequest {
  sessionId: string;
  userId: string;
  answer: string;
  questionNumber: number;
}

export interface AnswerResponse {
  nextQuestion?: string;
  questionNumber?: number;
  isComplete: boolean;
  summary?: {
    communicationScore: number;
    technicalScore: number;
    confidenceScore: number;
    overallScore: number;
    feedback: string;
  };
}

export interface TeachMeRequest {
  sessionId: string;
  questionNumber: number;
  userAnswer: string;
  question: string;
}

export interface TeachMeResponse {
  coaching: string;
  modelAnswer: string;
  tips: string[];
}

// --- Group Discussion ---

export interface StartGDRequest {
  userId: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  duration: number; // in seconds
}

export interface BotParticipant {
  name: string;
  personality: string;
}

export interface StartGDResponse {
  sessionId: string;
  topic: string;
  difficulty: string;
  duration: number;
  bots: BotParticipant[];
  userName: string;
  moderatorMessage: string;
}

export interface GDMessageRequest {
  sessionId: string;
  userId: string;
  message: string;
  action?: "speak" | "pause" | "conclude" | "silence_break";
}

export interface GDMessageResponse {
  botMessages: {
    speaker: string;
    text: string;
    timestamp: string;
  }[];
  nextSpeaker: string;
  timeRemaining: number;
  canConclude: boolean;
  turnCounts: Record<string, number>;
  status?: string; // for pause
  pauseCount?: number;
  shouldEndSession?: boolean;
}

export interface GDFeedbackRequest {
  sessionId: string;
  userId: string;
}

export interface GDFeedbackResponse {
  verbalAbility: number;
  confidence: number;
  interactivity: number;
  argumentQuality: number;
  topicRelevance: number;
  leadership: number;
  overallScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  pauseCount: number;
  pausePenalty: number;
}

export interface GDEndRequest {
  sessionId: string;
  userId: string;
  userMessages: {
    text: string;
    timestamp: string;
  }[];
}

export interface GDEndResponse {
  verbalAbility: number;
  confidence: number;
  interactivity: number;
  argumentQuality: number;
  topicRelevance: number;
  leadership: number;
  overallScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  pauseCount: number;
  pausePenalty: number;
  completionMetrics?: CompletionMetrics;
}

export interface AptitudeQuestionsResponse {
  topic: string;
  questions: {
    id: number;
    question: string; // "q" in mock
    options: string[];
    correctAnswer: number; // "correct" in mock
    difficulty: string;
  }[];
}

export interface ResumeUploadResponse {
  atsScore: number;
  suggestions: string[];
  parsedData: {
    name: string;
    email: string;
    skills: string[];
    experience: string;
    education: string;
  };
  fullText: string;
}

export interface DashboardStatsResponse {
  user: {
    name: string;
    email: string;
  };
  stats: {
    totalInterviews: number;
    totalGdSessions: number;
    totalAptitudeTests: number;
    totalResumesAnalyzed: number;
    averageInterviewScore: number;
    averageGdScore: number;
    averageAptitudeScore: number;
  };
  recentActivity: {
    type: string;
    date: string;
    description: string;
    score?: number;
  }[];
}

export interface CompletionMetrics {
  completionPercentage: number;
  isFullyCompleted: boolean;
  
  // Interview
  questionsAnswered?: number;
  totalQuestions?: number;
  sessionDurationMinutes?: number;

  // GD
  expectedDurationMinutes?: number;
  totalTurns?: number;
  userTurns?: number;
  
  // Aptitude
  timeTakenMinutes?: number;
}

export interface SubmitAptitudeReq {
  userId: string;
  topic: string;
  questions: {
    id?: number;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }[];
  answers: (number | null)[];
  timeTaken: number;
}

export interface SubmitAptitudeResponse {
  id: string;
  topic: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  performanceLevel: string;
  completionMetrics: CompletionMetrics;
  questionBreakdown: {
    questionNumber: number;
    questionText: string;
    options: string[];
    correctAnswer: number;
    userAnswer: number | null;
    status: "correct" | "incorrect" | "unanswered";
    explanation: string;
  }[];
}

// --- Performance Intelligence Engine ---

export interface PerformanceSummaryResponse {
  available: boolean;
  sessionCount?: number;
  message?: string;
  averages?: {
    communication: number;
    confidence: number;
    relevance: number;
  };
  strongestArea?: { name: string; score: number };
  weakestArea?: { name: string; score: number };
  trend?: "improving" | "declining" | "stable";
  trendDelta?: number;
  insight?: string;
  dimensionScores?: {
    name: string;
    score: number;
    history: number[];
  }[];
}

export interface TrajectoryResponse {
  available: boolean;
  message?: string;
  currentScore?: number;
  previousAverage?: number;
  improvementPercentage?: number;
  momentumStatus?: "upward" | "downward" | "stable";
}
