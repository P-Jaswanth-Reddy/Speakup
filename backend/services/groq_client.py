"""
Groq AI Client for SpeakUp Platform
Dual-lane architecture:
- PRIMARY: High-quality reasoning (interviews, resume, teach-me, aptitude)
- GD_BOTS: Lightweight fast responses (discussion bots)

CRITICAL: Maintains exact response format for frontend compatibility
"""

import os
import time
import requests
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

# Environment variables
GROQ_API_KEY_PRIMARY = os.getenv("GROQ_API_KEY_PRIMARY")
GROQ_API_KEY_GD_BOTS = os.getenv("GROQ_API_KEY_GD_BOTS")
GROQ_MODEL_PRIMARY = os.getenv("GROQ_MODEL_PRIMARY", "llama-3.3-70b-versatile")
GROQ_MODEL_GD = os.getenv("GROQ_MODEL_GD", "llama-3.1-8b-instant")

# Groq API endpoint
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Retry configuration
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1  # seconds
MAX_RETRY_DELAY = 10  # seconds


def _make_groq_request(
    messages: List[Dict],
    api_key: str,
    model: str,
    temperature: float = 0.7,
    max_tokens: int = 1500,
    timeout: int = 30
) -> Optional[Dict]:
    """
    Internal function to make Groq API request with retry logic.
    Returns OpenAI-spec compatible response format.
    """
    if not api_key:
        print("❌ Groq API key missing")
        return None
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    body = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }
    
    retry_delay = INITIAL_RETRY_DELAY
    
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(
                GROQ_API_URL,
                headers=headers,
                json=body,
                timeout=timeout
            )
            
            # Success
            if response.status_code == 200:
                return response.json()
            
            # Rate limit - retry with exponential backoff
            if response.status_code == 429:
                if attempt < MAX_RETRIES - 1:
                    print(f"⚠️ Rate limited, retrying in {retry_delay}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    time.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)
                    continue
                else:
                    print(f"❌ Rate limit exceeded after {MAX_RETRIES} attempts")
                    return None
            
            # Other errors
            print(f"❌ Groq API error {response.status_code}: {response.text}")
            return None
            
        except requests.exceptions.Timeout:
            print(f"❌ Groq API timeout (attempt {attempt + 1}/{MAX_RETRIES})")
            if attempt < MAX_RETRIES - 1:
                time.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)
                continue
            return None
            
        except Exception as e:
            print(f"❌ Groq API exception: {str(e)}")
            return None
    
    return None


def generate_primary(
    messages: List[Dict],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 1500
) -> Optional[Dict]:
    """
    PRIMARY LLM lane - High-quality reasoning tasks.
    
    Used for:
    - Mock interview responses
    - Resume semantic analysis
    - Teach-me feature
    - AI aptitude question generation
    
    Returns Frontend-compatible format:
    {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "..."
                }
            }
        ]
    }
    """
    if not GROQ_API_KEY_PRIMARY:
        print("❌ GROQ_API_KEY_PRIMARY not configured")
        return None
    
    selected_model = model or GROQ_MODEL_PRIMARY
    
    return _make_groq_request(
        messages=messages,
        api_key=GROQ_API_KEY_PRIMARY,
        model=selected_model,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=30
    )


def generate_gd_bot(
    messages: List[Dict],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 150
) -> Optional[Dict]:
    """
    GD BOT lane - Lightweight fast responses.
    
    Used for:
    - Alex, Sarah, Mike bot responses
    - GD monitor/orchestration
    - Fast lightweight interactions
    
    Returns Frontend-compatible format:
    {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "..."
                }
            }
        ]
    }
    """
    if not GROQ_API_KEY_GD_BOTS:
        print("❌ GROQ_API_KEY_GD_BOTS not configured")
        return None
    
    selected_model = model or GROQ_MODEL_GD
    
    return _make_groq_request(
        messages=messages,
        api_key=GROQ_API_KEY_GD_BOTS,
        model=selected_model,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=15  # Faster timeout for lightweight tasks
    )


def test_groq_keys():
    """
    Test both Groq API keys to ensure they're working.
    Returns dict with test results.
    """
    results = {
        "primary": {"status": "untested", "model": GROQ_MODEL_PRIMARY},
        "gd_bots": {"status": "untested", "model": GROQ_MODEL_GD}
    }
    
    # Test PRIMARY key
    print("🧪 Testing PRIMARY key...")
    test_messages = [
        {"role": "user", "content": "Return JSON: {\"test\": \"primary_ok\"}"}
    ]
    
    primary_response = generate_primary(test_messages, max_tokens=50)
    if primary_response and 'choices' in primary_response:
        results["primary"]["status"] = "success"
        results["primary"]["response"] = primary_response['choices'][0]['message']['content']
        print(f"✅ PRIMARY key working with {GROQ_MODEL_PRIMARY}")
    else:
        results["primary"]["status"] = "failed"
        print(f"❌ PRIMARY key failed")
    
    # Test GD_BOTS key
    print("🧪 Testing GD_BOTS key...")
    test_messages = [
        {"role": "user", "content": "Respond with: GD bot ready."}
    ]
    
    gd_response = generate_gd_bot(test_messages, max_tokens=20)
    if gd_response and 'choices' in gd_response:
        results["gd_bots"]["status"] = "success"
        results["gd_bots"]["response"] = gd_response['choices'][0]['message']['content']
        print(f"✅ GD_BOTS key working with {GROQ_MODEL_GD}")
    else:
        results["gd_bots"]["status"] = "failed"
        print(f"❌ GD_BOTS key failed")
    
    return results


if __name__ == "__main__":
    print("=" * 60)
    print("GROQ CLIENT SANITY TEST")
    print("=" * 60)
    
    results = test_groq_keys()
    
    print("\n" + "=" * 60)
    print("RESULTS:")
    print("=" * 60)
    print(f"PRIMARY ({GROQ_MODEL_PRIMARY}): {results['primary']['status']}")
    if results['primary']['status'] == 'success':
        print(f"  Response: {results['primary']['response']}")
    
    print(f"GD_BOTS ({GROQ_MODEL_GD}): {results['gd_bots']['status']}")
    if results['gd_bots']['status'] == 'success':
        print(f"  Response: {results['gd_bots']['response']}")
    
    if results['primary']['status'] == 'success' and results['gd_bots']['status'] == 'success':
        print("\n✅ Both Groq API keys are functional")
    else:
        print("\n❌ One or more Groq API keys failed")
