from typing import Optional
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from firebase_config import firestore_client, verify_firebase_token, get_or_create_user
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

def verify_token(id_token: str) -> dict:
    """Verify Firebase ID token"""
    return verify_firebase_token(id_token)

def get_user(uid: str) -> Optional[dict]:
    """Get user by Firebase UID"""
    user_ref = firestore_client.collection('users').document(uid)
    user_doc = user_ref.get()
    
    if user_doc.exists:
        return user_doc.to_dict()
    return None

def update_user(uid: str, updates: dict) -> Optional[dict]:
    """Update user profile in Firestore"""
    user_ref = firestore_client.collection('users').document(uid)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        return None
    
    # Update allowed fields in metadata
    allowed_fields = ["name", "age", "gender", "occupation", "avatarUrl"]
    update_data = {}
    
    for field in allowed_fields:
        if field in updates and updates[field] is not None:
            update_data[field] = updates[field]
    
    if update_data:
        user_ref.update(update_data)
        return get_user(uid)
    
    return user_doc.to_dict()
