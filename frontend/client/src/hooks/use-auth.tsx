import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  User as FirebaseUser
} from "firebase/auth";
import { auth, googleProvider } from "@/firebase";
import { API_BASE_URL } from "@/lib/config";

// Auth user type based on Firebase
type AuthUser = {
  uid: string;  // Firebase UID
  email: string;
  name: string;
  photoURL: string | null;
  age?: number | null;
  gender?: string | null;
  occupation?: string | null;
  avatarUrl?: string | null;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // User is signed in - set basic info from Firebase IMMEDIATELY
        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          photoURL: firebaseUser.photoURL,
        };
        
        // Set user immediately for fast navigation
        setUser(authUser);
        setIsLoading(false);
        
        // Fetch additional metadata from backend in the background (non-blocking)
        (async () => {
          try {
            const token = await firebaseUser.getIdToken();
            const response = await fetch(`${API_BASE_URL}/api/users/${firebaseUser.uid}`, {
              headers: {
                "Authorization": `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              const userData = await response.json();
              // Merge backend data with Firebase data
              const metadata = userData.metadata || {};
              authUser.age = metadata.age || userData.age;
              authUser.gender = metadata.gender || userData.gender;
              authUser.occupation = metadata.occupation || userData.occupation;
              authUser.avatarUrl = metadata.avatarUrl || userData.avatarUrl;
              
              // Update user state with enriched metadata
              setUser({ ...authUser });
            }
          } catch (error) {
            console.log("Could not fetch user metadata:", error);
            // Continue with basic auth data - already set above
          }
        })();
      } else {
        // User is signed out
        setUser(null);
        setIsLoading(false);
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        toast({ 
          title: "Email not verified", 
          description: "Please verify your email before logging in. Check your inbox for the verification link.",
          variant: "destructive" 
        });
        throw new Error("Email not verified");
      }
      
      setLocation("/dashboard");
      toast({ title: "Welcome back!", description: "Logged in successfully" });
    } catch (error: any) {
      if (error.message !== "Email not verified") {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signupWithEmail = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name using Firebase updateProfile
      if (userCredential.user) {
        await firebaseUpdateProfile(userCredential.user, {
          displayName: name
        });
        
        // Send email verification
        await sendEmailVerification(userCredential.user);
        
        // Refresh user state
        await userCredential.user.reload();
      }
      
      // Don't navigate to dashboard immediately - show verification message
      toast({ 
        title: "Verification email sent!", 
        description: `Please check ${email} and verify your account before logging in.` 
      });
      
      // Log out the user so they must verify email first
      await signOut(auth);
      
    } catch (error: any) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      await signInWithPopup(auth, googleProvider);
      setLocation("/dashboard");
      toast({ title: "Welcome!", description: "Logged in with Google" });
    } catch (error: any) {
      toast({ title: "Google login failed", description: error.message, variant: "destructive" });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setLocation("/auth");
      toast({ title: "Logged out", description: "See you soon!" });
    } catch (error: any) {
      toast({ title: "Logout failed", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ 
        title: "Reset email sent", 
        description: `Password reset link sent to ${email}` 
      });
    } catch (error: any) {
      toast({ 
        title: "Reset failed", 
        description: error.message, 
        variant: "destructive" 
      });
      throw error;
    }
  };

  const resendVerification = async () => {
    if (!auth.currentUser) {
      toast({ title: "Error", description: "No user logged in", variant: "destructive" });
      return;
    }
    
    try {
      await sendEmailVerification(auth.currentUser);
      toast({ 
        title: "Verification email sent!", 
        description: "Please check your inbox and verify your email." 
      });
    } catch (error: any) {
      toast({ 
        title: "Failed to send", 
        description: error.message, 
        variant: "destructive" 
      });
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<AuthUser>) => {
    if (!user || !auth.currentUser) return;
    
    try {
      // Update backend via API
      const response = await fetch(`${API_BASE_URL}/api/users/${user.uid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        // Update local state
        setUser({ ...user, ...updates });
        toast({ title: "Profile updated", description: "Your changes have been saved." });
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error: any) {
      toast({ 
        title: "Update failed", 
        description: error.message, 
        variant: "destructive" 
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      loginWithEmail, 
      signupWithEmail, 
      loginWithGoogle, 
      logout, 
      resetPassword,
      resendVerification,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
