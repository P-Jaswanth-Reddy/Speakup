import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from firebase_config import firestore_client

def get_user_stats(userId: str):
    """Get user stats from Firestore (userId is now Firebase UID)"""
    
    # Query all collections for this user
    interview_docs = list(firestore_client.collection('interview_results').where('userId', '==', userId).stream())
    gd_docs = list(firestore_client.collection('gd_results').where('userId', '==', userId).stream())
    aptitude_docs = list(firestore_client.collection('aptitude_results').where('userId', '==', userId).stream())
    resume_docs = list(firestore_client.collection('resume_results').where('userId', '==', userId).stream())
    
    # Calculate averages
    avg_int = 0
    if interview_docs:
        total = sum([((doc.to_dict().get('communicationScore') or 0) + 
                      (doc.to_dict().get('confidenceScore') or 0) + 
                      (doc.to_dict().get('relevanceScore') or 0)) / 3 for doc in interview_docs])
        avg_int = int(total / len(interview_docs))
    
    avg_gd = 0
    if gd_docs:
        avg_gd = int(sum([(doc.to_dict().get('score') or 0) for doc in gd_docs]) / len(gd_docs))
    
    avg_apt = 0
    if aptitude_docs:
        avg_apt = int(sum([(doc.to_dict().get('score') or 0) for doc in aptitude_docs]) / len(aptitude_docs))
    
    # Recent Activity
    activity = []
    
    for doc in interview_docs:
        data = doc.to_dict()
        sc = int(((data.get('communicationScore') or 0) + (data.get('confidenceScore') or 0) + (data.get('relevanceScore') or 0)) / 3)
        activity.append({
            "type": "interview", 
            "date": data.get('createdAt'), 
            "score": sc, 
            "description": "Mock Interview"
        })
    
    for doc in gd_docs:
        data = doc.to_dict()
        activity.append({
            "type": "gd", 
            "date": data.get('createdAt'), 
            "score": data.get('score') or 0, 
            "description": f"GD: {data.get('topic', 'Unknown')}"
        })
    
    for doc in aptitude_docs:
        data = doc.to_dict()
        activity.append({
            "type": "aptitude", 
            "date": data.get('createdAt'), 
            "score": data.get('score') or 0, 
            "description": f"Aptitude: {data.get('topic', 'Unknown')}"
        })
    
    for doc in resume_docs:
        data = doc.to_dict()
        activity.append({
            "type": "resume", 
            "date": data.get('createdAt'), 
            "score": data.get('atsScore') or 0, 
            "description": "Resume Analysis"
        })
    
    # Sort by date
    def get_sort_key(x):
        d = x.get('date')
        if not d: return ''
        if hasattr(d, 'isoformat'):
            return d.isoformat()
        return str(d)
        
    activity.sort(key=get_sort_key, reverse=True)
    
    # Format dates and get top 3 (as requested)
    final_activity = []
    for item in activity[:3]:
        if hasattr(item['date'], 'isoformat'):
            item['date'] = item['date'].isoformat()
        elif item['date']:
            item['date'] = str(item['date'])
        final_activity.append(item)
    
    # Get user info from Firestore
    user_doc = firestore_client.collection('users').document(userId).get()
    user_data = user_doc.to_dict() if user_doc.exists else {"name": "User", "email": "user@example.com"}
    
    return {
        "user": {"name": user_data.get("name", "User"), "email": user_data.get("email", "user@example.com")},
        "stats": {
            "totalInterviews": len(interview_docs),
            "totalGdSessions": len(gd_docs),
            "totalAptitudeTests": len(aptitude_docs),
            "totalResumesAnalyzed": len(resume_docs),
            "averageInterviewScore": avg_int,
            "averageGdScore": avg_gd,
            "averageAptitudeScore": avg_apt
        },
        "recentActivity": final_activity
    }
