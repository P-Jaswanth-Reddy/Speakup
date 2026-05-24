"""
Local PDF Text Extractor for SpeakUp Platform
Provides fallback PDF text extraction using pdfplumber and PyPDF2.
Used when Google Document AI is unavailable or fails.
"""

import io
from typing import Optional


async def extract_text_local(file_bytes: bytes) -> str:
    """
    Extract text from PDF using local libraries (fallback method).
    
    Priority:
    1. pdfplumber (best for complex PDFs)
    2. PyPDF2 (fallback)
    3. Empty string (last resort)
    
    Args:
        file_bytes: PDF file content as bytes
        
    Returns:
        extracted_text: Best-effort text extraction, or empty string on complete failure
    """
    
    # Method 1: Try pdfplumber (best results)
    try:
        import pdfplumber
        
        print("📄 Attempting local extraction with pdfplumber...")
        
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            text_parts = []
            
            for page_num, page in enumerate(pdf.pages, 1):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                except Exception as e:
                    print(f"⚠️ pdfplumber failed on page {page_num}: {str(e)}")
                    continue
            
            if text_parts:
                extracted = "\n\n".join(text_parts)
                print(f"✅ pdfplumber extracted {len(extracted)} characters from {len(text_parts)} pages")
                return extracted
            else:
                print("⚠️ pdfplumber extracted no text")
                
    except Exception as e:
        print(f"❌ pdfplumber failed: {str(e)}")
    
    # Method 2: Try PyPDF2 (fallback)
    try:
        from PyPDF2 import PdfReader
        
        print("📄 Attempting fallback extraction with PyPDF2...")
        
        pdf_reader = PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        
        for page_num, page in enumerate(pdf_reader.pages, 1):
            try:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            except Exception as e:
                print(f"⚠️ PyPDF2 failed on page {page_num}: {str(e)}")
                continue
        
        if text_parts:
            extracted = "\n\n".join(text_parts)
            print(f"✅ PyPDF2 extracted {len(extracted)} characters from {len(text_parts)} pages")
            return extracted
        else:
            print("⚠️ PyPDF2 extracted no text")
            
    except Exception as e:
        print(f"❌ PyPDF2 failed: {str(e)}")
    
    # Last resort: return empty string (system will gracefully fail)
    print("❌ All local PDF extraction methods failed")
    return ""


async def extract_text_with_metadata(file_bytes: bytes) -> dict:
    """
    Extract text from PDF with metadata (page count, method used, etc.).
    
    Returns:
        {
            "text": str,
            "pages": int,
            "method": str ("pdfplumber" | "pypdf2" | "failed"),
            "success": bool
        }
    """
    
    # Try pdfplumber first
    try:
        import pdfplumber
        
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            text_parts = []
            page_count = len(pdf.pages)
            
            for page in pdf.pages:
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                except:
                    continue
            
            if text_parts:
                return {
                    "text": "\n\n".join(text_parts),
                    "pages": page_count,
                    "method": "pdfplumber",
                    "success": True
                }
    except:
        pass
    
    # Try PyPDF2 as fallback
    try:
        from PyPDF2 import PdfReader
        
        pdf_reader = PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        page_count = len(pdf_reader.pages)
        
        for page in pdf_reader.pages:
            try:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            except:
                continue
        
        if text_parts:
            return {
                "text": "\n\n".join(text_parts),
                "pages": page_count,
                "method": "pypdf2",
                "success": True
            }
    except:
        pass
    
    # Complete failure
    return {
        "text": "",
        "pages": 0,
        "method": "failed",
        "success": False
    }


if __name__ == "__main__":
    import asyncio
    
    print("="*60)
    print("LOCAL PDF EXTRACTOR TEST")
    print("="*60)
    
    # Test with a dummy PDF (just checks if libraries are importable)
    try:
        import pdfplumber
        print("✅ pdfplumber available")
    except ImportError:
        print("❌ pdfplumber not installed")
    
    try:
        from PyPDF2 import PdfReader
        print("✅ PyPDF2 available")
    except ImportError:
        print("❌ PyPDF2 not installed")
    
    print("\n📝 Local PDF extractor ready for fallback operations")
