import os
import json
import uuid
import random
import requests
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models import AptitudeResult
from datetime import datetime
from dotenv import load_dotenv
from firebase_config import firestore_client

# Import Groq client for PRIMARY lane (high-quality reasoning)
from services.groq_client import generate_primary

# Load environment variables
load_dotenv()

def call_groq(messages, model=None):
    """
    Call Groq API via PRIMARY lane for AI-powered question generation.
    """
    return generate_primary(messages, model=model, temperature=0.9, max_tokens=800)

def load_questions_from_json(topic: str):
    """Load questions from JSON file"""
    file_path = os.path.join(os.path.dirname(__file__), "..", "data", f"{topic.lower()}_questions.json")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading questions from {file_path}: {e}")
        return []

def shuffle_question_options(question):
    """Shuffle options and update correctAnswer index"""
    q_copy = question.copy()
    correct_text = q_copy['options'][q_copy['correctAnswer']]
    
    # Shuffle options
    random.shuffle(q_copy['options'])
    
    # Update correctAnswer to new index
    q_copy['correctAnswer'] = q_copy['options'].index(correct_text)
    
    return q_copy

def get_random_questions(topic: str, count: int = 20):
    """Get random questions with shuffled options"""
    all_questions = load_questions_from_json(topic)
    
    if not all_questions:
        return []
    
    # Select random questions (or all if count > available)
    num_to_select = min(count, len(all_questions))
    selected = random.sample(all_questions, num_to_select)
    
    # Shuffle options for each question
    shuffled = [shuffle_question_options(q) for q in selected]
    
    return shuffled

def get_ai_powered_questions(topic: str):
    """Generate 3 hard questions using Groq LLM"""
    import re

    prompt = f"""Generate exactly 3 difficult {topic} aptitude test questions suitable for competitive exams.

IMPORTANT: Use only plain ASCII text. Do NOT use special symbols like degree signs, superscripts, or Unicode math symbols.
Write math in plain text: use "squared" instead of superscript, "degrees" instead of degree symbol, "divided by" instead of division symbol.

Return ONLY a raw JSON array. No explanation, no markdown, no code fences. Start directly with [ and end with ].

Format:
[
  {{
    "question": "question text here",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correctAnswer": 0,
    "difficulty": "hard",
    "explanation": "explanation text here"
  }}
]

Topic: {topic}"""

    messages = [
        {"role": "system", "content": "You are an expert aptitude test creator. Return ONLY a raw JSON array with no markdown, no code blocks, no extra text. Start your response with [ and end with ]."},
        {"role": "user", "content": prompt}
    ]

    resp = call_groq(messages)

    if resp and 'choices' in resp:
        content = resp['choices'][0]['message']['content'].strip()
        print(f"🤖 Groq raw response for {topic} (first 300 chars): {content[:300]}")

        # Strip markdown fences if present
        content = re.sub(r"```(?:json)?", "", content).replace("```", "").strip()

        # Try direct parse first
        try:
            questions = json.loads(content)
            for i, q in enumerate(questions):
                q['id'] = i + 1
            print(f"✅ AI questions parsed successfully for {topic}")
            return questions
        except json.JSONDecodeError as e:
            print(f"⚠️ Direct JSON parse failed for {topic}: {e}")

        # Fallback: extract JSON array using regex
        try:
            match = re.search(r'\[.*\]', content, re.DOTALL)
            if match:
                questions = json.loads(match.group())
                for i, q in enumerate(questions):
                    q['id'] = i + 1
                print(f"✅ AI questions extracted via regex for {topic}")
                return questions
        except Exception as e:
            print(f"❌ Regex extraction also failed for {topic}: {e}")
            print(f"Full content was: {content}")

    else:
        print(f"❌ No Groq response for {topic} AI questions")

    # Fallback to static questions if AI fails
    print(f"⚠️ Falling back to static questions for {topic}")
    return get_random_questions(topic, 3)

def submit_test(userId: int, topic: str, questions: list, answers: list, timeTaken: int = 0):
    """
    Submit aptitude test answers and generate comprehensive results
    """
    from datetime import datetime
    
    # Calculate results
    correct_count = 0
    incorrect_count = 0
    unanswered_count = 0
    question_breakdown = []
    
    for idx, question in enumerate(questions):
        user_answer = answers[idx] if idx < len(answers) else None
        correct_answer = question.get("correctAnswer", 0)
        
        is_correct = user_answer == correct_answer if user_answer is not None else False
        
        if user_answer is None:
            unanswered_count += 1
            status = "unanswered"
        elif is_correct:
            correct_count += 1
            status = "correct"
        else:
            incorrect_count += 1
            status = "incorrect"
        
        question_breakdown.append({
            "questionNumber": idx + 1,
            "questionText": question.get("question", ""),
            "options": question.get("options", []),
            "correctAnswer": correct_answer,
            "userAnswer": user_answer,
            "status": status,
            "explanation": question.get("explanation", "")
        })
    
    # Calculate score
    total_questions = len(questions)
    score_percentage = round((correct_count / total_questions) * 100) if total_questions > 0 else 0
    
    # Calculate completion metrics
    questions_answered = total_questions - unanswered_count
    completion_percentage = round((questions_answered / total_questions) * 100) if total_questions > 0 else 0
    
    # Determine performance level
    if score_percentage >= 90:
        performance_level = "Excellent"
    elif score_percentage >= 75:
        performance_level = "Good"
    elif score_percentage >= 60:
        performance_level = "Average"
    else:
        performance_level = "Needs Improvement"
    
    # Create result object
    result = AptitudeResult(
        id=str(uuid.uuid4()),
        userId=userId,
        topic=topic,
        score=score_percentage,
        totalQuestions=total_questions,
        accuracy=score_percentage,
        timeTaken=timeTaken,
        correctAnswers=correct_count,
        incorrectAnswers=incorrect_count,
        unansweredQuestions=unanswered_count,
        performanceLevel=performance_level,
        createdAt=datetime.now().isoformat()
    )
    
    # Save to Firestore
    try:
        firestore_client.collection('aptitude_results').document(result.id).set(result.model_dump())
        print(f"✅ Aptitude result saved to Firestore: {result.id}")
    except Exception as e:
        print(f"❌ Failed to save to Firestore: {str(e)}")
    
    # Return comprehensive results
    return {
        "id": result.id,
        "topic": topic,
        "score": score_percentage,
        "totalQuestions": total_questions,
        "correctAnswers": correct_count,
        "incorrectAnswers": incorrect_count,
        "unansweredQuestions": unanswered_count,
        "accuracy": score_percentage,
        "timeTaken": timeTaken,
        "createdAt": result.createdAt,
        "completionMetrics": {
            "questionsAnswered": questions_answered,
            "totalQuestions": total_questions,
            "completionPercentage": completion_percentage,
            "timeTakenMinutes": round(timeTaken / 60) if timeTaken > 0 else 0,
            "isFullyCompleted": unanswered_count == 0
        },
        "questionBreakdown": question_breakdown,
        "performanceLevel": (
            "Excellent" if score_percentage >= 90 else
            "Very Good" if score_percentage >= 75 else
            "Good" if score_percentage >= 60 else
            "Average" if score_percentage >= 50 else
            "Needs Improvement"
        )
    }

def save_result(result: AptitudeResult):
    """Save aptitude result to Firestore"""
    result.id = str(uuid.uuid4())
    
    result_dict = result.model_dump()
    from google.cloud.firestore_v1 import SERVER_TIMESTAMP
    result_dict['createdAt'] = SERVER_TIMESTAMP
    
    firestore_client.collection('aptitude_results').document(result.id).set(result_dict)
    
    return result

def get_history(userId: str):
    """Get user's aptitude history from Firestore.

    Note: Removed order_by to avoid composite index requirement.
    Sorting is done in Python instead.
    """
    results = firestore_client.collection('aptitude_results')\
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
