import os
import io
from typing import Optional
from dotenv import load_dotenv
from google.cloud import documentai_v1 as documentai

load_dotenv()

# Document AI Configuration
PROJECT_ID = os.getenv("DOCUMENTAI_PROJECT_ID")
LOCATION = os.getenv("DOCUMENTAI_LOCATION", "us")  # Default to 'us'
PROCESSOR_ID = os.getenv("DOCUMENTAI_PROCESSOR_ID")

# Verify credentials
GOOGLE_CREDS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if GOOGLE_CREDS and not os.path.exists(GOOGLE_CREDS):
    print(f"❌ WARNING: GOOGLE_APPLICATION_CREDENTIALS path does not exist: {GOOGLE_CREDS}")

def extract_resume_text_local(file_bytes: bytes) -> Optional[str]:
    """
    Attempt local PDF text extraction using pypdf
    
    Args:
        file_bytes: PDF file content
        
    Returns:
        Extracted text or None if failed
    """
    try:
        from pypdf import PdfReader
        
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        
        full_text = "\n\n".join(text_parts).strip()
        
        if len(full_text) >= 200:  # Minimum threshold for valid resume
            print(f"✅ Local extraction successful ({len(full_text)} characters)")
            return full_text
        else:
            print(f"⚠️ Local extraction too short ({len(full_text)} chars), will try Document AI")
            return None
            
    except Exception as e:
        print(f"⚠️ Local PDF extraction failed: {str(e)}")
        return None

def extract_resume_text_documentai(file_bytes: bytes, mime_type: str = "application/pdf") -> Optional[str]:
    """
    Extract text from PDF using Google Document AI OCR
    
    Args:
        file_bytes: PDF file content
        mime_type: MIME type of document
        
    Returns:
        Extracted text or None if failed
    """
    if not all([PROJECT_ID, LOCATION, PROCESSOR_ID]):
        print("❌ Document AI not configured. Missing env vars: PROJECT_ID, LOCATION, or PROCESSOR_ID")
        return None
    
    try:
        # Initialize Document AI client
        opts = {"api_endpoint": f"{LOCATION}-documentai.googleapis.com"}
        
        credentials = None
        
        # Check if GOOGLE_APPLICATION_CREDENTIALS is set
        if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            # Standard auto-discovery
            pass
        elif os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
            # Use the same credentials as Firebase
            try:
                from google.oauth2 import service_account
                import json
                
                info = json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
                credentials = service_account.Credentials.from_service_account_info(info)
                print("✅ Using Document AI credentials from FIREBASE_SERVICE_ACCOUNT_JSON")
            except Exception as e:
                print(f"⚠️ Failed to create credentials from JSON: {e}")

        client = documentai.DocumentProcessorServiceClient(client_options=opts, credentials=credentials)
        
        # Full processor name
        name = client.processor_path(PROJECT_ID, LOCATION, PROCESSOR_ID)
        
        # Create document object
        raw_document = documentai.RawDocument(content=file_bytes, mime_type=mime_type)
        
        # Process the document
        request = documentai.ProcessRequest(name=name, raw_document=raw_document)
        result = client.process_document(request=request)
        
        # Extract text
        document = result.document
        text = document.text
        
        print(f"✅ Document AI extraction successful ({len(text)} characters)")
        return text
        
    except Exception as e:
        print(f"❌ Document AI extraction failed: {str(e)}")
        return None

def extract_resume_text(file_bytes: bytes) -> str:
    """
    Hybrid approach: Try local extraction first, fallback to Document AI
    
    Args:
        file_bytes: PDF file content
        
    Returns:
        Extracted text (never None, returns error message if all methods fail)
    """
    # Step 1: Try local extraction (fast, free)
    text = extract_resume_text_local(file_bytes)
    
    if text and len(text) >= 200:
        return text
    
    # Step 2: Fallback to Document AI (more reliable for scanned PDFs)
    print("📄 Using Document AI OCR for better extraction...")
    text = extract_resume_text_documentai(file_bytes)
    
    if text:
        return text
    
    # Step 3: Complete failure
    error_msg = "Unable to extract text from PDF. Please ensure the file is a valid, text-based PDF."
    print(f"❌ {error_msg}")
    return error_msg
