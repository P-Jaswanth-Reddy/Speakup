from dotenv import load_dotenv
load_dotenv()

import os
import requests
from typing import List, Optional, Dict
from datetime import datetime
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Import Firebase
from firebase_config import verify_firebase_token, get_or_create_user, firestore_client

# Use models (Pydantic)
from models import (
    InterviewResult, GdResult, AptitudeResult, ResumeResult
)
from services import (
    interview_service, gd_service, resume_service, 
    aptitude_service, dashboard_service, auth_service,
    coding_service
)

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- AUTHENTICATION MIDDLEWARE ----------
async def get_current_user(authorization: str = Header(None)):
    """Extract and verify Firebase token from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        # Extract token from "Bearer <token>"
        scheme, token = authorization.split(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        # Verify token
        decoded_token = verify_firebase_token(token)
        uid = decoded_token['uid']
        email = decoded_token.get('email', '')
        name = decoded_token.get('name', email.split('@')[0] if email else 'User')
        
        # Get or create user in Firestore
        user = get_or_create_user(uid, email, name)
        
        return user
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# ---------- REQUEST MODELS ----------
class StartInterviewReq(BaseModel):
    userId: str  # Firebase UID
    interviewType: str  # technical, hr, behavioral
    difficulty: str  # junior, mid, senior
    mode: str  # practice, graded
    jobRole: Optional[str] = "Software Engineer"  # Target job role
    resumeData: Optional[dict] = None  # Output from Resume Analyzer

class MessageInterviewReq(BaseModel):
    sessionId: str
    userId: str  # Firebase UID
    message: str
    action: str  # greet, answer

class EndInterviewReq(BaseModel):
    sessionId: str
    userId: str  # Firebase UID

class TeachMeReq(BaseModel):
    questionId: str
    questionText: str
    userAnswer: Optional[str] = ""

class SaveInterviewReq(BaseModel):
    userId: str  # Firebase UID
    communicationScore: int
    confidenceScore: int
    relevanceScore: int
    feedback: str

class StartGdReq(BaseModel):
    userId: str  # Firebase UID
    topic: str
    difficulty: str
    duration: int = 600  # Default 10 minutes

class GdMessageReq(BaseModel):
    sessionId: str
    userId: str  # Firebase UID
    message: str
    action: Optional[str] = "speak"  # speak | pause | conclude

class GdBotMessage(BaseModel):
    speaker: str
    text: str
    timestamp: datetime

class GdMessageResp(BaseModel):
    botMessages: List[GdBotMessage] = []
    nextSpeaker: str
    timeRemaining: int
    canConclude: bool
    turnCounts: Dict[str, int]
    status: Optional[str] = None
    pauseCount: Optional[int] = 0

class GdEndReq(BaseModel):
    sessionId: str
    userId: str  # Firebase UID
    userMessages: List[dict]

class GdFeedbackReq(BaseModel):
    sessionId: str
    userId: str  # Firebase UID

class SaveGdReq(BaseModel):
    userId: str  # Firebase UID
    topic: str
    duration: int
    score: int
    # Detailed metrics (optional for backwards compatibility)
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

class SaveAptitudeReq(BaseModel):
    userId: str  # Firebase UID
    topic: str
    score: int
    totalQuestions: int
    accuracy: int
    timeTaken: int

class SubmitAptitudeReq(BaseModel):
    userId: str  # Firebase UID
    topic: str
    questions: List[dict]
    answers: List[Optional[int]]  # Array of selected option indices (or None for unanswered)
    timeTaken: int

class SaveResumeReq(BaseModel):
    userId: str  # Firebase UID
    atsScore: int
    suggestions: List[str]
    fileName: str

class AiChatReq(BaseModel):
    message: str
    context: str
    history: Optional[List[dict]] = None

class LoginReq(BaseModel):
    email: str
    password: Optional[str] = "mock"

class SignupReq(BaseModel):
    email: str
    name: str
    password: Optional[str] = "mock"

class UpdateUserReq(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    avatarUrl: Optional[str] = None

# ---------- ROUTERS ----------
auth_router = APIRouter(prefix="/auth", tags=["Auth"])
user_router = APIRouter(prefix="/users", tags=["Users"])
interview_router = APIRouter(prefix="/interview", tags=["Interview"])
gd_router = APIRouter(prefix="/gd", tags=["Gd"])
aptitude_router = APIRouter(prefix="/aptitude", tags=["Aptitude"])
resume_router = APIRouter(prefix="/resume", tags=["Resume"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
ai_router = APIRouter(prefix="/ai", tags=["AI"])
coding_router = APIRouter(prefix="/coding", tags=["Coding"])

# NOTE: Login and signup are now handled by Firebase on the client side
# The backend only verifies tokens

# --- USERS ---
@user_router.get("/{uid}")
async def get_user(uid: str, current_user: dict = Depends(get_current_user)):
    """Get user profile (Firebase UID)"""
    # Check if requesting own profile or admin (for now, only allow own profile)
    if current_user.get('uid') != uid:
        raise HTTPException(status_code=403, detail="Cannot access other user's profile")
    
    user = auth_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@user_router.put("/{uid}")
async def update_user(uid: str, req: UpdateUserReq, current_user: dict = Depends(get_current_user)):
    """Update user profile (Firebase UID)"""
    if current_user.get('uid') != uid:
        raise HTTPException(status_code=403, detail="Cannot update other user's profile")
    
    user = auth_service.update_user(uid, req.model_dump(exclude_unset=True))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# --- INTERVIEW ---
@interview_router.post("/start")
def start_interview(req: StartInterviewReq):
    result = interview_service.start_new_session(
        req.userId, 
        req.interviewType, 
        req.difficulty, 
        req.mode, 
        req.jobRole,
        req.resumeData
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to start interview session")
    return result

@interview_router.post("/message")
def interview_message(req: MessageInterviewReq):
    if req.action == "greet":
        result = interview_service.process_greeting(req.sessionId, req.message)
    elif req.action == "answer":
        result = interview_service.process_answer(req.sessionId, req.message)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    if result is None or "error" in result:
        raise HTTPException(status_code=404, detail="Session not found or processing failed")
    return result

class AnswerReq(BaseModel):
    sessionId: str
    userId: str
    answer: str
    questionNumber: Optional[int] = None

@interview_router.post("/answer")
def interview_answer(req: AnswerReq):
    """Specific endpoint for answering questions (Frontend contract)"""
    result = interview_service.process_answer(req.sessionId, req.answer)
    if result is None or "error" in result:
        raise HTTPException(status_code=404, detail="Session not found or processing failed")
    return result

@interview_router.post("/end")
def end_interview(req: EndInterviewReq):
    result = interview_service.end_interview(req.sessionId, req.userId)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@interview_router.post("/teach-me")
def teach_me(req: TeachMeReq):
    result = interview_service.get_teach_me(req.questionId, req.questionText, req.userAnswer)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate explanation")
    return result

@interview_router.get("/history/{userId}")
async def get_interview_history(userId: str, current_user: dict = Depends(get_current_user)):
    """Get interview history (userId is Firebase UID)"""
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's history")
    return interview_service.get_history(userId)

@interview_router.get("/performance-summary/{userId}")
async def get_performance_summary(userId: str, current_user: dict = Depends(get_current_user)):
    """Get Performance Intelligence Engine summary"""
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's data")
    return interview_service.get_performance_summary(userId)

@interview_router.get("/trajectory/{userId}")
async def get_trajectory(userId: str, current_user: dict = Depends(get_current_user)):
    """Get Improvement Trajectory Index"""
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's data")
    return interview_service.get_trajectory(userId)

# --- GD ---
@gd_router.post("/start")
def start_gd(req: StartGdReq):
    result = gd_service.start_gd_session(req.userId, req.topic, req.difficulty, req.duration)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to start GD session")
    return result

@gd_router.post("/message")
def gd_message(req: GdMessageReq):
    result = gd_service.process_message(req.sessionId, req.userId, req.message, req.action)
    if result is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return result

@gd_router.post("/feedback")
def gd_feedback(req: GdFeedbackReq):
    result = gd_service.generate_gd_feedback(req.sessionId, req.userId)
    if result is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return result

@gd_router.post("/end")
def gd_end(req: GdEndReq):
    result = gd_service.generate_gd_end_summary(req.sessionId, req.userId, req.userMessages)
    if result is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return result

@gd_router.post("")
def save_gd(req: SaveGdReq):
    res = GdResult(**req.model_dump())
    return gd_service.save_result(res)

@gd_router.get("/history/{userId}")
async def get_gd_history(userId: str, current_user: dict = Depends(get_current_user)):
    """Get GD history (userId is Firebase UID)"""
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's history")
    return gd_service.get_history(userId)

# --- APTITUDE ---
@aptitude_router.get("/questions/{topic}")
def get_aptitude_questions(topic: str, count: int = 20, ai_powered: bool = False):
    """
    Get aptitude questions
    - Regular mode: returns 'count' random questions (15-30) with shuffled options
    - AI mode: generates 3 hard questions via Groq (Llama-3.3-70b)
    """
    if ai_powered:
        questions = aptitude_service.get_ai_powered_questions(topic)
    else:
        questions = aptitude_service.get_random_questions(topic, count)
    
    return {"topic": topic, "questions": questions}

# Global processing locks for idempotency
APTITUDE_PROCESSING = {} # userId_topic -> timestamp

@aptitude_router.post("/submit")
def submit_aptitude_test(req: SubmitAptitudeReq):
    # IDEMPOTENCY CHECK
    lock_key = f"{req.userId}_{req.topic}"
    import time
    current_time = time.time()
    
    # Check if this test is currently being processed (within last 10s)
    if lock_key in APTITUDE_PROCESSING:
        last_process_time = APTITUDE_PROCESSING[lock_key]
        if current_time - last_process_time < 10: # 10 second lockout
            print(f"⚠️ Aptitude {req.topic} already submitting. Rejecting duplicate.")
            raise HTTPException(status_code=429, detail="Submission already in progress.")
            
    # Set lock
    APTITUDE_PROCESSING[lock_key] = current_time

    """
    Submit aptitude test answers and get comprehensive results
    """
    result = aptitude_service.submit_test(
        userId=req.userId,
        topic=req.topic,
        questions=req.questions,
        answers=req.answers,
        timeTaken=req.timeTaken
    )
    return result

@aptitude_router.post("")
def save_aptitude(req: SaveAptitudeReq):
    res = AptitudeResult(**req.model_dump())
    return aptitude_service.save_result(res)

@aptitude_router.get("/history/{userId}")
async def get_aptitude_history(userId: str, current_user: dict = Depends(get_current_user)):
    """Get aptitude history (userId is Firebase UID)"""
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's history")
    return aptitude_service.get_history(userId)

# --- RESUME ---
@resume_router.post("/upload")
async def upload_resume(userId: str = Form(...), file: UploadFile = File(...)):
    import hashlib
    
    content = await file.read()
    
    # Create content hash for deduplication
    content_hash = hashlib.sha256(content).hexdigest()
    
    # Check if this exact file content was already analyzed
    existing_docs = firestore_client.collection('resume_results')\
        .where('userId', '==', userId)\
        .stream()
    
    for doc in existing_docs:
        data = doc.to_dict()
        if data.get('contentHash') == content_hash and data.get('parsedData'):
            print(f"⚠️ Resume content matches existing record {doc.id} with full data. Returning cached result.")
            return data
    
    result = await resume_service.analyze_resume_content(content)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    # PERSISTENCE: Save result
    try:
        resume_res = ResumeResult(
            userId=userId,
            atsScore=result.get("atsScore", 0),
            suggestions=result.get("suggestions", []),
            parsedData=result.get("parsedData", {}), # Save specific extracted data
            contentHash=content_hash,                # Save hash for future deduplication
            fileName=file.filename
        )
        resume_service.save_result(resume_res)
        result["id"] = resume_res.id
        print(f"💾 Saved resume analysis for {file.filename}")
    except Exception as e:
        print(f"❌ Failed to save resume result: {e}")
        
    return result

@resume_router.get("/history/{userId}")
async def get_resume_history(userId: str, current_user: dict = Depends(get_current_user)):
    """Get resume analysis history (userId is Firebase UID)"""
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's history")
    return resume_service.get_history(userId)

# --- DETAIL VIEW ENDPOINTS ---
@aptitude_router.get("/result/{result_id}")
async def get_aptitude_result_detail(result_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed aptitude result"""
    doc = firestore_client.collection('aptitude_results').document(result_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Result not found")
    result = doc.to_dict()
    # Verify user owns this result
    if result.get('userId') != current_user.get('uid'):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return result

@interview_router.get("/result/{result_id}")
async def get_interview_result_detail(result_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed interview result"""
    doc = firestore_client.collection('interview_results').document(result_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Result not found")
    result = doc.to_dict()
    if result.get('userId') != current_user.get('uid'):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return result

@gd_router.get("/result/{result_id}")
async def get_gd_result_detail(result_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed GD result"""
    doc = firestore_client.collection('gd_results').document(result_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Result not found")
    result = doc.to_dict()
    if result.get('userId') != current_user.get('uid'):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return result

# --- DASHBOARD ---
@dashboard_router.get("/stats/{userId}")
async def get_dashboard_stats(userId: str, current_user: dict = Depends(get_current_user)):
    """Get dashboard stats (userId is Firebase UID)"""
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's stats")
    return dashboard_service.get_user_stats(userId)

# --- AI ---
@ai_router.post("/chat")
def ai_chat(req: AiChatReq):
    return {"response": f"AI Response to: {req.message}"}

# --- CODING ---
class CodingGenerateReq(BaseModel):
    userId: str
    topic: str
    difficulty: str
    language: str = "python"
    useAI: bool = False  # False = question bank, True = AI generation

class CodingRunReq(BaseModel):
    sessionId: str
    code: str
    language: str

class CodingSubmitReq(BaseModel):
    sessionId: str
    userId: str
    code: str
    language: str

@coding_router.post("/generate")
def coding_generate(req: CodingGenerateReq):
    result = coding_service.get_or_generate_problem(req.topic, req.difficulty, req.userId, req.useAI)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate problem")
    return result

@coding_router.post("/run")
def coding_run(req: CodingRunReq):
    result = coding_service.run_code(req.sessionId, req.code, req.language)
    return result

@coding_router.post("/submit")
def coding_submit(req: CodingSubmitReq):
    result = coding_service.submit_code(req.sessionId, req.code, req.language, req.userId)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@coding_router.get("/languages")
def coding_languages():
    return {"languages": coding_service.get_supported_languages(), "topics": coding_service.get_topics()}

@coding_router.get("/bank-stats")
def coding_bank_stats():
    return coding_service.get_bank_stats()

@coding_router.get("/bank-questions")
def coding_bank_questions(topic: str = None, difficulty: str = None):
    return coding_service.list_bank_questions(topic, difficulty)

@coding_router.get("/history/{userId}")
async def get_coding_history(userId: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's history")
    return coding_service.get_user_history(userId)

@coding_router.get("/problem/{problemId}")
def get_coding_problem(problemId: str):
    result = coding_service.load_problem_for_reattempt(problemId)
    if not result:
        raise HTTPException(status_code=404, detail="Problem not found")
    return result

@coding_router.get("/submissions/{userId}/{problemId}")
async def get_coding_submissions(userId: str, problemId: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('uid') != userId:
        raise HTTPException(status_code=403, detail="Cannot access other user's submissions")
    return coding_service.get_problem_submissions(userId, problemId)

# REGISTER ROUTERS
app.include_router(auth_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(interview_router, prefix="/api")
app.include_router(gd_router, prefix="/api")
app.include_router(aptitude_router, prefix="/api")
app.include_router(resume_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(coding_router, prefix="/api")


# --- Root Endpoint ---
@app.get("/")
def read_root():
    return {"status": "SpeakUp Backend Operational (Groq AI + Google Document AI)"}
