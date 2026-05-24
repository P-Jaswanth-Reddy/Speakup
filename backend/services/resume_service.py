import os
import time
import requests
import uuid
import json
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models import ResumeResult
from datetime import datetime
from dotenv import load_dotenv
from firebase_config import firestore_client

# Import Groq client for PRIMARY lane (high-quality reasoning)
from services.groq_client import generate_primary

# Import OCR services (Google Document AI + local fallback)
from services.google_document_ai import extract_text_google, is_google_ocr_available
from services.local_pdf_extractor import extract_text_local

# Load environment variables
load_dotenv()


async def analyze_resume_content(file_data: bytes):
    """
    Two-step AI-powered resume analysis:
    1. Smart OCR → Extract text from PDF (Google Document AI with local fallback)
    2. Groq PRIMARY → Comprehensive analysis (parsing, scoring, suggestions)
    """
    
    # STEP 1: Extract text from PDF using smart OCR orchestrator
    print("📄 Step 1: Extracting text from PDF...")
    extracted_text = await extract_text_from_pdf_smart(file_data)
    
    if not extracted_text or len(extracted_text.strip()) < 10:
        print("❌ Failed to extract meaningful text from PDF")
        return {"error": "Could not extract text from resume. Please ensure the file is a valid PDF."}
    
    print(f"✅ Extracted {len(extracted_text)} characters from PDF")
    
    # STEP 2: Send extracted text to Groq PRIMARY for comprehensive analysis
    print("🧠 Step 2: Analyzing with Groq PRIMARY (parsing + scoring + suggestions)...")
    analysis = await analyze_with_groq_primary(extracted_text)
    
    if "error" in analysis:
        return analysis
    
    print("✅ Analysis complete!")
    return analysis


async def extract_text_from_pdf_smart(file_data: bytes) -> str:
    """
    Smart OCR orchestrator with fallback logic:
    
    Priority:
    1. Google Document AI (if configured and available)
    2. Local PDF extraction (pdfplumber/PyPDF2)
    
    Never crashes - always returns best-effort text.
    """
    
    # Try Google Document AI first (if configured)
    if is_google_ocr_available():
        print("🔍 Attempting Google Document AI extraction...")
        
        try:
            text, success = await extract_text_google(file_data)
            
            if success and text and len(text.strip()) >= 50:
                print("✅ Google Document AI extraction successful")
                return text
            else:
                print("⚠️ Google Document AI returned insufficient text - falling back to local")
                
        except Exception as e:
            print(f"⚠️ Google Document AI failed: {str(e)} - falling back to local")
    else:
        print("⚠️ Google Document AI not configured - using local extraction")
    
    # Fallback to local PDF extraction
    print("📄 Using local PDF extraction (pdfplumber/PyPDF2)...")
    
    try:
        text = await extract_text_local(file_data)
        
        if text and len(text.strip()) >= 10:
            print("✅ Local PDF extraction successful")
            return text
        else:
            print("❌ Local PDF extraction returned insufficient text")
            return ""
            
    except Exception as e:
        print(f"❌ Local PDF extraction failed: {str(e)}")
        return ""


async def analyze_with_groq_primary(resume_text: str):
    """
    Send extracted text to Groq PRIMARY for complete analysis:
    - Parse all sections (skills, experience, education, etc.)
    - Calculate ATS score (0-100)
    - Generate improvement suggestions
    """
    analysis_prompt = f"""You are an expert ATS (Applicant Tracking System) and professional HR recruiter analyzing a resume.

RESUME TEXT:
{resume_text}

TASK: Provide a comprehensive analysis of this resume. Respond in VALID JSON format with these exact keys:

{{
  "fullText": "{resume_text[:500]}...",
  "parsedData": {{
    "name": "Full name of candidate",
    "email": "Email address or 'Not found'",
    "phone": "Phone number or 'Not found'",
    "skills": ["list", "of", "all", "technical", "and", "soft", "skills"],
    "experience": "Brief summary of work experience (2-3 sentences highlighting key roles and achievements)",
    "education": "Education details (degrees, institutions, years)",
    "certifications": ["list", "of", "certifications"] or [],
    "summary": "Professional summary/objective if present, otherwise generate a compelling 2-3 line summary based on their background"
  }},
  "atsScore": <number between 0-100>,
  "suggestions": ["list", "of", "5-8", "actionable", "improvement", "suggestions"]
}}

SCORING CRITERIA (0-100):
- Contact info completeness (15 pts)
- Number and relevance of skills (20 pts)
- Experience detail and quantification (25 pts)
- Education clarity (15 pts)
- Use of action verbs and keywords (15 pts)
- Quantifiable achievements (numbers, percentages) (10 pts)

SUGGESTION GUIDELINES:
- Be specific and actionable
- Focus on ATS optimization
- Include formatting, keyword, and content improvements
- Prioritize high-impact changes
- Use emojis for better readability (✅, 💡, 📊, etc.)

Respond ONLY with valid JSON, no markdown formatting."""

    try:
        messages = [
            {"role": "system", "content": "You are an expert ATS analyzer and HR professional. Always respond with valid JSON only."},
            {"role": "user", "content": analysis_prompt}
        ]
        
        # Use Groq PRIMARY for high-quality analysis
        response = generate_primary(messages, temperature=0.4, max_tokens=2000)
        
        if not response or 'choices' not in response:
            print(f"❌ Groq Error: No response")
            return {"error": "Analysis service unavailable"}
        
        response_text = response["choices"][0]["message"]["content"].strip()
        
        # Clean markdown if present
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()
        
        parsed = json.loads(response_text)
        
        # Ensure fullText is the complete extracted text, not truncated
        parsed["fullText"] = resume_text
        
        return parsed
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {str(e)}")
        print(f"Response was: {response_text[:500]}...")
        return {"error": f"Failed to parse Groq response as JSON: {str(e)}"}
    except Exception as e:
        print(f"❌ Groq Analysis Exception: {str(e)}")
        return {"error": "Analysis processing error"}

def save_result(result: ResumeResult):
    """Save resume result to Firestore"""
    from google.cloud.firestore_v1 import SERVER_TIMESTAMP
    
    result.id = str(uuid.uuid4())
    
    result_dict = result.model_dump()
    result_dict['createdAt'] = SERVER_TIMESTAMP
    
    firestore_client.collection('resume_results').document(result.id).set(result_dict)
    
    return result

def get_history(userId: str):
    """Get resume history from Firestore for a user (userId is now Firebase UID)"""
    results = []
    # Query without ordering to avoid composite index requirement
    docs = firestore_client.collection('resume_results')\
        .where('userId', '==', userId)\
        .stream()
    
    for doc in docs:
        data = doc.to_dict()
        results.append(ResumeResult(**data))
    
    # Sort in Python
    def get_sort_key(x):
        created = x.createdAt if x.createdAt else ''
        if hasattr(created, 'isoformat'):
            return created.isoformat()
        return str(created)
        
    results.sort(key=get_sort_key, reverse=True)
    return results
