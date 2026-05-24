import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";

type Message = {
  role: 'bot' | 'user';
  text: string;
};

export default function MockInterview() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [config, setConfig] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [greetingPhase, setGreetingPhase] = useState(true);
  const [greetingSent, setGreetingSent] = useState(false);
  const [secsUntilAutoStart, setSecsUntilAutoStart] = useState(15);
  
  const tempScrollRef = useRef<HTMLDivElement>(null);
  const autoStartTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (tempScrollRef.current) {
      tempScrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const initSession = async () => {
      const saved = sessionStorage.getItem("interview_setup");
      if (saved && !sessionId) {
        const parsed = JSON.parse(saved);
        setConfig(parsed);

        try {
          setIsLoading(true);
          
          const res = await fetch(`${API_BASE_URL}/api/interview/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user?.uid || "",
              interviewType: parsed.interviewType,
              difficulty: parsed.difficulty,
              mode: parsed.mode,
              resumeData: null
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Failed to start interview");
          }

          const data = await res.json();
          setSessionId(data.sessionId);
          setIsLoading(false);
          
          startAutoStartTimer();
        } catch (err: any) {
          console.error("Start interview error:", err);
          toast({ 
            title: "Error starting interview", 
            description: err.message, 
            variant: "destructive" 
          });
          setIsLoading(false);
        }
      }
    };

    initSession();
    
    return () => {
      if (autoStartTimerRef.current) clearInterval(autoStartTimerRef.current);
    };
  }, [user]);

  const startAutoStartTimer = () => {
    let countdown = 15;
    setSecsUntilAutoStart(countdown);
    
    autoStartTimerRef.current = setInterval(() => {
      countdown--;
      setSecsUntilAutoStart(countdown);
      
      if (countdown <= 0) {
        if (autoStartTimerRef.current) clearInterval(autoStartTimerRef.current);
        handleAutoStart();
      }
    }, 1000);
  };

  const handleAutoStart = async () => {
    if (!sessionId || greetingSent) return;
    
    setGreetingPhase(false);
    if (autoStartTimerRef.current) clearInterval(autoStartTimerRef.current);
    
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/interview/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: user?.uid || "",
          message: "",
          action: "answer"
        })
      });

      const data = await res.json();
      if (data.firstQuestion) {
        setMessages([{ role: 'bot', text: data.firstQuestion }]);
        setProgress(0);
      }
      setIsLoading(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleGreeting = async () => {
    if (!input.trim() || !sessionId || greetingSent) return;
    
    const greetingMsg = input;
    setMessages([{ role: 'user', text: greetingMsg }]);
    setInput("");
    setGreetingSent(true);
    setGreetingPhase(false);
    
    if (autoStartTimerRef.current) clearInterval(autoStartTimerRef.current);

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/interview/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: user?.uid || "",
          message: greetingMsg,
          action: "greet"
        })
      });

      const data = await res.json();
      if (data.response) {
        setMessages(prev => [...prev, { role: 'bot', text: data.response }]);
      }
      
      if (data.firstQuestion) {
        setMessages(prev => [...prev, { role: 'bot', text: data.firstQuestion }]);
      }
      
      setProgress(data.progress || 0);
      setIsLoading(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!input.trim() || !sessionId || isLoading) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput("");

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/interview/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: user?.uid || "",
          message: userMsg,
          action: "answer"
        })
      });

      const data = await res.json();
      if (data.isComplete) {
        handleEnd();
      } else {
        if (data.acknowledgment) {
          setTimeout(() => {
            if (data.nextQuestion) {
              setMessages(prev => [...prev, { role: 'bot', text: data.nextQuestion }]);
            }
          }, 500);
        } else if (data.nextQuestion) {
          setMessages(prev => [...prev, { role: 'bot', text: data.nextQuestion }]);
        }
        
        setProgress(data.progress || progress);
      }
      setIsLoading(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/interview/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: user?.uid || ""
        })
      });

      const data = await res.json();
      sessionStorage.setItem("interview_results", JSON.stringify(data));
      window.location.href = "/interview/results";
    } catch (err: any) {
      toast({ title: "Error ending interview", description: err.message, variant: "destructive" });
    }
  };

  const handleSend = () => {
    if (greetingPhase && !greetingSent) {
      handleGreeting();
    } else {
      handleAnswer();
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-4rem)] flex flex-col px-4">
        <div className="mb-4 space-y-3">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Mock Interview</h1>
              {config && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {config.interviewType}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {config.difficulty} Level
                  </Badge>
                  <Badge variant={config.mode === "graded" ? "default" : "outline"}>
                    {config.mode === "graded" ? "Graded" : "Practice"}
                  </Badge>
                </div>
              )}
            </div>
            <Button variant="destructive" size="sm" onClick={handleEnd}>End Interview</Button>
          </div>
          
          {!greetingPhase && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-border/50">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {isLoading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating interview questions...
                </div>
              ) : (
                <>
                  {greetingPhase && !greetingSent && (
                    <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                        <div className="flex-1 space-y-2">
                          <p className="font-semibold text-sm">Greet the interviewer to start!</p>
                          <p className="text-xs text-muted-foreground">
                            Say "Good morning!" or a professional greeting to begin. 
                            You have <span className="font-bold text-primary">{secsUntilAutoStart}s</span> before auto-start.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'bot' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-muted text-foreground rounded-tl-none border'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isLoading && messages.length > 0 && (
                    <div className="flex gap-2 items-center text-muted-foreground text-[10px] pl-12 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      AI is processing...
                    </div>
                  )}
                </>
              )}
              <div ref={tempScrollRef} />
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-muted/30">
            <div className="flex gap-2">
              <Input 
                placeholder={greetingPhase ? "Greet the interviewer..." : "Type your answer..."} 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="bg-white shadow-sm"
                disabled={isLoading}
              />
              <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
