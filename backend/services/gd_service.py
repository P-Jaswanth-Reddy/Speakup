import os
import json
import uuid
import random
import re
import requests
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models import GdSession, GdResult
from datetime import datetime
from dotenv import load_dotenv
from typing import Dict, List, Optional
from firebase_config import firestore_client

# Import Groq clients
from services.groq_client import generate_gd_bot, generate_primary

# Load environment variables
load_dotenv()

# Sessions in memory, Results in Firestore
GD_SESSIONS = {}

# ==== CONSTANTS ====
GD_BOT_MODEL = "llama-3.1-8b-instant"

# ==== HELPER FUNCTIONS ====

def call_groq_bot(messages, model=None, max_tokens=150):
    """
    Call Groq API via GD_BOT lane (Llama-3.1-8b-instant) for bot messages.
    """
    return generate_gd_bot(messages, model=model, max_tokens=max_tokens)

# ==== CLASSES for Monitor-Bot Architecture ====

class GDBot:
    """Represents a Participant Bot (Alex, Sarah, Mike)"""
    def __init__(self, name: str, personality: str):
        self.name = name
        self.personality = personality
    
    def generate_response(self, topic: str, context_messages: List[Dict], turn_counts: Dict = None, system_prompt_extras: str = ""):
        """Generate a response based on conversation context"""
        
        # Format context for the LLM
        # We take the last 5 messages to keep context relevant but concise
        recent_msgs = context_messages[-5:] 
        formatted_context = "\n".join([
            f"{m.get('speaker', 'Unknown')} ({m.get('role', 'unknown')}): {m.get('content', '')}" 
            for m in recent_msgs
        ])

        # Build participant awareness context based on who has actually spoken
        participant_context = ""
        if turn_counts:
            spoken = []
            silent = []
            all_participants = ["user", "alex", "sarah", "mike"]
            bot_display = {"user": "User", "alex": "Alex", "sarah": "Sarah", "mike": "Mike"}
            for p in all_participants:
                if p == self.name.lower():
                    continue  # Skip self
                display = bot_display[p]
                if turn_counts.get(p, 0) > 0:
                    spoken.append(display)
                else:
                    silent.append(display)
            
            if silent:
                participant_context = f"\n- IMPORTANT: The following participants have NOT spoken yet in this discussion: {', '.join(silent)}. DO NOT reference, quote, or attribute any opinion to them. You may invite them to speak, but do not say they 'mentioned' or 'agreed with' anything."
            if spoken:
                participant_context += f"\n- Participants who HAVE spoken (you may reference their actual statements): {', '.join(spoken)}."

        system_prompt = f"""You are {self.name}, a {self.personality.lower()} participant in a group discussion about "{topic}".

Guidelines:
- Keep responses concise (2-3 sentences, max 60 words).
- Reference what the previous speaker said to show active listening.
- Stay on topic.
- Show your {self.personality.lower()} personality.
- You can end with a handoff like "I'd ask [Name] for their opinion" or just make your point.

- DO NOT mention the AI, the system, or the "monitor". Pretend to be a real human student.

- THE ONLY PARTICIPANTS are: User (the human), Alex, Sarah, and Mike. Do NOT invent other names like "Emma" or "John".
- IF this is the FIRST message in the discussion, DO NOT reference what others said (since no one spoke yet). State your own opening opinion.
- CRITICAL: DO NOT attribute opinions to the User unless they have explicitly stated them in the "Recent discussion". If the User is silent, do NOT say "User, I appreciate your agreement". Instead, ask for their opinion.
{participant_context}
{system_prompt_extras}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Recent discussion:\n{formatted_context}\n\nProvide your response as {self.name}:"}
        ]
        
        resp = call_groq_bot(messages, model=GD_BOT_MODEL, max_tokens=100)
        
        if resp and 'choices' in resp:
            return resp['choices'][0]['message']['content'].strip()
        else:
            return f"That's an interesting perspective on {topic}. I think we should explore that further."

class GDMonitor:
    """The Orchestrator (Monitor Bot)"""
    def __init__(self, session_state):
        self.session_state = session_state
        self.bots = {
            b['name'].lower(): GDBot(b['name'], b['personality']) 
            for b in self.session_state.model.bots
        }
    
    def parse_handoff(self, message: str) -> Optional[str]:
        """
        AI-powered handoff detection using Llama-3.1-8b-instant.
        Analyzes the message to detect if someone is being addressed,
        regardless of where their name appears in the sentence.
        Returns the name of the next speaker (lowercase) or None.
        """
        # Quick regex check for common patterns first (performance optimization)
        msg_lower = message.lower()
        
        # Fast path: Check for "User," pattern FIRST (most common)
        if re.search(r'\buser\s*,', msg_lower):
            return "user"
        
        # Fast path: Check for other common patterns
        quick_patterns = [
            r'\b(alex|sarah|mike)\s*,',  # "Sarah, what do..."
            r'\b(alex|sarah|mike)\s*\?',  # "right, Sarah?"
        ]
        
        for pattern in quick_patterns:
            match = re.search(pattern, msg_lower)
            if match:
                for name in ['alex', 'sarah', 'mike']:
                    if name in match.group(0):
                        return name
        
        # AI-POWERED ANALYSIS: If no obvious pattern, ask GPT to analyze
        # This catches complex cases like "I would like to ask Sarah, is there any way..."
        analysis_prompt = f"""You are a GD Monitor Bot analyzing conversation flow.

Message: "{message}"

Participants: User, Alex, Sarah, Mike

TASK: Determine if this message is addressing or handing off to a SPECIFIC participant.
Look for ANY indication that someone is being asked a question or addressed, such as:
- Direct address: "Sarah, what do you think?"
- Indirect: "I would like to ask Sarah..."
- Questions directed at someone: "How does Mike feel about this?"
- Requests for opinion: "I want to hear from Alex on this"

Respond with ONLY ONE WORD:
- "user" if addressing the User
- "alex" if addressing Alex
- "sarah" if addressing Sarah  
- "mike" if addressing Mike
- "none" if no specific handoff detected

Response:"""

        try:
            ai_response = call_groq_bot(
                messages=[{"role": "user", "content": analysis_prompt}],
                model=GD_BOT_MODEL,
                max_tokens=10
            )
            
            if ai_response and 'choices' in ai_response:
                detected = ai_response['choices'][0]['message']['content'].strip().lower()
                if detected in ['user', 'alex', 'sarah', 'mike']:
                    return detected
        except Exception as e:
            print(f"⚠️ AI handoff detection failed: {e}, falling back to regex")
        
        # Fallback: Extended regex patterns
        fallback_patterns = [
            r'(what|how).{0,50}(alex|sarah|mike|user)',
            r'i\'d (ask|like to hear from|turn to)\s*(alex|sarah|mike|user)',
            r'(alex|sarah|mike|user).{0,20}(your|you) (thought|opinion|view|take)',
        ]
        
        for pattern in fallback_patterns:
            match = re.search(pattern, msg_lower)
            if match:
                for name in ['alex', 'sarah', 'mike', 'user']:
                    if name in match.group(0):
                        return name
        
        return None

    def decide_next_speaker(self) -> str:
        """
        Decides who speaks next.
        Priority:
        1. Explicit Handoff (next_speaker set in state).
        2. Fair Turn Distribution (least spoken).
        """
        # 1. Handoff - CRITICAL: Must be respected if valid
        if self.session_state.next_speaker:
            candidate = self.session_state.next_speaker.lower()
            self.session_state.next_speaker = None # Reset after using
            # Validate candidate exists (could be 'user' or a bot)
            if candidate == "user" or candidate in self.bots:
                return candidate
        
        # 2. Fairness (exclude last speaker)
        last_speaker = self.session_state.last_speaker
        candidates = [name for name in self.bots.keys()]
        
        # Filter out last speaker if possible (avoid self-reply unless only 1 bot)
        if last_speaker and len(candidates) > 1:
            candidates = [c for c in candidates if c != last_speaker]
            
        # Find min turns among candidates
        min_turns = min(self.session_state.turn_counts.get(c, 0) for c in candidates)
        best_candidates = [c for c in candidates if self.session_state.turn_counts.get(c, 0) == min_turns]
        
        import random
        return random.choice(best_candidates)

# ==== SESSION STATE WRAPPER ====

class GdSessionState:
    def __init__(self, session_model: GdSession, duration: int, user_name: str):
        self.model = session_model
        self.user_name = user_name
        self.start_time = datetime.now()
        self.duration = duration
        self.phase = "prep"
        self.turn_counts = {"user": 0, "alex": 0, "sarah": 0, "mike": 0}
        self.next_speaker = None
        self.last_speaker = None
        self.pause_count = 0
        self.pause_duration = 0
        self.prep_time_used = 0

# ==== SESSION MANAGEMENT ====

def start_gd_session(userId: str, topic: str, difficulty: str, duration: int = 600):
    """Initialize a new GD session"""
    sessionId = str(uuid.uuid4())
    
    # Generic User Name
    user_name = "User"
    
    bots = [
        {"name": "Alex", "personality": "Analytical"},
        {"name": "Sarah", "personality": "Creative"},
        {"name": "Mike", "personality": "Critical"}
    ]
    
    session_model = GdSession(
        sessionId=sessionId,
        userId=userId,
        topic=topic,
        difficulty=difficulty,
        bots=bots,
        messages=[]
    )
    
    # Use wrapper for state management
    session_state = GdSessionState(session_model, duration, user_name)
    GD_SESSIONS[sessionId] = session_state
    
    return {
        "sessionId": sessionId,
        "topic": topic,
        "difficulty": difficulty,
        "duration": duration,
        "bots": bots,
        "userName": user_name,
        "moderatorMessage": f"Topic: '{topic}'. Take 60 seconds to prepare, or start immediately."
    }

def process_message(sessionId: str, userId: str, message: str, action: str = "speak"):
    """
    Orchestrates the turn loop using GDMonitor.
    """
    try:
        session_state = GD_SESSIONS.get(sessionId)
        if not session_state:
            return None
        
        # Handle pause action
        if action == "pause":
            session_state.pause_count += 1
            return {"status": "paused", "pauseCount": session_state.pause_count}
        
        # Instantiating Monitor
        monitor = GDMonitor(session_state)
        
        # CRITICAL FIX: If it was User's turn and they are acting now (speaking or silence break),
        # we must clear the expectation that "User needs to speak".
        if session_state.next_speaker == "user":
            session_state.next_speaker = None

        # Handle silence break
        if action == "silence_break":
            # Do not add a user message, just trigger a bot response
            # Force a bot that didn't speak last to intervene
            session_state.turn_counts["user"] += 0 # No turn taken
            # Logic continues below to Turn Resolution, but we need to ensure chain starts
        else:
            # 1. Record User Message
            msg_entry = {
                "role": "user", 
                "speaker": session_state.user_name,
                "content": message, 
                "timestamp": datetime.now().isoformat()
            }
            session_state.model.messages.append(msg_entry)
            session_state.turn_counts["user"] += 1
            session_state.last_speaker = "user"
        
        # 2. Parse Handoff from User (if they spoke)
        if action != "silence_break":
            handoff_target = monitor.parse_handoff(message)
            if handoff_target:
                session_state.next_speaker = handoff_target
        
        # 3. Turn Resolution Loop
        generated_messages = []
        # Allow natural bot-to-bot conversation with random chain lengths
        import random
        MAX_CHAIN_LENGTH = random.randint(1, 3)
        chain_count = 0
        
        while chain_count < MAX_CHAIN_LENGTH:
            # Ask Monitor: Who is next?
            next_speaker_name = monitor.decide_next_speaker()
            
            # If Monitor says it's User's turn, we stop the bot chain
            if next_speaker_name == "user":
                session_state.next_speaker = "user" # Ensure frontend knows
                break
                
            # Otherwise, it's a Bot
            bot = monitor.bots.get(next_speaker_name)
            if not bot:
                break # Should not happen
                
            # Prepare System Prompt Extras
            prompt_override = ""
            is_last_turn = (chain_count >= MAX_CHAIN_LENGTH - 1)
            
            # Inject Silence Prompt if this is the first bot responding to a silence break
            if action == "silence_break" and chain_count == 0:
                prompt_override += " The User has been silent. Invite them into the conversation GENTLY (e.g. 'User, what are your thoughts?'), but DO NOT assume their opinion or reference nonexistent messages."
            
            if is_last_turn:
                prompt_override += " This is the last message in this chain. Consider handing off to the User with a question (e.g., 'User, what's your take on this?'), OR make a strong concluding point that invites further discussion. Keep the conversation natural."

            # Check for Time-Based Conclusion (Global check)
            # We need to estimate time based on turns or check real time if object available
            elapsed_check = (datetime.now() - session_state.start_time).total_seconds() - session_state.pause_duration
            remaining_check = max(0, session_state.duration - int(elapsed_check))
            
            if remaining_check < 60:
                prompt_override += " TIME WARNING: The session is almost over (< 60s). You MUST start concluding your points. Ask the User to provide their final conclusion."


            # Generate Bot Content
            bot_response_text = bot.generate_response(
                topic=session_state.model.topic,
                context_messages=session_state.model.messages,
                turn_counts=session_state.turn_counts,
                system_prompt_extras=prompt_override
            )
            
            # Record Bot Message
            bot_msg_entry = {
                "role": "bot",
                "speaker": bot.name,
                "content": bot_response_text,
                "timestamp": datetime.now().isoformat()
            }
            session_state.model.messages.append(bot_msg_entry)
            session_state.turn_counts[bot.name.lower()] = session_state.turn_counts.get(bot.name.lower(), 0) + 1
            session_state.last_speaker = bot.name.lower()
            
            generated_messages.append({
                "speaker": bot.name,
                "text": bot_response_text,
                "timestamp": bot_msg_entry["timestamp"]
            })
            
            # CRITICAL: Check if this Bot handed off to someone else
            # This updates session_state.next_speaker, so the loop (or frontend) knows who's next.
            bot_handoff = monitor.parse_handoff(bot_response_text)
            if bot_handoff:
                session_state.next_speaker = bot_handoff
                # IMMEDIATE BREAK: If bot handed off to User, stop the chain NOW
                if bot_handoff == "user":
                    break
                
            chain_count += 1
            
            # Calculate time passed to inject "Conclusion" prompts
            elapsed_now = (datetime.now() - session_state.start_time).total_seconds() - session_state.pause_duration
            remaining = max(0, session_state.duration - int(elapsed_now))
            
            # If less than 60 seconds left, force next bot (if any) or this bot to conclude
            if remaining < 60 and not is_last_turn:
                 # This prompt will affect next iteration's bot if we continue
                 pass 

        # 4. Finalize Response
        elapsed = (datetime.now() - session_state.start_time).total_seconds() - session_state.pause_duration
        time_remaining = max(0, session_state.duration - int(elapsed))
        in_conclusion_phase = time_remaining <= 120
        
        # Check for "Conclude" keyword in discussion phase (last 2 mins)
        should_end_session = False
        if in_conclusion_phase:
            # Check user message
            if re.search(r"i\s+(?:would like to\s+)?conclude", message.lower()):
                should_end_session = True
            # Check bot messages
            for m in generated_messages:
                 if re.search(r"i\s+(?:would like to\s+)?conclude", m['text'].lower()):
                     should_end_session = True

        return {
            "botMessages": generated_messages,
            "nextSpeaker": session_state.next_speaker or "any",
            "timeRemaining": int(time_remaining),
            "canConclude": in_conclusion_phase,
            "shouldEndSession": should_end_session,
            "turnCounts": session_state.turn_counts
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e

def generate_comprehensive_score(sessionId: str, userId: str):
    """Generate 6-metric scoring for GD performance with completion tracking"""
    session_state = GD_SESSIONS.get(sessionId)
    if not session_state:
        return None
    
    # Extract user messages
    user_messages = [m for m in session_state.model.messages if m.get("role") == "user"]
    user_text = " | ".join([m.get("content", "") for m in user_messages])
    
    # All messages for context
    all_discussion = "\n".join([
        f"{m.get('speaker', 'Unknown')}: {m.get('content', '')}"
        for m in session_state.model.messages
    ])
    
    pause_penalty = session_state.pause_count * 2
    
    # Calculate completion metrics
    elapsed_time = (datetime.now() - session_state.start_time).total_seconds()
    session_duration_minutes = round(elapsed_time / 60)
    expected_duration_minutes = session_state.duration // 60  # Convert from seconds
    completion_percentage = min(100, round((elapsed_time / session_state.duration) * 100))
    total_turns = sum(session_state.turn_counts.values())
    user_turns = session_state.turn_counts.get('user', 0)
    
    # Handle zero participation early
    if user_turns == 0:
        return {
            "verbalAbility": 0,
            "confidence": 0,
            "interactivity": 0,
            "argumentQuality": 0,
            "topicRelevance": 0,
            "leadership": 0,
            "overallScore": 0,
            "feedback": "No participation recorded. Please participate in the discussion to get feedback.",
            "strengths": [],
            "improvements": ["Speak up in the discussion"],
            "pauseCount": session_state.pause_count,
            "pausePenalty": 0,
            "completionMetrics": {
                "sessionDurationMinutes": session_duration_minutes,
                "expectedDurationMinutes": expected_duration_minutes,
                "completionPercentage": completion_percentage,
                "totalTurns": total_turns,
                "userTurns": user_turns,
                "isFullyCompleted": False
            }
        }
    
    scoring_prompt = f"""
    Evaluate the following group discussion participant based on their performance.
    
    Topic: "{session_state.model.topic}"
    Difficulty: {session_state.model.difficulty}
    
    User Statistics:
    - Turns taken: {user_turns}
    - Pauses detected: {session_state.pause_count} (Penalty: -{pause_penalty} points)
    - Session duration: {session_duration_minutes}/{expected_duration_minutes} minutes ({completion_percentage}% of expected time)
    
    Transcript of Discussion:
    {all_discussion}
    
    CRITICAL SCORING INSTRUCTIONS:
    1. Focus PURELY on communication skills, confidence, leadership, and articulation.
    2. DO NOT penalize for factual inaccuracies. The user can "lie" or make up facts as long as they sound confident and convincing.
    3. Evaluate HOW they speak, not just WHAT they speak.
    4. Deduct points heavily for the {session_state.pause_count} pauses recorded.
    
    Provide a JSON response with the following structure:
    {{
        "verbalAbility": (0-100),
        "confidence": (0-100),
        "interactivity": (0-100),
        "argumentQuality": (0-100),
        "topicRelevance": (0-100),
        "leadership": (0-100),
        "overallScore": (0-100),
        "feedback": "2-3 sentences summary focusing on delivery and impact.",
        "strengths": ["point 1", "point 2"],
        "improvements": ["point 1", "point 2"]
    }}
    """

    messages = [
        {"role": "system", "content": "You are a professional group discussion evaluator. Return only valid JSON."},
        {"role": "user", "content": scoring_prompt}
    ]
    
    # Use PRIMARY client for scoring (needs reasoning)
    resp = generate_primary(messages, max_tokens=400)
    
    if resp and 'choices' in resp:
        try:
            content = resp['choices'][0]['message']['content']
            content = content.replace("```json", "").replace("```", "").strip()
            scores = json.loads(content)
            
            # Apply pause penalty
            if session_state.pause_count > 0:
                penalty = session_state.pause_count * 2
                scores["overallScore"] = max(0, scores.get("overallScore", 0) - penalty)
                scores["pausePenalty"] = penalty
                scores["pauseCount"] = session_state.pause_count
            
            # Add completion metrics
            scores["completionMetrics"] = {
                "sessionDurationMinutes": session_duration_minutes,
                "expectedDurationMinutes": expected_duration_minutes,
                "completionPercentage": completion_percentage,
                "totalTurns": total_turns,
                "userTurns": user_turns,
                "isFullyCompleted": completion_percentage >= 90
            }
            
            return scores
        except Exception as e:
            print(f"Error parsing scores: {e}")
    
    # Fallback scoring
    participation_rate = 0 # Default to 0 for fallback
    base_score = 0 # Default to 0 for fallback
    
    return {
        "verbalAbility": 0,
        "confidence": 0,
        "interactivity": participation_rate,
        "argumentQuality": 0,
        "topicRelevance": 0,
        "leadership": 0,
        "overallScore": base_score,
        "feedback": "Evaluation service unavailable.",
        "strengths": [],
        "improvements": ["Retry session"],
        "pauseCount": session_state.pause_count,
        "pausePenalty": session_state.pause_count * 2 if session_state.pause_count > 0 else 0,
        "completionMetrics": {
            "sessionDurationMinutes": session_duration_minutes,
            "expectedDurationMinutes": expected_duration_minutes,
            "completionPercentage": completion_percentage,
            "totalTurns": total_turns,
            "userTurns": user_turns,
            "isFullyCompleted": completion_percentage >= 90
        }
    }

# Keep existing functions for compatibility
def generate_gd_feedback(sessionId: str, userId: int):
    """Legacy function - redirects to comprehensive scoring"""
    scores = generate_comprehensive_score(sessionId, userId)
    if scores:
        return {
            "feedback": scores.get("feedback", ""),
            "participationScore": scores.get("interactivity", 75),
            "communicationQuality": scores.get("verbalAbility", 75)
        }
    return {
        "feedback": "Keep practicing!",
        "participationScore": 70,
        "communicationQuality": 75
    }

def generate_gd_end_summary(sessionId: str, userId: str, userMessages: list):
    """Generate final summary using comprehensive scoring and save to DB"""
    # IDEMPOTENCY CHECK
    session_state = GD_SESSIONS.get(sessionId)
    if not session_state:
        # If session is gone but we have a result logic, handle here. 
        # For now, just return None if session memory is wiped.
        return None
        
    if not session_state.model.isActive:
        print(f"⚠️ GD Session {sessionId} in progress/completed. Waiting for result...")
        import time
        for _ in range(30): # Wait up to 30 seconds
            if hasattr(session_state, 'final_result') and session_state.final_result:
                return session_state.final_result
            time.sleep(1)
        return {"error": "Session completion timed out"}

    scores = generate_comprehensive_score(sessionId, userId)
    if not scores:
        return None
        
    # PERSISTENCE: Save to Firestore
    try:
        session_state = GD_SESSIONS.get(sessionId)
        topic = session_state.model.topic if session_state else "Unknown Topic"
        
        # completionMetrics is inside scores from generate_comprehensive_score
        duration_mins = scores.get("completionMetrics", {}).get("sessionDurationMinutes", 10)
        
        gd_res = GdResult(
            userId=userId,
            topic=topic,
            duration=duration_mins,
            score=scores.get("overallScore", 0),
            verbalAbility=scores.get("verbalAbility", 0),
            confidence=scores.get("confidence", 0),
            interactivity=scores.get("interactivity", 0),
            argumentQuality=scores.get("argumentQuality", 0),
            topicRelevance=scores.get("topicRelevance", 0),
            leadership=scores.get("leadership", 0),
            strengths=scores.get("strengths", []),
            improvements=scores.get("improvements", []),
            pauseCount=scores.get("pauseCount", 0),
            pausePenalty=scores.get("pausePenalty", 0)
        )
        
        print(f"💾 Automatically saving GD result for session {sessionId}")
        save_result(gd_res)
        
        # Add ID to return value
        scores["id"] = gd_res.id
        
    except Exception as e:
        print(f"❌ Failed to auto-save GD result: {e}")
        
    # Cache result for idempotency
    if session_state:
        session_state.final_result = scores
        # Mark as inactive to trigger the check next time
        session_state.model.isActive = False
        
    return scores

def save_result(result: GdResult):
    """Save GD result to Firestore"""
    result.id = str(uuid.uuid4())
    
    # Convert to dict
    result_dict = result.model_dump()
    from google.cloud.firestore_v1 import SERVER_TIMESTAMP
    result_dict['createdAt'] = SERVER_TIMESTAMP
    
    # Save to Firestore
    firestore_client.collection('gd_results').document(result.id).set(result_dict)
    
    return result

def get_history(userId: str):
    """Get user's GD history from Firestore"""
    results = firestore_client.collection('gd_results')\
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
