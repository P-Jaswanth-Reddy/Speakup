import os
import json
import firebase_admin
from firebase_admin import credentials, auth, firestore

# Initialize Firebase Admin SDK
def initialize_firebase():
    """Initialize Firebase Admin SDK with service account (Env Var or File)"""
    try:
        # Check if already initialized
        firebase_admin.get_app()
        print("✅ Firebase already initialized")
    except ValueError:
        cred = None
        
        # 1. Try Environment Variable (for Render/Production)
        env_creds = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if env_creds:
            try:
                # Parse JSON string from env var
                cred_dict = json.loads(env_creds)
                cred = credentials.Certificate(cred_dict)
                print("✅ Loaded Firebase credentials from environment variable")
            except Exception as e:
                print(f"⚠️ Found FIREBASE_SERVICE_ACCOUNT_JSON but failed to parse: {e}")
        
        # 2. Try Local File (fallback for local dev)
        if not cred:
            service_account_path = os.path.join(
                os.path.dirname(__file__), 
                "firebase-service-account.json"
            )
            
            if os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                print(f"✅ Loaded Firebase credentials from local file: {service_account_path}")
            else:
                # If neither env var nor file exists, we can't start
                if not env_creds:
                    raise FileNotFoundError(
                        "Firebase credentials missing! Set FIREBASE_SERVICE_ACCOUNT_JSON env var or add firebase-service-account.json file."
                    )

        # Initialize
        if cred:
            firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin SDK initialized successfully")

# Initialize on module import
initialize_firebase()

# Export Firebase clients
auth_client = auth
firestore_client = firestore.client()

def verify_firebase_token(id_token: str):
    """
    Verify Firebase ID token and return decoded token
    
    Args:
        id_token: Firebase ID token from Authorization header
        
    Returns:
        dict: Decoded token with uid, email, etc.
        
    Raises:
        Exception: If token is invalid
    """
    try:
        decoded_token = auth_client.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        raise Exception(f"Invalid token: {str(e)}")

def get_or_create_user(uid: str, email: str, name: str = None):
    """
    Get or create user document in Firestore
    
    Args:
        uid: Firebase user ID
        email: User email
        name: User display name
        
    Returns:
        dict: User document
    """
    user_ref = firestore_client.collection('users').document(uid)
    user_doc = user_ref.get()
    
    if user_doc.exists:
        return user_doc.to_dict()
    else:
        # Create new user document
        user_data = {
            'uid': uid,
            'email': email,
            'name': name or email.split('@')[0],
            'createdAt': firestore.SERVER_TIMESTAMP,
            'age': None,
            'gender': None,
            'occupation': None,
            'avatarUrl': None
        }
        user_ref.set(user_data)
        return user_data
