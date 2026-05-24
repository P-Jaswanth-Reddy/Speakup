"""
Coding Interview Module Service
- Problem generation via Groq AI (5 test cases, 3 languages)
- Code execution via Judge0 (localhost:2358)
- Firestore storage for problems, submissions, and question bank
- LeetCode-style: Run (syntax check) vs Submit (full test cases)
"""

import os
import json
import uuid
import time
import random
import requests
from datetime import datetime
from typing import Optional, Dict, List
from dotenv import load_dotenv

import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from services.groq_client import generate_primary
from firebase_config import firestore_client
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

load_dotenv()

# ===== CONSTANTS =====

# Judge0 EC2 instance (primary) and localhost (fallback)
JUDGE0_EC2_URL = os.getenv("JUDGE0_EC2_URL", "http://ec2-13-232-128-45.ap-south-1.compute.amazonaws.com:2358")
JUDGE0_LOCAL_URL = os.getenv("JUDGE0_LOCAL_URL", "http://localhost:2358")

def get_judge0_url():
    """
    Determine the active Judge0 endpoint at startup.
    Priority:
      1. JUDGE0_URL env var (explicit override — use as-is)
      2. JUDGE0_EC2_URL (AWS EC2 instance — check reachability)
      3. JUDGE0_LOCAL_URL (localhost Docker fallback)
    """
    # If user explicitly set JUDGE0_URL, respect it directly
    explicit_url = os.getenv("JUDGE0_URL")
    if explicit_url and explicit_url not in ("http://localhost:2358",):
        print(f"✅ Judge0 URL explicitly set: {explicit_url}")
        return explicit_url

    # Try EC2 instance first
    try:
        print(f"🔍 Checking Judge0 on EC2: {JUDGE0_EC2_URL} ...")
        health = requests.get(f"{JUDGE0_EC2_URL}/about", timeout=3)
        if health.status_code == 200:
            print(f"✅ Judge0 EC2 instance is reachable: {JUDGE0_EC2_URL}")
            return JUDGE0_EC2_URL
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        print(f"⚠️ Judge0 EC2 instance not reachable at {JUDGE0_EC2_URL}")
    except Exception as e:
        print(f"⚠️ Judge0 EC2 health check failed: {e}")

    # Fall back to localhost
    print(f"🔄 Falling back to local Judge0: {JUDGE0_LOCAL_URL}")
    return JUDGE0_LOCAL_URL

JUDGE0_URL = get_judge0_url()

# Store the fallback URL for runtime failover
JUDGE0_FALLBACK_URL = JUDGE0_LOCAL_URL if JUDGE0_URL == JUDGE0_EC2_URL else JUDGE0_EC2_URL

# Judge0 language IDs (from /languages endpoint)
LANGUAGE_MAP = {
    "python": {"id": 71, "name": "Python (3.8.1)", "monaco": "python"},
    "java": {"id": 62, "name": "Java (OpenJDK 13.0.1)", "monaco": "java"},
    "cpp": {"id": 54, "name": "C++ (GCC 9.2.0)", "monaco": "cpp"},
}

TOPICS = [
    "Arrays", "Strings", "Linked Lists", "Trees",
    "Dynamic Programming", "Sorting", "Searching",
    "Stacks & Queues", "Graphs", "Math"
]

DIFFICULTY_LEVELS = ["easy", "medium", "hard"]

# In-memory session storage (active sessions only)
CODING_SESSIONS = {}


# ===== FIRESTORE STORAGE =====

def save_problem(problem_data: dict):
    """Save a problem to Firestore coding_problems collection."""
    pid = problem_data.get("problemId", str(uuid.uuid4()))
    problem_data["problemId"] = pid
    problem_data["updatedAt"] = SERVER_TIMESTAMP
    if "createdAt" not in problem_data:
        problem_data["createdAt"] = SERVER_TIMESTAMP
    firestore_client.collection('coding_problems').document(pid).set(problem_data, merge=True)
    print(f"✅ Saved problem to Firestore: {problem_data.get('title', pid)}")


def get_problem(problem_id: str) -> Optional[dict]:
    """Get a specific problem by ID from Firestore."""
    doc = firestore_client.collection('coding_problems').document(problem_id).get()
    if doc.exists:
        return doc.to_dict()
    return None


def save_submission(submission: dict):
    """Save a submission to Firestore coding_submissions collection."""
    sub_id = submission.get("submissionId", str(uuid.uuid4()))
    submission["submissionId"] = sub_id
    submission["createdAt"] = SERVER_TIMESTAMP
    firestore_client.collection('coding_submissions').document(sub_id).set(submission)
    print(f"💾 Saved submission to Firestore: {submission.get('problemTitle', sub_id)}")


def get_user_history(user_id: str) -> list:
    """Get all submissions for a user, grouped by problem, from Firestore."""
    docs = firestore_client.collection('coding_submissions')\
        .where('userId', '==', user_id)\
        .stream()
    
    all_subs = [doc.to_dict() for doc in docs]
    
    # Group by problemId
    problem_map = {}
    for sub in all_subs:
        pid = sub.get("problemId", "")
        if pid not in problem_map:
            problem_map[pid] = {
                "problemId": pid,
                "problemTitle": sub.get("problemTitle", ""),
                "difficulty": sub.get("difficulty", ""),
                "topic": sub.get("topic", ""),
                "submissions": [],
                "totalSubmissions": 0,
                "successCount": 0,
                "failCount": 0,
                "lastAttempt": "",
            }
        # Add submission (without heavy fields like code/results for list view)
        problem_map[pid]["submissions"].append({
            "submissionId": sub.get("submissionId", ""),
            "language": sub.get("language", ""),
            "totalTests": sub.get("totalTests", 0),
            "passed": sub.get("passed", 0),
            "allPassed": sub.get("allPassed", False),
            "createdAt": sub.get("createdAt", ""),
        })
        problem_map[pid]["totalSubmissions"] += 1
        if sub.get("allPassed"):
            problem_map[pid]["successCount"] += 1
        else:
            problem_map[pid]["failCount"] += 1
        # Track lastAttempt
        created = sub.get("createdAt", "")
        if hasattr(created, 'isoformat'):
            created = created.isoformat()
        problem_map[pid]["lastAttempt"] = str(created)
    
    result = list(problem_map.values())
    # Sort submissions within each problem by time
    for item in result:
        item["submissions"].sort(
            key=lambda x: str(x.get("createdAt", "")), reverse=True
        )
    result.sort(key=lambda x: x.get("lastAttempt", ""), reverse=True)
    return result


def get_problem_submissions(user_id: str, problem_id: str) -> list:
    """Get all submissions for a specific problem by a user from Firestore."""
    docs = firestore_client.collection('coding_submissions')\
        .where('userId', '==', user_id)\
        .where('problemId', '==', problem_id)\
        .stream()
    
    subs = [doc.to_dict() for doc in docs]
    subs.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)
    return subs


# ===== QUESTION BANK =====

def get_random_problem_from_bank(topic: str, difficulty: str, user_id: str = None) -> Optional[dict]:
    """
    Get a random pre-generated problem from the question bank.
    Tries to avoid problems the user has already attempted.
    """
    # Query all pre-generated problems for this topic+difficulty
    docs = firestore_client.collection('coding_problems')\
        .where('topic', '==', topic)\
        .where('difficulty', '==', difficulty)\
        .where('isPreGenerated', '==', True)\
        .stream()
    
    problems = [doc.to_dict() for doc in docs]
    
    if not problems:
        return None
    
    # If user provided, try to exclude already-attempted problems
    if user_id:
        attempted_docs = firestore_client.collection('coding_submissions')\
            .where('userId', '==', user_id)\
            .stream()
        attempted_pids = set(doc.to_dict().get("problemId", "") for doc in attempted_docs)
        unattempted = [p for p in problems if p.get("problemId") not in attempted_pids]
        if unattempted:
            problems = unattempted
    
    # Pick random
    chosen = random.choice(problems)
    return chosen


def get_bank_stats() -> dict:
    """Get question bank counts per topic and difficulty."""
    docs = firestore_client.collection('coding_problems')\
        .where('isPreGenerated', '==', True)\
        .stream()
    
    stats = {}
    for doc in docs:
        d = doc.to_dict()
        topic = d.get("topic", "Unknown")
        diff = d.get("difficulty", "unknown")
        if topic not in stats:
            stats[topic] = {"easy": 0, "medium": 0, "hard": 0, "total": 0}
        stats[topic][diff] = stats[topic].get(diff, 0) + 1
        stats[topic]["total"] += 1
    
    return stats


def list_bank_questions(topic: str = None, difficulty: str = None) -> list:
    """List all pre-generated questions, optionally filtered by topic/difficulty."""
    query = firestore_client.collection('coding_problems')\
        .where('isPreGenerated', '==', True)
    
    if topic:
        query = query.where('topic', '==', topic)
    if difficulty:
        query = query.where('difficulty', '==', difficulty)
    
    docs = query.stream()
    
    questions = []
    for doc in docs:
        d = doc.to_dict()
        questions.append({
            "problemId": d.get("problemId", ""),
            "title": d.get("title", ""),
            "topic": d.get("topic", ""),
            "difficulty": d.get("difficulty", ""),
            "functionName": d.get("functionName", ""),
        })
    
    # Sort: easy first, then medium, then hard
    diff_order = {"easy": 0, "medium": 1, "hard": 2}
    questions.sort(key=lambda x: (x.get("topic", ""), diff_order.get(x.get("difficulty", ""), 9)))
    return questions


# ===== JUDGE0 EXECUTION =====

def execute_on_judge0(source_code: str, language_id: int, stdin: str = "", timeout: int = 10) -> dict:
    """
    Execute code on Judge0 with automatic failover.
    Tries the primary JUDGE0_URL first. If connection fails, retries on JUDGE0_FALLBACK_URL.
    Returns: { stdout, stderr, compile_output, status, time, memory }
    """
    urls_to_try = [JUDGE0_URL]
    if JUDGE0_FALLBACK_URL and JUDGE0_FALLBACK_URL != JUDGE0_URL:
        urls_to_try.append(JUDGE0_FALLBACK_URL)

    last_error = None

    for judge0_url in urls_to_try:
        try:
            payload = {
                "source_code": source_code,
                "language_id": language_id,
                "stdin": stdin,
                "cpu_time_limit": 5,
                "wall_time_limit": 10,
                "memory_limit": 128000,
            }
            
            create_resp = requests.post(
                f"{judge0_url}/submissions?base64_encoded=false&wait=true",
                json=payload,
                timeout=30
            )
            
            if create_resp.status_code not in (200, 201):
                create_resp2 = requests.post(
                    f"{judge0_url}/submissions?base64_encoded=false",
                    json=payload,
                    timeout=10
                )
                if create_resp2.status_code not in (200, 201):
                    return {
                        "stdout": "",
                        "stderr": f"Judge0 submission failed: {create_resp2.status_code}",
                        "compile_output": "",
                        "status": {"id": 0, "description": "Error"},
                        "time": "0",
                        "memory": 0
                    }
                
                token = create_resp2.json().get("token")
                for _ in range(timeout * 2):
                    time.sleep(0.5)
                    result_resp = requests.get(
                        f"{judge0_url}/submissions/{token}?base64_encoded=false",
                        timeout=5
                    )
                    if result_resp.status_code == 200:
                        result = result_resp.json()
                        status_id = result.get("status", {}).get("id", 0)
                        if status_id not in (1, 2):
                            return result
                
                return {
                    "stdout": "",
                    "stderr": "Execution timed out",
                    "compile_output": "",
                    "status": {"id": 0, "description": "Timeout"},
                    "time": "0",
                    "memory": 0
                }
            
            return create_resp.json()
            
        except requests.exceptions.ConnectionError as e:
            last_error = e
            if judge0_url != urls_to_try[-1]:
                print(f"⚠️ Judge0 at {judge0_url} unreachable, trying fallback...")
                continue
            return {
                "stdout": "",
                "stderr": f"Judge0 is not running. Tried: {', '.join(urls_to_try)}",
                "compile_output": "",
                "status": {"id": 0, "description": "Connection Error"},
                "time": "0",
                "memory": 0
            }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": f"Execution error: {str(e)}",
                "compile_output": "",
                "status": {"id": 0, "description": "Error"},
                "time": "0",
                "memory": 0
            }


# ===== STARTER CODE TEMPLATES =====

def get_starter_code(language: str, function_name: str = "solution", params: str = "nums", return_type: str = ""):
    """Generate language-specific starter code with proper structure."""
    templates = {
        "python": f'def {function_name}({params}):\n    # Write your solution here\n    pass\n',
        "java": f'import java.util.*;\n\nclass Solution {{\n    public static String {function_name}({params}) {{\n        // Write your solution here\n        return "";\n    }}\n}}\n',
        "cpp": f'#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nstring {function_name}({params}) {{\n    // Write your solution here\n    return "";\n}}\n',
    }
    return templates.get(language, templates["python"])


# ===== PROBLEM GENERATION =====

def generate_problem(topic: str, difficulty: str, language: str = "python") -> dict:
    """Generate a coding problem using Groq AI with 5 test cases."""
    
    prompt = f"""Generate a coding interview problem with these specs:
- Topic: {topic}
- Difficulty: {difficulty}

CRITICAL REQUIREMENTS:
1. The problem must have EXACTLY 5 test cases
2. Each test case must have a simple string input and string expected output
3. The function should take string input and return string output
4. The test cases inputs should be on separate lines if multiple parameters
5. Include a complete working solution in Python

Return ONLY valid JSON in this EXACT format (no markdown, no explanation):
{{
  "title": "Problem Title",
  "description": "Clear, detailed problem description (2-3 paragraphs). Explain what the function should do, what inputs it receives, and what it should return.",
  "examples": [
    {{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "Because nums[0] + nums[1] == 9"}},
    {{"input": "nums = [3,2,4], target = 6", "output": "[1,2]", "explanation": "Because nums[1] + nums[2] == 6"}}
  ],
  "constraints": ["1 <= nums.length <= 10^4", "Each element is unique"],
  "functionName": "twoSum",
  "parameters": "nums, target",
  "returnType": "list",
  "testCases": [
    {{"input": "[2,7,11,15]\\n9", "expectedOutput": "[0, 1]"}},
    {{"input": "[3,2,4]\\n6", "expectedOutput": "[1, 2]"}},
    {{"input": "[3,3]\\n6", "expectedOutput": "[0, 1]"}},
    {{"input": "[1,5,3,7]\\n8", "expectedOutput": "[1, 3]"}},
    {{"input": "[4,4]\\n8", "expectedOutput": "[0, 1]"}}
  ],
  "hints": ["Consider using a hash map", "Think about what complement you need"],
  "optimalComplexity": {{"time": "O(n)", "space": "O(n)"}},
  "solutionCode": "def twoSum(nums, target):\\n    seen = {{}}\\n    for i, n in enumerate(nums):\\n        comp = target - n\\n        if comp in seen:\\n            return [seen[comp], i]\\n        seen[n] = i\\n    return []",
  "timeLimit": 30
}}

IMPORTANT:
- testCases must have EXACTLY 5 entries
- solutionCode must be a complete, working Python solution
- The solution must correctly produce expectedOutput for each testCase input
- Make the problem realistic, similar to LeetCode problems
- The input format in testCases should be parseable (each parameter on a new line)
JSON Response:"""

    try:
        messages = [
            {"role": "system", "content": "You are an expert coding interview question designer. You create problems similar to LeetCode. Return ONLY valid JSON, no markdown wrappers."},
            {"role": "user", "content": prompt}
        ]
        
        resp = generate_primary(messages, max_tokens=2000, temperature=0.8)
        if resp and 'choices' in resp:
            content = resp['choices'][0]['message']['content'].strip()
            
            # Clean markdown wrappers
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            problem = json.loads(content)
            
            # Validate we have 5 test cases
            test_cases = problem.get("testCases", [])
            if len(test_cases) < 5:
                while len(test_cases) < 5:
                    test_cases.append(test_cases[len(test_cases) % max(len(test_cases), 1)])
                problem["testCases"] = test_cases[:5]
            elif len(test_cases) > 5:
                problem["testCases"] = test_cases[:5]
            
            # Generate IDs
            problem_id = str(uuid.uuid4())
            session_id = str(uuid.uuid4())
            func_name = problem.get("functionName", "solution")
            params = problem.get("parameters", "input")
            
            # Generate starter codes for all languages
            starter_codes = {}
            for lang in LANGUAGE_MAP.keys():
                starter_codes[lang] = get_starter_code(lang, func_name, params)
            
            # Build session
            session = {
                "sessionId": session_id,
                "problemId": problem_id,
                "problem": problem,
                "topic": topic,
                "difficulty": difficulty,
                "starterCodes": starter_codes,
                "createdAt": datetime.now().isoformat(),
            }
            
            CODING_SESSIONS[session_id] = session
            
            # Save problem to Firestore
            problem_record = {
                "problemId": problem_id,
                "title": problem["title"],
                "description": problem["description"],
                "examples": problem.get("examples", []),
                "constraints": problem.get("constraints", []),
                "functionName": func_name,
                "parameters": params,
                "returnType": problem.get("returnType", ""),
                "testCases": problem["testCases"],
                "hints": problem.get("hints", []),
                "optimalComplexity": problem.get("optimalComplexity", {}),
                "solutionCode": problem.get("solutionCode", ""),
                "timeLimit": problem.get("timeLimit", 30),
                "topic": topic,
                "difficulty": difficulty,
                "starterCodes": starter_codes,
                "isPreGenerated": False,  # AI-generated on the fly
            }
            save_problem(problem_record)
            
            print(f"✅ Generated problem: {problem['title']} ({difficulty}/{topic}) with {len(problem['testCases'])} test cases")
            
            return {
                "sessionId": session_id,
                "problemId": problem_id,
                "title": problem["title"],
                "description": problem["description"],
                "examples": problem.get("examples", []),
                "constraints": problem.get("constraints", []),
                "functionName": func_name,
                "parameters": params,
                "starterCodes": starter_codes,
                "difficulty": difficulty,
                "topic": topic,
                "hints": problem.get("hints", []),
                "testCases": problem["testCases"],
                "optimalComplexity": problem.get("optimalComplexity", {}),
                "timeLimit": problem.get("timeLimit", 30),
            }
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error in problem generation: {e}")
    except Exception as e:
        print(f"❌ Problem generation error: {e}")
    
    # Fallback problem
    return get_fallback_problem(topic, difficulty)


def get_or_generate_problem(topic: str, difficulty: str, user_id: str, use_ai: bool = False) -> dict:
    """
    Main entry point for getting a coding problem.
    - use_ai=False: Pick from pre-generated question bank
    - use_ai=True: Generate a new problem via AI
    """
    if use_ai:
        return generate_problem(topic, difficulty)
    
    # Try question bank first
    bank_problem = get_random_problem_from_bank(topic, difficulty, user_id)
    if bank_problem:
        # Check and inject starterCodes if missing
        starter_codes = bank_problem.get("starterCodes", {})
        if not starter_codes:
            func_name = bank_problem.get("functionName", "solution")
            params = bank_problem.get("parameters", "input")
            for lang in LANGUAGE_MAP.keys():
                starter_codes[lang] = get_starter_code(lang, func_name, params)

        # Create a session for this bank problem
        session_id = str(uuid.uuid4())
        problem_id = bank_problem.get("problemId", str(uuid.uuid4()))
        
        session = {
            "sessionId": session_id,
            "problemId": problem_id,
            "problem": bank_problem,
            "topic": topic,
            "difficulty": difficulty,
            "starterCodes": starter_codes,
            "createdAt": datetime.now().isoformat(),
        }
        CODING_SESSIONS[session_id] = session
        
        return {
            "sessionId": session_id,
            "problemId": problem_id,
            "title": bank_problem.get("title", ""),
            "description": bank_problem.get("description", ""),
            "examples": bank_problem.get("examples", []),
            "constraints": bank_problem.get("constraints", []),
            "functionName": bank_problem.get("functionName", "solution"),
            "parameters": bank_problem.get("parameters", ""),
            "starterCodes": starter_codes,
            "difficulty": difficulty,
            "topic": topic,
            "hints": bank_problem.get("hints", []),
            "testCases": bank_problem.get("testCases", []),
            "optimalComplexity": bank_problem.get("optimalComplexity", {}),
            "timeLimit": bank_problem.get("timeLimit", 30),
        }
    
    # No bank questions available, fall back to AI generation
    print(f"⚠️ No bank questions for {topic}/{difficulty}, falling back to AI generation")
    return generate_problem(topic, difficulty)


def get_fallback_problem(topic: str, difficulty: str) -> dict:
    """Fallback problem if AI generation fails."""
    problem_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    problem = {
        "title": "Two Sum",
        "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
        "examples": [
            {"input": "nums = [2,7,11,15], target = 9", "output": "[0, 1]", "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."},
            {"input": "nums = [3,2,4], target = 6", "output": "[1, 2]", "explanation": "Because nums[1] + nums[2] == 6, we return [1, 2]."}
        ],
        "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists"],
        "functionName": "twoSum",
        "parameters": "nums, target",
        "returnType": "list",
        "testCases": [
            {"input": "[2,7,11,15]\n9", "expectedOutput": "[0, 1]"},
            {"input": "[3,2,4]\n6", "expectedOutput": "[1, 2]"},
            {"input": "[3,3]\n6", "expectedOutput": "[0, 1]"},
            {"input": "[1,5,3,7]\n8", "expectedOutput": "[1, 3]"},
            {"input": "[4,4]\n8", "expectedOutput": "[0, 1]"}
        ],
        "hints": ["Use a hash map to store complements", "For each number, check if target - number exists in the map"],
        "optimalComplexity": {"time": "O(n)", "space": "O(n)"},
        "solutionCode": "def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        comp = target - n\n        if comp in seen:\n            return [seen[comp], i]\n        seen[n] = i\n    return []",
        "timeLimit": 30,
    }
    
    starter_codes = {}
    for lang in LANGUAGE_MAP.keys():
        starter_codes[lang] = get_starter_code(lang, "twoSum", "nums, target")
    
    session = {
        "sessionId": session_id,
        "problemId": problem_id,
        "problem": problem,
        "topic": topic,
        "difficulty": difficulty,
        "starterCodes": starter_codes,
        "createdAt": datetime.now().isoformat(),
    }
    CODING_SESSIONS[session_id] = session
    
    # Save to Firestore
    problem_record = {**problem, "problemId": problem_id, "topic": topic, "difficulty": difficulty, "starterCodes": starter_codes, "isPreGenerated": False}
    save_problem(problem_record)
    
    return {
        "sessionId": session_id,
        "problemId": problem_id,
        "title": problem["title"],
        "description": problem["description"],
        "examples": problem["examples"],
        "constraints": problem["constraints"],
        "functionName": "twoSum",
        "parameters": "nums, target",
        "starterCodes": starter_codes,
        "difficulty": difficulty,
        "topic": topic,
        "hints": problem["hints"],
        "testCases": problem["testCases"],
        "optimalComplexity": problem["optimalComplexity"],
        "timeLimit": problem.get("timeLimit", 30),
    }


# ===== CODE BUILDING (wrap user code with test harness) =====

def build_runnable_code(user_code: str, language: str, test_input: str = "") -> str:
    """
    Build a complete runnable program by wrapping the user's function code
    with a main/driver that reads stdin, calls the function, prints the result.
    """
    lang_id = LANGUAGE_MAP.get(language, {}).get("id", 71)
    
    if language == "python":
        return f"""{user_code}

import sys, json

if __name__ == "__main__":
    input_data = sys.stdin.read().strip()
    if input_data:
        lines = input_data.split("\\n")
        try:
            args = []
            for line in lines:
                line = line.strip()
                try:
                    args.append(json.loads(line))
                except:
                    args.append(line)
            import inspect
            user_funcs = [name for name, obj in globals().items() 
                         if callable(obj) and not name.startswith('_') 
                         and name not in ('print', 'input', 'open', 'exec', 'eval')]
            if user_funcs:
                func = globals()[user_funcs[0]]
                result = func(*args)
                if isinstance(result, list):
                    print(json.dumps(result))
                elif isinstance(result, bool):
                    print(str(result).lower())
                elif result is None:
                    print("null")
                else:
                    print(result)
        except Exception as e:
            print(f"Error: {{e}}", file=sys.stderr)
            sys.exit(1)
"""
    
    elif language == "java":
        return f"""{user_code.replace('class Solution', 'class Main').replace('class solution', 'class Main') if 'class Solution' in user_code or 'class solution' in user_code else f'import java.util.*;\\nclass Main {{\\n{user_code}\\n    public static void main(String[] args) {{\\n        java.util.Scanner sc = new java.util.Scanner(System.in);\\n        StringBuilder sb = new StringBuilder();\\n        while(sc.hasNextLine()) sb.append(sc.nextLine()).append("\\\\n");\\n        System.out.println(sb.toString().trim());\\n    }}\\n}}'}
"""
    
    elif language == "cpp":
        if "int main" not in user_code:
            return f"""{user_code}

int main() {{
    std::string line;
    std::vector<std::string> lines;
    while(std::getline(std::cin, line)) {{
        lines.push_back(line);
    }}
    for(auto& l : lines) std::cout << l << std::endl;
    return 0;
}}
"""
        return user_code
    
    return user_code


# ===== RUN (Syntax Check Only) =====

def run_code(session_id: str, code: str, language: str) -> dict:
    """
    Run code for syntax checking only - no test case input.
    Returns compilation status and any errors.
    """
    lang_config = LANGUAGE_MAP.get(language)
    if not lang_config:
        return {"success": False, "output": "", "errors": f"Unsupported language: {language}"}
    
    runnable = build_runnable_code(code, language)
    result = execute_on_judge0(runnable, lang_config["id"], stdin="")
    
    status = result.get("status", {})
    status_id = status.get("id", 0)
    status_desc = status.get("description", "Unknown")
    
    stdout = (result.get("stdout") or "").strip()
    stderr = (result.get("stderr") or "").strip()
    compile_output = (result.get("compile_output") or "").strip()
    
    if status_id == 3:
        return {
            "success": True,
            "output": "✅ Compilation successful! Code is syntactically correct.",
            "errors": "",
            "time": result.get("time", "0"),
            "memory": result.get("memory", 0),
        }
    elif status_id == 6:
        return {
            "success": False,
            "output": "",
            "errors": f"Compilation Error:\n{compile_output}",
            "time": "0",
            "memory": 0,
        }
    elif status_id == 5:
        return {
            "success": False,
            "output": "",
            "errors": "Time Limit Exceeded",
            "time": result.get("time", "0"),
            "memory": result.get("memory", 0),
        }
    elif status_id == 11:
        return {
            "success": False,
            "output": "",
            "errors": f"Runtime Error:\n{stderr or compile_output}",
            "time": result.get("time", "0"),
            "memory": result.get("memory", 0),
        }
    else:
        error_msg = stderr or compile_output or status_desc
        if status_id == 0 and not error_msg:
            error_msg = "Judge0 connection failed"
        return {
            "success": status_id == 3,
            "output": stdout if status_id == 3 else "",
            "errors": error_msg if status_id != 3 else "",
            "time": result.get("time", "0"),
            "memory": result.get("memory", 0),
        }


# ===== SUBMIT (Run Against Test Cases) =====

def submit_code(session_id: str, code: str, language: str, user_id: str) -> dict:
    """
    Submit code against all 5 test cases using Judge0.
    Returns detailed test case results.
    """
    session = CODING_SESSIONS.get(session_id)
    if not session:
        return {"error": "Session not found. Please generate a new problem."}
    
    problem = session["problem"]
    test_cases = problem.get("testCases", [])
    lang_config = LANGUAGE_MAP.get(language)
    
    if not lang_config:
        return {"error": f"Unsupported language: {language}"}
    
    runnable = build_runnable_code(code, language)
    
    results = []
    passed = 0
    
    for i, tc in enumerate(test_cases):
        stdin_input = tc.get("input", "")
        expected = tc.get("expectedOutput", "").strip()
        
        exec_result = execute_on_judge0(runnable, lang_config["id"], stdin=stdin_input)
        
        status = exec_result.get("status", {})
        status_id = status.get("id", 0)
        stdout = (exec_result.get("stdout") or "").strip()
        stderr = (exec_result.get("stderr") or "").strip()
        compile_output = (exec_result.get("compile_output") or "").strip()
        
        actual = stdout.strip()
        expected_clean = expected.strip()
        
        is_pass = normalize_output(actual) == normalize_output(expected_clean)
        
        if is_pass:
            passed += 1
        
        error_display = ""
        if status_id == 6:
            error_display = f"Compilation Error: {compile_output}"
        elif status_id == 11:
            error_display = f"Runtime Error: {stderr}"
        elif status_id == 5:
            error_display = "Time Limit Exceeded"
        elif stderr:
            error_display = stderr
        
        results.append({
            "testCase": i + 1,
            "input": stdin_input,
            "expected": expected,
            "actual": actual,
            "passed": is_pass,
            "errors": error_display,
            "time": exec_result.get("time", "0"),
            "memory": exec_result.get("memory", 0),
            "statusDescription": status.get("description", "Unknown"),
        })
    
    all_passed = passed == len(test_cases)
    
    # Save submission to Firestore
    submission_record = {
        "submissionId": str(uuid.uuid4()),
        "userId": user_id,
        "problemId": session.get("problemId", ""),
        "problemTitle": problem.get("title", ""),
        "sessionId": session_id,
        "topic": session.get("topic", ""),
        "difficulty": session.get("difficulty", ""),
        "language": language,
        "code": code,
        "totalTests": len(test_cases),
        "passed": passed,
        "failed": len(test_cases) - passed,
        "allPassed": all_passed,
        "results": results,
    }
    save_submission(submission_record)
    
    return {
        "totalTests": len(test_cases),
        "passed": passed,
        "failed": len(test_cases) - passed,
        "allPassed": all_passed,
        "results": results,
        "problemTitle": problem.get("title", ""),
        "language": language,
        "difficulty": session.get("difficulty", ""),
        "topic": session.get("topic", ""),
    }


def normalize_output(s: str) -> str:
    """Normalize output for flexible comparison."""
    s = s.strip()
    s = s.replace(" ", "")
    s = s.replace("'", '"')
    s = s.replace("True", "true").replace("False", "false")
    s = s.replace("None", "null")
    return s


# ===== LOAD PROBLEM FOR REATTEMPT =====

def load_problem_for_reattempt(problem_id: str) -> Optional[dict]:
    """Load a previously generated problem for reattempting."""
    problem_data = get_problem(problem_id)
    if not problem_data:
        return None
    
    starter_codes = problem_data.get("starterCodes", {})
    if not starter_codes:
        func_name = problem_data.get("functionName", "solution")
        params = problem_data.get("parameters", "input")
        for lang in LANGUAGE_MAP.keys():
            starter_codes[lang] = get_starter_code(lang, func_name, params)

    session_id = str(uuid.uuid4())
    
    session = {
        "sessionId": session_id,
        "problemId": problem_id,
        "problem": problem_data,
        "topic": problem_data.get("topic", ""),
        "difficulty": problem_data.get("difficulty", ""),
        "starterCodes": starter_codes,
        "createdAt": datetime.now().isoformat(),
    }
    CODING_SESSIONS[session_id] = session
    
    return {
        "sessionId": session_id,
        "problemId": problem_id,
        "title": problem_data.get("title", ""),
        "description": problem_data.get("description", ""),
        "examples": problem_data.get("examples", []),
        "constraints": problem_data.get("constraints", []),
        "functionName": problem_data.get("functionName", "solution"),
        "parameters": problem_data.get("parameters", ""),
        "starterCodes": starter_codes,
        "difficulty": problem_data.get("difficulty", ""),
        "topic": problem_data.get("topic", ""),
        "hints": problem_data.get("hints", []),
        "testCases": problem_data.get("testCases", []),
        "optimalComplexity": problem_data.get("optimalComplexity", {}),
        "timeLimit": problem_data.get("timeLimit", 30),
    }


# ===== INFO =====

def get_supported_languages() -> list:
    """Return list of supported languages."""
    return [
        {"id": k, "name": v["name"], "monaco": v["monaco"], "judgeId": v["id"]}
        for k, v in LANGUAGE_MAP.items()
    ]

def get_topics() -> list:
    """Return list of coding topics."""
    return TOPICS
