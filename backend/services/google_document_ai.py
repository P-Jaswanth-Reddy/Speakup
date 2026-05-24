"""
Google Document AI Service for SpeakUp Platform
Provides OCR capabilities using Google Cloud Document AI with graceful fallback.
"""

import os
from typing import Tuple
from dotenv import load_dotenv

load_dotenv()

# Google Cloud Configuration
GOOGLE_PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
GOOGLE_LOCATION = os.getenv("GOOGLE_LOCATION", "us")
GOOGLE_PROCESSOR_ID = os.getenv("GOOGLE_PROCESSOR_ID")
GOOGLE_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

# Initialize client only if credentials are present
_document_ai_client = None


def _initialize_client():
    """Initialize Google Document AI client lazily and safely."""
    global _document_ai_client
    
    if _document_ai_client is not None:
        return _document_ai_client
    
    # Check if all required configuration is present
    if not all([GOOGLE_PROJECT_ID, GOOGLE_LOCATION, GOOGLE_PROCESSOR_ID]):
        print("⚠️ Google Document AI configuration incomplete (Project/Location/Processor ID)")
        return None

    try:
        from google.cloud import documentai_v1 as documentai
        from google.oauth2 import service_account
        import json

        creds = None
        
        # 1. Try JSON String from Environment (Preferred for Production)
        json_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON") or os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if json_creds:
            try:
                cred_dict = json.loads(json_creds)
                creds = service_account.Credentials.from_service_account_info(cred_dict)
                print("✅ Google Document AI loaded credentials from environment JSON")
            except Exception as e:
                print(f"⚠️ Failed to parse credential JSON: {e}")

        # 2. Try File Path (Fallback / Local)
        if not creds and GOOGLE_CREDENTIALS and os.path.exists(GOOGLE_CREDENTIALS):
            creds = service_account.Credentials.from_service_account_file(GOOGLE_CREDENTIALS)
            print(f"✅ Google Document AI loaded credentials from file: {GOOGLE_CREDENTIALS}")

        # If no credentials found or created
        if not creds:
             print("⚠️ No valid Google credentials found (Check GOOGLE_APPLICATION_CREDENTIALS_JSON or file path)")
             return None

        # Construct the full processor name
        processor_name = f"projects/{GOOGLE_PROJECT_ID}/locations/{GOOGLE_LOCATION}/processors/{GOOGLE_PROCESSOR_ID}"
        
        _document_ai_client = {
            "client": documentai.DocumentProcessorServiceClient(credentials=creds),
            "processor_name": processor_name
        }
        
        print(f"✅ Google Document AI initialized: {processor_name}")
        return _document_ai_client
        
    except Exception as e:
        print(f"❌ Failed to initialize Google Document AI: {str(e)}")
        return None


async def extract_text_google(file_bytes: bytes) -> Tuple[str, bool]:
    """
    Extract text from PDF using Google Document AI.
    
    Args:
        file_bytes: PDF file content as bytes
        
    Returns:
        (extracted_text, success_flag)
        - extracted_text: The extracted text or empty string on failure
        - success_flag: True if extraction succeeded, False otherwise
    """
    
    # Try to initialize client
    client_info = _initialize_client()
    
    if client_info is None:
        print("⚠️ Google Document AI not available - credentials missing")
        return "", False
    
    try:
        from google.cloud import documentai_v1 as documentai
        from google.api_core.exceptions import GoogleAPIError
        import asyncio
        
        # Prepare the document
        raw_document = documentai.RawDocument(
            content=file_bytes,
            mime_type="application/pdf"
        )
        
        # Configure the process request
        request = documentai.ProcessRequest(
            name=client_info["processor_name"],
            raw_document=raw_document
        )
        
        print("📄 Processing document with Google Document AI...")
        
        # Process with timeout protection (30 seconds)
        try:
            # Run in executor to avoid blocking
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    None, 
                    client_info["client"].process_document,
                    request
                ),
                timeout=30.0
            )
            
            # Extract text from result
            document = result.document
            extracted_text = document.text
            
            if not extracted_text or len(extracted_text.strip()) < 10:
                print("⚠️ Google Document AI returned insufficient text")
                return "", False
            
            print(f"✅ Google Document AI extracted {len(extracted_text)} characters")
            return extracted_text, True
            
        except asyncio.TimeoutError:
            print("❌ Google Document AI timeout (>30s)")
            return "", False
            
    except GoogleAPIError as e:
        print(f"❌ Google API Error: {str(e)}")
        return "", False
        
    except Exception as e:
        print(f"❌ Google Document AI Error: {str(e)}")
        return "", False


def is_google_ocr_available() -> bool:
    """Check if Google Document AI is properly configured."""
    return all([
        GOOGLE_PROJECT_ID,
        GOOGLE_LOCATION,
        GOOGLE_PROCESSOR_ID,
        GOOGLE_CREDENTIALS
    ])


if __name__ == "__main__":
    import asyncio
    
    print("="*60)
    print("GOOGLE DOCUMENT AI CONFIGURATION TEST")
    print("="*60)
    
    print(f"\nProject ID: {GOOGLE_PROJECT_ID or '❌ Missing'}")
    print(f"Location: {GOOGLE_LOCATION or '❌ Missing'}")
    print(f"Processor ID: {GOOGLE_PROCESSOR_ID or '❌ Missing'}")
    print(f"Credentials File: {GOOGLE_CREDENTIALS or '❌ Missing'}")
    
    if is_google_ocr_available():
        print("\n✅ All Google Document AI credentials present")
        
        # Try to initialize
        client = _initialize_client()
        if client:
            print("✅ Google Document AI client initialized successfully")
        else:
            print("❌ Failed to initialize client")
    else:
        print("\n⚠️ Google Document AI credentials incomplete")
        print("   Service will fallback to local PDF extraction")
