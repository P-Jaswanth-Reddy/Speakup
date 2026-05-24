from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

# --- USER ---
class User(BaseModel):
    id: Optional[int] = None
    email: str
    name: str = "User"
    occupation: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    avatarUrl: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.now)

# --- APTITUDE ---
class AptitudeResult(BaseModel):
    id: Optional[str] = None
    userId: str  # Firebase UID
    topic: str
    score: int
    totalQuestions: int
    accuracy: int
    timeTaken: int
    
    # Answer breakdown
    correctAnswers: Optional[int] = None
    incorrectAnswers: Optional[int] = None
    unansweredQuestions: Optional[int] = None
    performanceLevel: Optional[str] = None
    
    createdAt: datetime = Field(default_factory=datetime.now)

# --- INTERVIEW ---
class InterviewResult(BaseModel):
    id: Optional[str] = None
    userId: str  # Firebase UID
    communicationScore: int
    confidenceScore: int
    relevanceScore: int
    feedback: str
    
    # Session metadata
    interviewType: Optional[str] = None
    jobRole: Optional[str] = None
    questionCount: Optional[int] = None
    sessionDuration: Optional[int] = None  # minutes
    
    createdAt: datetime = Field(default_factory=datetime.now)

class InterviewSession(BaseModel):
    sessionId: str
    userId: str  # Firebase UID
    interviewType: str
    jobRole: Optional[str] = None
    questions: List[Dict] = Field(default_factory=list) 
    currentQuestionIndex: int = 0
    isComplete: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)

# --- GD ---
class GdResult(BaseModel):
    id: Optional[str] = None
    userId: str  # Firebase UID
    topic: str
    duration: int
    score: int  # Overall score
    
    # Detailed metrics
    verbalAbility: Optional[int] = None
    confidence: Optional[int] = None
    interactivity: Optional[int] = None
    argumentQuality: Optional[int] = None
    topicRelevance: Optional[int] = None
    leadership: Optional[int] = None
    strengths: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    pauseCount: Optional[int] = None
    pausePenalty: Optional[int] = None
    
    createdAt: datetime = Field(default_factory=datetime.now)

class GdSession(BaseModel):
    sessionId: str
    userId: str  # Firebase UID
    topic: str
    difficulty: str
    bots: List[Dict] = Field(default_factory=list)
    messages: List[Dict] = Field(default_factory=list)
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.now)

# --- RESUME ---
class ResumeResult(BaseModel):
    id: Optional[str] = None
    userId: str  # Firebase UID
    atsScore: int
    suggestions: List[str] = Field(default_factory=list)
    parsedData: Optional[Dict[str, Any]] = None  # Added for detailed results
    contentHash: Optional[str] = None            # Added for deduplication
    fileName: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.now)
