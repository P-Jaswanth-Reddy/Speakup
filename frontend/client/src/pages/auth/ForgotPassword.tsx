import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import logoSvg from "@/assets/logo.svg";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    try {
      await resetPassword(email);
      setEmailSent(true);
    } catch (error) {
      // Error handled in useAuth
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4">
            <img src={logoSvg} alt="SpeakUp Logo" className="w-full h-full" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Reset Password</h1>
          <p className="text-muted-foreground mt-2">
            {emailSent ? "Check your email" : "Enter your email to reset password"}
          </p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle>{emailSent ? "Email Sent!" : "Forgot Password?"}</CardTitle>
            <CardDescription>
              {emailSent 
                ? "We've sent a password reset link to your email address."
                : "No worries, we'll send you reset instructions."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    Password reset email sent to <strong>{email}</strong>
                  </p>
                  <p className="text-xs text-green-700 mt-2">
                    Please check your inbox and click the link to reset your password.
                  </p>
                </div>
                
                <div className="text-center text-sm text-muted-foreground">
                  Didn't receive the email?{" "}
                  <button
                    onClick={() => setEmailSent(false)}
                    className="text-primary font-semibold hover:underline"
                  >
                    Try again
                  </button>
                </div>

                <Link href="/auth">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 font-semibold text-base"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Send Reset Link
                </Button>

                <Link href="/auth">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
