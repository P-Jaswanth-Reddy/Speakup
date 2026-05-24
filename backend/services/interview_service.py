import os
import json
import requests
import uuid
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models import InterviewSession, InterviewResult
from datetime import datetime
from dotenv import load_dotenv
from firebase_config import firestore_client

# Import Groq client for PRIMARY lane (high-quality reasoning)
from services.groq_client import generate_primary

# Load environment variables
load_dotenv()

# Global In-Memory Storage (Sessions only - Results go to Firestore)
INTERVIEW_SESSIONS = {}

# ==== PHASE 3: INTERVIEW DEPTH UPGRADE HELPERS ====

HESITATION_PHRASES = [
    "maybe", "i think", "probably", "not sure", "i guess", "perhaps",
    "kind of", "sort of", "i believe", "might be", "could be",
    "i'm not certain", "i don't know", "possibly"
]

STAR_MARKERS = {
    "situation": ["situation", "when i was", "in my previous", "at my last", "there was a time", "once when"],
    "task": ["task was", "responsible for", "needed to", "had to", "my role was", "was assigned"],
    "action": ["i did", "i took", "i implemented", "i decided", "i worked", "i created", "i built", "i led"],
    "result": ["result was", "outcome", "achieved", "improved", "increased", "decreased", "led to", "saved", "reduced"]
}

LOGICAL_CONNECTORS = ["first", "firstly", "secondly", "second", "third", "thirdly", "finally", "moreover", "additionally", "furthermore", "in conclusion", "to summarize"]


def analyze_confidence(answer: str) -> dict:
    """Scan answer for hesitation phrases and assertiveness."""
    answer_lower = answer.lower()
    words = answer_lower.split()
    word_count = len(words)
    
    found_hesitations = []
    for phrase in HESITATION_PHRASES:
        count = answer_lower.count(phrase)
        if count > 0:
            found_hesitations.append({"phrase": phrase, "count": count})
    
    total_hesitations = sum(h["count"] for h in found_hesitations)
    hesitation_density = round(total_hesitations / max(word_count, 1) * 100, 1)
    
    # Check for assertive language
    assertive_words = ["definitely", "certainly", "clearly", "absolutely", "specifically", "precisely", "i know", "i am confident"]
    assertive_count = sum(1 for w in assertive_words if w in answer_lower)
    
    return {
        "hesitationPhrases": found_hesitations,
        "totalHesitations": total_hesitations,
        "hesitationDensity": hesitation_density,
        "assertiveLanguagePresent": assertive_count > 0,
        "assertiveCount": assertive_count,
        "wordCount": word_count
    }


def detect_answer_structure(answer: str) -> dict:
    """Check if answer follows STAR structure and uses logical connectors."""
    answer_lower = answer.lower()
    
    # Check STAR markers
    star_found = {}
    for component, markers in STAR_MARKERS.items():
        star_found[component] = any(m in answer_lower for m in markers)
    
    star_count = sum(1 for v in star_found.values() if v)
    has_star = star_count >= 3  # At least 3 of 4 STAR components
    
    # Check logical connectors
    connectors_found = [c for c in LOGICAL_CONNECTORS if c in answer_lower]
    has_logical_flow = len(connectors_found) >= 2
    
    # Generate suggestion
    suggestions = []
    if not has_star and len(answer.split()) > 30:
        missing = [k.upper() for k, v in star_found.items() if not v]
        if missing:
            suggestions.append(f"Try using the STAR method. Missing: {', '.join(missing)}")
    if not has_logical_flow and len(answer.split()) > 40:
        suggestions.append("Use transitions like 'First', 'Additionally', 'Finally' for clearer structure")
    
    return {
        "starComponents": star_found,
        "starScore": star_count,
        "hasStarStructure": has_star,
        "logicalConnectors": connectors_found,
        "hasLogicalFlow": has_logical_flow,
        "structureSuggestions": suggestions
    }


def should_trigger_followup(answer: str, session: dict) -> dict:
    """Determine if a follow-up question should be triggered."""
    word_count = len(answer.split())
    followup_count = session.get("followupCount", 0)
    max_followups = 2
    
    if followup_count >= max_followups:
        return {"trigger": False, "reason": "max_followups_reached"}
    
    # Trigger conditions
    too_short = word_count < 60
    confidence_analysis = analyze_confidence(answer)
    low_confidence = confidence_analysis["hesitationDensity"] > 5
    
    if too_short:
        return {
            "trigger": True,
            "reason": "short_answer",
            "type": "clarification",
            "wordCount": word_count
        }
    
    if low_confidence:
        return {
            "trigger": True,
            "reason": "low_confidence",
            "type": "counter_question",
            "hesitationDensity": confidence_analysis["hesitationDensity"]
        }
    
    return {"trigger": False, "reason": "answer_sufficient"}

def call_groq(messages, model=None, max_tokens=1500):
    """
    Call Groq API via the PRIMARY lane (Llama-3.3-70b).
    Returns the raw Groq response dict (choices[0].message.content).
    """
    return generate_primary(messages, model=model, max_tokens=max_tokens)

def start_new_session(userId: int, interviewType: str, difficulty: str, mode: str, jobRole: str = "Software Engineer", resumeData: dict = None):
    """
    Start a new DYNAMIC AI-powered interview session
    """
    sessionId = str(uuid.uuid4())
    
    # 1. Generate the FIRST question (Intro/Icebreaker)
    first_question = generate_next_question([], interviewType, difficulty, jobRole, resumeData, is_first=True)
    
    # Create session state
    session = {
        "sessionId": sessionId,
        "userId": userId,
        "interviewType": interviewType,
        "difficulty": difficulty,
        "mode": mode,
        "jobRole": jobRole,
        "resumeData": resumeData,
        "history": [  # Track conversation for context
            {"role": "assistant", "content": first_question}
        ],
        "answers": [], # Structured storage for grading
        "currentQuestion": first_question,
        "questionCount": 1,
        "maxQuestions": 7,  # Shorter, higher quality interview
        "greetingGiven": False,
        "greetingBonus": 0,
        "isComplete": False,
        "startTime": datetime.now().isoformat()
    }
    
    INTERVIEW_SESSIONS[sessionId] = session
    
    return {
        "sessionId": sessionId,
        "totalQuestions": session["maxQuestions"],
        "greetingPrompt": "You may greet the interviewer to start.",
        "interviewType": interviewType,
        "difficulty": difficulty,
        "mode": mode,
        "firstQuestion": first_question 
    }

def generate_next_question(history: list, interview_type: str, difficulty: str, job_role: str, resume_data: dict, is_first: bool = False) -> str:
    """
    Generate the NEXT single question dynamically using Groq (lightweight model)
    """
    resume_context = ""
    if resume_data:
        skills = resume_data.get("parsedData", {}).get("skills", [])
        experience = resume_data.get("parsedData", {}).get("experience", "")
        # Keep context lean for lightweight model
        resume_context = f"\nCandidate Skills: {', '.join(skills[:8])}\nContext: {experience[:150]}"

    system_prompt = f"""You are an expert interviewer for {job_role}.
Interview Type: {interview_type.upper()} | Level: {difficulty.upper()}
{resume_context}

Your Goal: Conduct a realistic, adaptive interview.
- If this is the FIRST question: Ask a solid opening question (Intro or Core Skill).
- If follow-up: dig deeper into their previous answer if it was interesting/vague.
- If changing topic: Smoothly transition to a new relevant key concept.
- Keep questions CONCISE (max 2 sentences).
- Do NOT repeat questions.
- Maintain a professional but conversational tone."""

    messages = [{"role": "system", "content": system_prompt}]
    
    # Add recent history context (Last 4 turns max to save tokens/confusion)
    # We skip the very first intro exchange in history to keep it focused on Q&A
    context_window = history[-4:] if len(history) > 4 else history
    for turn in context_window:
        messages.append(turn)

    if is_first:
        messages.append({"role": "user", "content": "Please start the interview with the first question."})
    else:
        # Implicitly, the history already contains the user's last answer
        messages.append({"role": "system", "content": "Based on the candidate's last answer, generate the immediate next question or follow-up."})

    try:
        # Use lightweight model for speed
        resp = call_groq(messages, max_tokens=150)
        if resp and 'choices' in resp:
            question = resp['choices'][0]['message']['content'].strip()
            return question
    except Exception as e:
        print(f"Dynamic Q Generation Error: {e}")

    # Fallback if AI fails
    fallback_map = {
        "technical": "Could you explain a challenging technical problem you've solved recently?",
        "hr": "Tell me about a time you worked in a team.",
        "behavioral": "Describe a situation where you showed leadership."
    }
    return fallback_map.get(interview_type, "Tell me about your background.")

def process_greeting(sessionId: str, message: str):
    """
    Process greeting - if valid, just acknowledge and return current (first) question.
    """
    session = INTERVIEW_SESSIONS.get(sessionId)
    if not session: return {"error": "Session not found"}
    
    if session["greetingGiven"]:
        # If already greeted, treat this as an answer to Q1
        return process_answer(sessionId, message)

    msg_lower = message.lower()
    greeting_keywords = ["good morning", "good afternoon", "hi", "hello", "greetings"]
    is_greeting = any(kw in msg_lower for kw in greeting_keywords)

    if is_greeting:
        session["greetingGiven"] = True
        session["greetingBonus"] = 5 if "sir" in msg_lower or "ma'am" in msg_lower else 2
        
        return {
            "acknowledged": True,
            "response": f"Good morning! Let's begin.\n\n{session['currentQuestion']}",
            "greetingBonus": session["greetingBonus"],
            "nextQuestion": session["currentQuestion"], # Keep it for structured data clients
            "progress": 0
        }
    else:
        # Not a greeting? Then it's the answer to Q1.
        return process_answer(sessionId, message)

def process_answer(sessionId: str, answer: str):
    """
    1. Record Answer -> 2. Check Follow-up -> 3. Generate Next Question OR End Interview
    """
    session = INTERVIEW_SESSIONS.get(sessionId)
    if not session: return {"error": "Session not found"}
    
    if session["isComplete"]:
        return {"error": "Interview already complete"}

    # Initialize follow-up tracking if not present
    if "followupCount" not in session:
        session["followupCount"] = 0

    # 1. Analyze the answer
    confidence_analysis = analyze_confidence(answer)
    structure_analysis = detect_answer_structure(answer)

    # 2. Record the Interaction
    current_q_text = session["currentQuestion"]
    is_followup = session.get("pendingFollowup", False)
    
    session["answers"].append({
        "questionId": str(uuid.uuid4()),
        "questionText": current_q_text,
        "userAnswer": answer,
        "timestamp": datetime.now().isoformat(),
        "isFollowup": is_followup,
        "confidenceAnalysis": confidence_analysis,
        "structureAnalysis": structure_analysis
    })
    
    # Update History for Context
    session["history"].append({"role": "user", "content": answer})
    session["pendingFollowup"] = False

    # 3. Check if we should trigger an adaptive follow-up
    followup_check = should_trigger_followup(answer, session)
    
    if followup_check["trigger"] and not is_followup:
        # Generate a follow-up question based on the trigger type
        followup_type = followup_check.get("type", "clarification")
        
        followup_prompts = {
            "clarification": f'The candidate gave a brief answer to: "{current_q_text}". Ask a targeted follow-up that probes deeper into their reasoning or asks for a specific example. Keep it to 1-2 sentences.',
            "counter_question": f'The candidate answered "{current_q_text}" but used uncertain language. Ask a challenging counter-question that tests their conviction or asks them to defend their position. Keep it to 1-2 sentences.',
            "edge_case": f'The candidate answered "{current_q_text}". Ask about an edge case or exception that tests their depth of understanding. Keep it to 1-2 sentences.'
        }
        
        followup_prompt = followup_prompts.get(followup_type, followup_prompts["clarification"])
        
        try:
            messages = [
                {"role": "system", "content": f"You are an interviewer conducting a {session['interviewType']} interview. Generate a natural follow-up question."},
                {"role": "user", "content": followup_prompt}
            ]
            resp = call_groq(messages, max_tokens=150)
            if resp and 'choices' in resp:
                followup_q = resp['choices'][0]['message']['content'].strip()
                
                session["followupCount"] += 1
                session["pendingFollowup"] = True
                session["currentQuestion"] = followup_q
                session["history"].append({"role": "assistant", "content": followup_q})
                
                progress = (session["questionCount"] / session["maxQuestions"]) * 100
                
                return {
                    "isComplete": False,
                    "acknowledgment": "Let me dig a bit deeper.",
                    "nextQuestion": followup_q,
                    "isFollowup": True,
                    "followupType": followup_type,
                    "questionNumber": session["questionCount"],
                    "progress": round(progress, 1),
                    "answerAnalysis": {
                        "confidence": confidence_analysis,
                        "structure": structure_analysis
                    }
                }
        except Exception as e:
            print(f"Follow-up generation failed: {e}")

    # 4. Check Completion
    if session["questionCount"] >= session["maxQuestions"]:
        session["isComplete"] = True
        return {
            "isComplete": True,
            "progress": 100,
            "message": "Interview complete! Generating results...",
            "answerAnalysis": {
                "confidence": confidence_analysis,
                "structure": structure_analysis
            }
        }

    # 5. Generate Next Question
    session["questionCount"] += 1
    next_q = generate_next_question(
        session["history"], 
        session["interviewType"], 
        session["difficulty"], 
        session["jobRole"], 
        session["resumeData"]
    )
    
    # Update Session State
    session["currentQuestion"] = next_q
    session["history"].append({"role": "assistant", "content": next_q})
    
    progress = (session["questionCount"] / session["maxQuestions"]) * 100
    
    return {
        "isComplete": False,
        "acknowledgment": "Ok.",
        "nextQuestion": next_q,
        "questionNumber": session["questionCount"],
        "progress": round(progress, 1),
        "answerAnalysis": {
            "confidence": confidence_analysis,
            "structure": structure_analysis
        }
    }

def end_interview(sessionId: str, userId: int):
    """
    End interview and generate comprehensive results
    """
    session = INTERVIEW_SESSIONS.get(sessionId)
    if not session:
        return {"error": "Session not found"}
    
    # Idempotency check
    if session.get("finalResult"):
        return session["finalResult"]

    session["isComplete"] = True
    
    # Calculate metrics
    questions_answered = len(session.get("answers", []))
    session_duration_minutes = 10 # Placeholder or calc real time
    
    print(f"📊 Generating Feedback for Session {sessionId}...")

    # Generate results using FULL model (The Judge)
    if session["mode"] == "graded":
        result = generate_graded_results(session)
    else:
        result = generate_practice_results(session)
    
    # Persistence — save ALL modes (graded + practice) so analytics work
    try:
        metrics = result.get("metrics", {})
        # For practice mode, scores may not be in `metrics`; use 0 as placeholder
        interview_res = InterviewResult(
            userId=userId,
            communicationScore=metrics.get("communicationClarity", 0),
            confidenceScore=metrics.get("confidence", 0),
            relevanceScore=metrics.get("depthOfUnderstanding", 0),
            feedback=result.get("overallFeedback", "Interview completed."),
            interviewType=session["interviewType"],
            jobRole=session.get("jobRole", "General"),
            questionCount=questions_answered,
            sessionDuration=session_duration_minutes
        )
        save_result(interview_res)
        result["id"] = interview_res.id
    except Exception as e:
        print(f"Save Error: {e}")

    session["finalResult"] = result
    return result

def generate_graded_results(session: dict) -> dict:
    """
    Generate results with scores for graded mode
    """
    if not session.get("answers"):
        return get_fallback_evaluation(session, graded=True)

    # Build Q&A context for Groq evaluation
    qa_context = "\n\n".join([
        f"Q{i+1}: {ans['questionText']}\nAnswer: {ans['userAnswer']}"
        for i, ans in enumerate(session["answers"])
    ])
    
    prompt = f"""You are an expert interview evaluator for a {session['interviewType'].upper()} interview at {session['difficulty'].upper()} level.

INTERVIEW TRANSCRIPT:
{qa_context}

TASK: Provide comprehensive evaluation in VALID JSON format:

{{
  "overallScore": <0-100>,
  "overallFeedback": "Detailed 3-4 sentence overall assessment",
  "metrics": {{
    "technicalAccuracy": <0-100>,
    "communicationClarity": <0-100>,
    "confidence": <0-100>,
    "depthOfUnderstanding": <0-100>
  }},
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"],
  "questionBreakdown": [
    {{
      "questionNumber": 1,
      "score": <0-10>,
      "feedback": "Specific feedback for this answer"
    }}
  ]
}}

Scoring Criteria:
- Technical Accuracy: Correctness of information
- Communication: Clarity, structure, conciseness
- Confidence: Tone, decisiveness, conviction
- Understanding: Depth, examples, real-world application

JSON Response:"""

    try:
        messages = [
            {"role": "system", "content": "You are an expert interview evaluator. Respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ]
        
        resp = call_groq(messages, max_tokens=2000)
        if resp and 'choices' in resp:
            content = resp['choices'][0]['message']['content'].strip()
            
            # Clean markdown
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()
            elif content.startswith("```"):
                content = content.replace("```", "").strip()
            
            evaluation = json.loads(content)
            
            # Add greeting bonus to overall score
            overall_score = evaluation.get("overallScore", 75)
            overall_score = min(100, overall_score + session.get("greetingBonus", 0))
            evaluation["overallScore"] = overall_score
            evaluation["greetingBonus"] = session.get("greetingBonus", 0)
            
            # Add question texts + Phase 3 analysis to breakdown
            all_confidence = []
            all_structure = []
            for i, item in enumerate(evaluation.get("questionBreakdown", [])):
                if i < len(session["answers"]):
                    ans = session["answers"][i]
                    item["questionText"] = ans["questionText"]
                    item["userAnswer"] = ans["userAnswer"]
                    item["questionId"] = ans["questionId"]
                    item["isFollowup"] = ans.get("isFollowup", False)
                    
                    # Per-answer confidence + structure analysis
                    conf = ans.get("confidenceAnalysis") or analyze_confidence(ans["userAnswer"])
                    struct = ans.get("structureAnalysis") or detect_answer_structure(ans["userAnswer"])
                    item["confidenceBreakdown"] = conf
                    item["structureAnalysis"] = struct
                    all_confidence.append(conf)
                    all_structure.append(struct)
            
            # Overall confidence breakdown summary
            if all_confidence:
                total_hesitations = sum(c.get("totalHesitations", 0) for c in all_confidence)
                avg_density = round(sum(c.get("hesitationDensity", 0) for c in all_confidence) / len(all_confidence), 1)
                assertive_answers = sum(1 for c in all_confidence if c.get("assertiveLanguagePresent"))
                
                evaluation["confidenceSummary"] = {
                    "totalHesitationsAcrossAnswers": total_hesitations,
                    "averageHesitationDensity": avg_density,
                    "answersWithAssertiveLanguage": assertive_answers,
                    "totalAnswers": len(all_confidence),
                    "tips": []
                }
                
                if avg_density > 3:
                    evaluation["confidenceSummary"]["tips"].append("Reduce hedging phrases like 'maybe', 'I think', 'probably'. State your points with conviction.")
                if assertive_answers < len(all_confidence) // 2:
                    evaluation["confidenceSummary"]["tips"].append("Use more assertive language — words like 'definitely', 'specifically', 'clearly' show confidence.")
            
            # Overall structure summary
            if all_structure:
                star_answers = sum(1 for s in all_structure if s.get("hasStarStructure"))
                logical_answers = sum(1 for s in all_structure if s.get("hasLogicalFlow"))
                
                evaluation["structureSummary"] = {
                    "answersWithStarStructure": star_answers,
                    "answersWithLogicalFlow": logical_answers,
                    "totalAnswers": len(all_structure),
                    "tips": []
                }
                
                if star_answers < len(all_structure) // 2:
                    evaluation["structureSummary"]["tips"].append("Structure answers using STAR method: Situation → Task → Action → Result for clearer storytelling.")
                if logical_answers < len(all_structure) // 2:
                    evaluation["structureSummary"]["tips"].append("Use transitions like 'First', 'Additionally', 'Finally' to improve answer flow.")
            
            # Add follow-up count
            evaluation["followupCount"] = session.get("followupCount", 0)
            
            return evaluation
    except Exception as e:
        print(f"Evaluation error: {e}")
    
    # Fallback evaluation
    return get_fallback_evaluation(session, graded=True)

def generate_practice_results(session: dict) -> dict:
    """
    Generate results with feedback only (no scores) for practice mode
    """
    if not session.get("answers"):
        return get_fallback_evaluation(session, graded=False)

    # Similar to graded but without scores
    qa_context = "\n\n".join([
        f"Q{i+1}: {ans['questionText']}\nAnswer: {ans['userAnswer']}"
        for i, ans in enumerate(session["answers"])
    ])
    
    prompt = f"""You are a supportive interview coach for a {session['interviewType'].upper()} interview at {session['difficulty'].upper()} level.

INTERVIEW TRANSCRIPT:
{qa_context}

TASK: Provide encouraging, constructive feedback in VALID JSON:

{{
  "overallFeedback": "Encouraging 3-4 sentence overall assessment focusing on growth",
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"],
  "actionableadvice": ["tip1", "tip2", "tip3"],
  "questionBreakdown": [
    {{
      "questionNumber": 1,
      "feedback": "Constructive, specific feedback for this answer",
      "improvementTips": ["tip1", "tip2"]
    }}
  ]
}}

Focus on:
- What they did well
- Specific ways to improve
- Actionable next steps
- Encouraging tone

JSON Response:"""

    try:
        messages = [
            {"role": "system", "content": "You are a supportive interview coach. Respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ]
        
        resp = call_groq(messages, max_tokens=2000)
        if resp and 'choices' in resp:
            content = resp['choices'][0]['message']['content'].strip()
            
            # Clean markdown
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()
            elif content.startswith("```"):
                content = content.replace("```", "").strip()
            
            evaluation = json.loads(content)
            
            # Add question texts to breakdown
            for i, item in enumerate(evaluation.get("questionBreakdown", [])):
                if i < len(session["answers"]):
                    item["questionText"] = session["answers"][i]["questionText"]
                    item["userAnswer"] = session["answers"][i]["userAnswer"]
                    item["questionId"] = session["answers"][i]["questionId"]
            
            evaluation["mode"] = "practice"
            evaluation["greetingBonus"] = session.get("greetingBonus", 0)
            
            return evaluation
    except Exception as e:
        print(f"Evaluation error: {e}")
    
    # Fallback
    return get_fallback_evaluation(session, graded=False)

def get_fallback_evaluation(session: dict, graded: bool = True) -> dict:
    """Fallback evaluation if AI fails or no data"""
    has_answers = len(session.get("answers", [])) > 0
    
    base = {
        "overallFeedback": "No feedback available. Please complete the interview." if not has_answers else "Evaluation service unavailable. Please try again.",
        "strengths": [] if not has_answers else ["Participation"],
        "areasForImprovement": ["Complete the interview to receive evaluation."] if not has_answers else ["Retry submission"],
        "questionBreakdown": []
    }
    
    for i, ans in enumerate(session.get("answers", [])):
        breakdown_item = {
            "questionNumber": i + 1,
            "questionText": ans["questionText"],
            "userAnswer": ans["userAnswer"],
            "questionId": ans["questionId"],
            "feedback": "Feedback unavailable."
        }
        
        if graded:
            breakdown_item["score"] = 0
        else:
            breakdown_item["improvementTips"] = []
        
        base["questionBreakdown"].append(breakdown_item)
    
    if graded:
        base["overallScore"] = 0 + session.get("greetingBonus", 0)
        base["metrics"] = {
            "technicalAccuracy": 0,
            "communicationClarity": 0,
            "confidence": 0,
            "depthOfUnderstanding": 0
        }
        base["greetingBonus"] = session.get("greetingBonus", 0)
    else:
        base["mode"] = "practice"
        base["actionableadvice"] = ["Complete more questions"]
    
    return base

def get_teach_me(questionId: str, questionText: str, userAnswer: str = ""):
    """
    Use GPT-mini to explain a question in detail with structured output
    """
    prompt = f"""You are an expert interview coach. Explain this interview question in a structured, easy-to-understand format.

QUESTION: {questionText}

Provide your response as a JSON object with exactly these fields:
1. "context": A brief 2-3 sentence explanation of what this question tests and why it's important
2. "example": A single, complete example answer (not STAR format, just a natural paragraph showing how to answer well)
3. "focusAreas": An array of exactly 3 short, actionable tips (each 10-15 words max)

Example format:
{{
  "context": "This question assesses your ability to...",
  "example": "In my previous role, I faced a similar challenge when...",
  "focusAreas": [
    "Use specific examples from real experience",
    "Highlight the positive impact of your actions",
    "Keep your answer concise and structured"
  ]
}}

Provide ONLY the JSON object, no other text."""

    try:
        messages = [
            {"role": "system", "content": "You are a helpful interview coach who provides structured, JSON-formatted guidance."},
            {"role": "user", "content": prompt}
        ]
        
        resp = call_groq(messages, max_tokens=600)
        if resp and 'choices' in resp:
            content = resp['choices'][0]['message']['content'].strip()
            
            # Try to parse JSON response
            try:
                # Remove markdown code blocks if present
                if content.startswith('```'):
                    content = content.split('```')[1]
                    if content.startswith('json'):
                        content = content[4:]
                
                parsed = json.loads(content)
                
                return {
                    "context": parsed.get("context", "This question tests your problem-solving and communication skills."),
                    "example": parsed.get("example", "Practice answering with specific examples from your experience."),
                    "focusAreas": parsed.get("focusAreas", [
                        "Be specific with real examples",
                        "Show positive outcomes",
                        "Structure your answer clearly"
                    ])[:3]  # Ensure exactly 3
                }
            except:
                # Fallback if JSON parsing fails
                pass
                
    except Exception as e:
        print(f"Teach me error: {e}")
    
    # Fallback response
    return {
        "context": "This question assesses your ability to handle challenges and demonstrate your problem-solving skills in real situations.",
        "example": "In my previous role, I encountered a similar situation where I analyzed the problem, developed a solution, implemented it successfully, and achieved positive results that improved team efficiency.",
        "focusAreas": [
            "Use specific examples from your experience",
            "Highlight measurable outcomes and impact",
            "Structure your answer clearly and concisely"
        ]
    }

def save_result(result: InterviewResult):
    """Save interview result to Firestore"""
    result.id = str(uuid.uuid4())
    
    # Convert Pydantic model to dict
    result_dict = result.model_dump()
    from google.cloud.firestore_v1 import SERVER_TIMESTAMP
    result_dict['createdAt'] = SERVER_TIMESTAMP
    
    # Save to Firestore
    firestore_client.collection('interview_results').document(result.id).set(result_dict)
    print(f"💾 Saved interview result {result.id} for user {result.userId}")
    
    return result

def get_history(userId: str):
    """Get user's interview history from Firestore"""
    results = firestore_client.collection('interview_results')\
        .where('userId', '==', userId)\
        .stream()
    
    history = [doc.to_dict() for doc in results]
    # Sort by createdAt in Python (descending)
    def get_sort_key(x):
        created = x.get('createdAt', '')
        if hasattr(created, 'isoformat'):
            return created.isoformat()
        return str(created)
        
    history.sort(key=get_sort_key, reverse=True)
    return history


# ==== PERFORMANCE INTELLIGENCE ENGINE (PIE) ====

def get_performance_summary(userId: str, limit: int = 10):
    """
    Analyze last N sessions across ALL session types (interview, GD, aptitude)
    to detect trends and weaknesses.  Pure rule-based — no LLM calls.
    """
    # --- Pull from ALL collections ---
    interview_docs = list(firestore_client.collection('interview_results').where('userId', '==', userId).stream())
    gd_docs = list(firestore_client.collection('gd_results').where('userId', '==', userId).stream())
    aptitude_docs = list(firestore_client.collection('aptitude_results').where('userId', '==', userId).stream())

    # Normalise everything into {communicationScore, confidenceScore, relevanceScore, createdAt}
    unified = []

    for doc in interview_docs:
        d = doc.to_dict()
        unified.append({
            "communicationScore": d.get("communicationScore", 0),
            "confidenceScore":    d.get("confidenceScore", 0),
            "relevanceScore":     d.get("relevanceScore", 0),
            "createdAt":          d.get("createdAt", ""),
        })

    for doc in gd_docs:
        d = doc.to_dict()
        # GD has fine-grained metrics; fall back to overall score if missing
        overall = d.get("score", 0)
        unified.append({
            "communicationScore": d.get("verbalAbility", overall),
            "confidenceScore":    d.get("confidence", overall),
            "relevanceScore":     d.get("topicRelevance", overall),
            "createdAt":          d.get("createdAt", ""),
        })

    for doc in aptitude_docs:
        d = doc.to_dict()
        score = d.get("score", 0)
        # Aptitude doesn't have sub-scores; use overall score for all dims
        unified.append({
            "communicationScore": score,
            "confidenceScore":    score,
            "relevanceScore":     score,
            "createdAt":          d.get("createdAt", ""),
        })

    # Sort by createdAt descending
    def get_sort_key(x):
        created = x.get("createdAt", "")
        if hasattr(created, "isoformat"):
            return created.isoformat()
        return str(created)

    unified.sort(key=get_sort_key, reverse=True)

    # Need at least 1 session to show any data
    if len(unified) < 1:
        return {
            "available": False,
            "sessionCount": 0,
            "message": "Complete at least 1 session for performance insights."
        }

    # Take last N sessions
    sessions = unified[:limit]
    session_count = len(sessions)

    # 1. Compute Averages
    comm_scores = [s.get("communicationScore") or 0 for s in sessions]
    conf_scores = [s.get("confidenceScore") or 0 for s in sessions]
    rel_scores  = [s.get("relevanceScore") or 0  for s in sessions]

    avg_comm = round(sum(comm_scores) / max(len(comm_scores), 1), 1)
    avg_conf = round(sum(conf_scores) / max(len(conf_scores), 1), 1)
    avg_rel  = round(sum(rel_scores)  / max(len(rel_scores), 1),  1)

    averages = {
        "communication": avg_comm,
        "confidence":    avg_conf,
        "relevance":     avg_rel,
    }

    # 2. Identify Strongest / Weakest
    dimensions = [
        {"name": "Communication", "score": avg_comm},
        {"name": "Confidence",    "score": avg_conf},
        {"name": "Relevance",     "score": avg_rel},
    ]
    dimensions.sort(key=lambda d: d["score"])
    weakest  = dimensions[0]
    strongest = dimensions[-1]

    # 3. Detect Trend (compare last 3 vs previous 3)
    trend = "stable"
    trend_delta = 0

    if len(sessions) >= 6:
        recent_3  = sessions[:3]
        previous_3 = sessions[3:6]

        recent_avg = sum(
            ((s.get("communicationScore") or 0) + (s.get("confidenceScore") or 0) + (s.get("relevanceScore") or 0)) / 3
            for s in recent_3
        ) / 3

        previous_avg = sum(
            ((s.get("communicationScore") or 0) + (s.get("confidenceScore") or 0) + (s.get("relevanceScore") or 0)) / 3
            for s in previous_3
        ) / 3

        trend_delta = round(recent_avg - previous_avg, 1)

        if trend_delta > 5:
            trend = "improving"
        elif trend_delta < -5:
            trend = "declining"
        else:
            trend = "stable"
    elif len(sessions) >= 2:
        mid = max(len(sessions) // 2, 1)
        recent = sessions[:mid]
        older  = sessions[mid:]

        recent_avg = sum(
            ((s.get("communicationScore") or 0) + (s.get("confidenceScore") or 0) + (s.get("relevanceScore") or 0)) / 3
            for s in recent
        ) / len(recent)

        older_avg = sum(
            ((s.get("communicationScore") or 0) + (s.get("confidenceScore") or 0) + (s.get("relevanceScore") or 0)) / 3
            for s in older
        ) / len(older)

        trend_delta = round(recent_avg - older_avg, 1)

        if trend_delta > 5:
            trend = "improving"
        elif trend_delta < -5:
            trend = "declining"
        else:
            trend = "stable"

    # 4. Generate Rule-Based Insight
    insight_parts = []

    insight_parts.append(f"You consistently perform well in {strongest['name'].lower()} (avg: {strongest['score']}).")

    if weakest["score"] < strongest["score"] - 10:
        insight_parts.append(f"However, {weakest['name'].lower()} remains your weakest dimension at {weakest['score']}.")

    if trend == "improving":
        insight_parts.append(f"Great news — your scores are trending upward by +{abs(trend_delta)} points compared to earlier sessions. Keep it up!")
    elif trend == "declining":
        insight_parts.append(f"Your recent scores show a decline of {abs(trend_delta)} points. Consider revisiting your preparation strategy.")
    else:
        insight_parts.append("Your performance is stable across sessions. Push yourself with harder difficulty to grow further.")

    if avg_conf < avg_comm and avg_conf < avg_rel:
        insight_parts.append("Consider structuring answers more assertively and avoiding hedging language like 'maybe' or 'I think'.")
    elif avg_comm < avg_conf and avg_comm < avg_rel:
        insight_parts.append("Focus on organizing your answers with clear structure — use transitions like 'First', 'Additionally', 'Finally'.")
    elif avg_rel < avg_comm and avg_rel < avg_conf:
        insight_parts.append("Try to include more specific examples and real-world applications in your answers to boost relevance.")

    return {
        "available": True,
        "sessionCount": session_count,
        "averages": averages,
        "strongestArea": strongest,
        "weakestArea": weakest,
        "trend": trend,
        "trendDelta": trend_delta,
        "insight": " ".join(insight_parts),
        "dimensionScores": [
            {"name": "Communication", "score": avg_comm, "history": comm_scores[:5]},
            {"name": "Confidence",    "score": avg_conf, "history": conf_scores[:5]},
            {"name": "Relevance",     "score": avg_rel,  "history": rel_scores[:5]},
        ],
    }


# ==== IMPROVEMENT TRAJECTORY INDEX ====

def get_trajectory(userId: str):
    """
    Calculate growth momentum across ALL session types:
    current score vs average of earlier sessions.
    """
    interview_docs = list(firestore_client.collection('interview_results').where('userId', '==', userId).stream())
    gd_docs        = list(firestore_client.collection('gd_results').where('userId', '==', userId).stream())
    aptitude_docs  = list(firestore_client.collection('aptitude_results').where('userId', '==', userId).stream())

    unified = []

    for doc in interview_docs:
        d = doc.to_dict()
        avg = round(((d.get('communicationScore') or 0) + (d.get('confidenceScore') or 0) + (d.get('relevanceScore') or 0)) / 3, 1)
        unified.append({"score": avg, "createdAt": d.get('createdAt', '')})

    for doc in gd_docs:
        d = doc.to_dict()
        unified.append({"score": d.get('score') or 0, "createdAt": d.get('createdAt', '')})

    for doc in aptitude_docs:
        d = doc.to_dict()
        unified.append({"score": d.get('score') or 0, "createdAt": d.get('createdAt', '')})

    def get_sort_key(x):
        created = x.get('createdAt', '')
        if hasattr(created, 'isoformat'):
            return created.isoformat()
        return str(created)

    unified.sort(key=get_sort_key, reverse=True)

    if len(unified) < 1:
        return {
            "available": False,
            "message": f"Need at least 1 session. You have {len(unified)}."
        }

    # With only 1 session, show current score without trajectory comparison
    if len(unified) == 1:
        return {
            "available": True,
            "currentScore": unified[0]["score"],
            "previousAverage": unified[0]["score"],
            "improvementPercentage": 0,
            "momentumStatus": "stable"
        }

    # Current score = most recent session's overall
    current_score = round(unified[0]["score"], 1)

    # Previous average = avg of sessions 1..N (skip most recent)
    previous_sessions = unified[1:4]  # up to 3 previous sessions
    previous_avg = round(
        sum(s["score"] for s in previous_sessions) / len(previous_sessions),
        1
    )

    # Calculate improvement
    if previous_avg > 0:
        improvement_pct = round(((current_score - previous_avg) / previous_avg) * 100, 1)
    else:
        improvement_pct = 0

    # Momentum status
    if improvement_pct >= 5:
        momentum = "upward"
    elif improvement_pct <= -5:
        momentum = "downward"
    else:
        momentum = "stable"

    return {
        "available": True,
        "currentScore": current_score,
        "previousAverage": previous_avg,
        "improvementPercentage": improvement_pct,
        "momentumStatus": momentum
    }
