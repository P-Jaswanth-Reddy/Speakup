import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Clock, Send, MessageSquareText, ShieldAlert, Pause, Play, Loader2, ListTodo, Brain, Mic, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useStartGD, useSendGDMessage, useGDFeedback, useEndGD, useCreateGdResult } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import GDResult from "./GDResult"; // Import the result component
import { GDEndResponse } from "@/types/api-types";

type Chat = {
  speaker: string;
  text: string;
  isUser: boolean;
  timestamp: string;
};

type BotProfile = {
  name: string;
  role: string;
  description: string;
};

type SessionPhase = 'prep' | 'discussion' | 'conclusion' | 'result'; // Added result phase

export default function GDSimulator() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // API Mutations
  const startGD = useStartGD();
  const sendMessage = useSendGDMessage();
  const endGD = useEndGD();
  const createGdResult = useCreateGdResult();

  // Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<{topic: string, difficulty: string, duration: number} | null>(null);
  const [phase, setPhase] = useState<SessionPhase>('prep');
  const [result, setResult] = useState<GDEndResponse | null>(null); // State for result
  const [isActive, setIsActive] = useState(true);
  
  // Timers
  const [prepTime, setPrepTime] = useState(60);
  const [timeLeft, setTimeLeft] = useState(600);
  const [totalDuration, setTotalDuration] = useState(600);
  
  // Chat State
  const [chats, setChats] = useState<Chat[]>([]);
  const [input, setInput] = useState("");
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [nextSpeaker, setNextSpeaker] = useState<string>("any");
  
  // Turn Management
  const [turnCounts, setTurnCounts] = useState<Record<string, number>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [pauseCount, setPauseCount] = useState(0);

  // Auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chats]);

  /* State Refs for Async Access */
  const phaseRef = useRef(phase);
  const inputRef = useRef(input);
  const isPausedRef = useRef(isPaused);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { inputRef.current = input; }, [input]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // Init Session
  useEffect(() => {
    const initSession = async () => {
      // FIX: Changed from 'gd_config' to 'gd_setup' to match GDSetup.tsx
      const saved = sessionStorage.getItem("gd_setup");
      if (saved && !sessionId) {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        setTotalDuration(parsed.duration || 600);
        setTimeLeft(parsed.duration || 600);
        
        try {
          const res = await startGD.mutateAsync({
            userId: user?.uid || "",
            topic: parsed.topic,
            difficulty: parsed.difficulty,
            duration: parsed.duration || 600
          });
          
          setSessionId(res.sessionId);
          setBots(res.bots.map(b => ({
             name: b.name,
             role: "Participant", 
             description: b.personality
          })));
        } catch (err: any) {
             toast({ title: "Failed to start GD", description: err.message, variant: "destructive" });
        }
      }
    };
    initSession();
  }, [user]);

  const handleStartDiscussion = () => {
    setPhase('discussion');
    setChats([
        { 
            speaker: "Moderator", 
            text: `Topic: "${config?.topic}". You may begin. User, you have the first 20 seconds to take the lead!`, 
            isUser: false,
            timestamp: new Date().toISOString()
        }
    ]);
    startSilenceTimer(); // Start timer immediately when discussion begins
  };

  // Prep Timer
  useEffect(() => {
    if (phase === 'prep' && prepTime > 0) {
      const timer = setInterval(() => setPrepTime(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (phase === 'prep' && prepTime === 0) {
      handleStartDiscussion();
    }
  }, [phase, prepTime]);

  // Discussion Timer
  useEffect(() => {
    if (phase === 'discussion' && !isPaused && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && phase === 'discussion') {
        toast({ title: "Time's Up!", description: "Session concluding automatically." });
        handleEnd(); // Auto-end session when time hits 0
    }
  }, [phase, isPaused, timeLeft]);

  /* Sequential Bot Message Handler */
  const processBotMessages = async (messages: NonNullable<NonNullable<typeof chats>[0]>[], nextSpeakerHint?: string) => {
    if (messages.length === 0) return;

    for (const msg of messages) {
       // Set specific typing indicator
       setNextSpeaker(msg.speaker);
       
       // Calculate dynamic delay based on message length (min 4s, max 10s)
       // Slows down the chat flow significantly
       const delay = Math.min(Math.max(msg.text.length * 60, 4000), 10000);
       
       await new Promise(resolve => setTimeout(resolve, delay));
       
       setChats(prev => [...prev, { 
           speaker: msg.speaker, 
           text: msg.text, 
           isUser: false,
           timestamp: msg.timestamp 
       }]);
    }
    setNextSpeaker("any"); // Reset after chain
    startSilenceTimer(nextSpeakerHint); // Start timer with hint
  };

  /* Silence Timer Logic */
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startSilenceTimer = (nextSpeakerHint?: string) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      
      let duration;
      if (nextSpeakerHint === 'user') {
          // USER REQUEST: If a bot responded to user (handoff), remove silence breaker.
          // We return here, effectively waiting INDEFINITELY for the user.
          return; 
      } else {
          // Random duration between 12000ms (12s) and 20000ms (20s)
          duration = Math.floor(Math.random() * 8000) + 12000;
      }
      
      silenceTimerRef.current = setTimeout(() => {
          // Use refs to check CURRENT state, preventing stale closure issues
          if (!inputRef.current.trim() && !isPausedRef.current && phaseRef.current === 'discussion') {
               handleSilenceBreak();
          }
      }, duration);
  };

  const handleSilenceBreak = async () => {
      if (!sessionId || sendMessage.isPending) return;
      try {
          const res = await sendMessage.mutateAsync({
              sessionId,
              userId: user?.uid || "",
              message: "",
              action: "silence_break"
          });
          
          setTurnCounts(res.turnCounts);
          setTimeLeft(res.timeRemaining);
          
          if (res.botMessages && res.botMessages.length > 0) {
            const formattedMessages = res.botMessages.map(m => ({
                speaker: m.speaker,
                text: m.text,
                isUser: false,
                timestamp: m.timestamp
            }));
            await processBotMessages(formattedMessages, res.nextSpeaker);
          }
      } catch (err) {
          console.error("Silence break failed", err);
      }
  };

  // Reset timer on user interaction
  useEffect(() => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      // We don't restart it here; it only restarts after bots speak
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || sendMessage.isPending || isPaused) return;
    
    const userText = input;
    // Optimistic UI update
    setChats(prev => [...prev, { speaker: "You", text: userText, isUser: true, timestamp: new Date().toISOString() }]);
    setInput("");
    
    try {
      const res = await sendMessage.mutateAsync({
        sessionId,
        userId: user?.uid || "",
        message: userText,
        action: "speak"
      });
      
      setTurnCounts(res.turnCounts);
      setTimeLeft(res.timeRemaining);

      if (res.shouldEndSession) {
          handleEnd();
          return; 
      }
      
      // Handle the new list of bot messages
      if (res.botMessages && res.botMessages.length > 0) {
        const formattedMessages = res.botMessages.map(m => ({
            speaker: m.speaker,
            text: m.text,
            isUser: false,
            timestamp: m.timestamp
        }));
        await processBotMessages(formattedMessages, res.nextSpeaker);
      }
    } catch (err: any) {
      toast({ title: "Error talking to bots", description: err.message, variant: "destructive" });
    }
  };

  const togglePause = async () => {
    if (!sessionId) return;
    
    if (!isPaused) {
        try {
            const res = await sendMessage.mutateAsync({
                sessionId,
                userId: user?.uid || "",
                message: "",
                action: "pause"
            });
            setIsPaused(true);
            setPauseCount(res.pauseCount || pauseCount + 1);
            toast({ title: "Session Paused", description: "This will affect your final score.", variant: "destructive" });
        } catch(err) {
            console.error(err);
        }
    } else {
        setIsPaused(false);
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    setIsActive(false);
    setPhase('conclusion');
    
    try {
        const res = await endGD.mutateAsync({
            sessionId,
            userId: user?.uid || "",
            userMessages: []
        });
        
        // Save result
        await createGdResult.mutateAsync({
            userId: user?.uid || "",
            topic: config?.topic || "Unknown",
            score: res.overallScore,
            duration: totalDuration - timeLeft
        });

        // Set result state for inline rendering
        setResult(res);
        setPhase('result');
        
    } catch (err: any) {
        toast({ title: "Error ending session", description: err.message, variant: "destructive" });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (phase === 'result' && result) {
      return <GDResult result={result} />;
  }

  if (phase === 'prep') {
    return (
        <Layout>
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
                <Card className="w-full max-w-2xl text-center p-8 space-y-6 shadow-lg border-2">
                    <div className="space-y-4">
                        <Badge variant="outline" className="text-secondary-foreground uppercase tracking-widest text-xs px-3 py-1">Preparation Phase</Badge>
                        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent pb-1">
                            {config?.topic || "Loading..."}
                        </h1>
                        <p className="text-muted-foreground text-lg">Take a moment to gather your arguments.</p>
                    </div>
                    
                    <div className="flex justify-center py-6">
                        <div className="relative flex items-center justify-center w-48 h-48 rounded-full border-8 border-muted bg-white shadow-inner">
                            <div className="text-5xl font-mono font-bold text-slate-800">{prepTime}s</div>
                            <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle 
                                    className="text-primary transition-all duration-1000 ease-linear" 
                                    strokeWidth="4" 
                                    stroke="currentColor" 
                                    fill="transparent" 
                                    r="46" 
                                    cx="50" 
                                    cy="50"
                                    strokeDasharray="289"
                                    strokeDashoffset={289 * (1 - prepTime / 60)}
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                    </div>

                    <div className="max-w-md mx-auto space-y-4">
                        <Button size="lg" className="w-full text-lg font-bold h-14 shadow-md hover:shadow-lg transition-all gap-2" onClick={handleStartDiscussion}>
                            <Brain className="w-6 h-6" />
                            Start Discussion Now
                        </Button>
                        <p className="text-xs text-muted-foreground w-full">Topic difficulty: {config?.difficulty}</p>
                    </div>
                </Card>
            </div>
        </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col gap-4 px-4 py-4">
        
        {/* Header Controller */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border shadow-sm gap-4 transition-all">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full transition-colors ${isPaused ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    <Users className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="font-bold tracking-tight text-lg leading-none mb-1 text-slate-800">{config?.topic}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Badge variant="outline" className="text-[10px] h-5 capitalize">{config?.difficulty}</Badge>
                        <span>•</span>
                        <span>{bots.length + 1} Participants</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto bg-slate-50 p-1.5 rounded-lg border">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono font-bold min-w-[80px] justify-center transition-colors ${
                    timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-white text-slate-700 shadow-sm border'
                }`}>
                    <Clock className="w-4 h-4" />
                    {formatTime(timeLeft)}
                </div>
                
                <div className="h-5 w-px bg-slate-200 mx-1" />
                
                <Button variant={isPaused ? "default" : "secondary"} size="icon" className={`h-9 w-9 ${isPaused ? 'bg-green-600 hover:bg-green-700' : ''}`} onClick={togglePause}>
                    {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                </Button>
                
                <Button variant="destructive" size="sm" onClick={handleEnd} className="h-9 text-xs font-bold px-4 shadow-sm">
                    End Session
                </Button>
            </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            
            {/* Chat Area */}
            <div className="lg:col-span-9 bg-white border rounded-2xl flex flex-col overflow-hidden shadow-sm">
                <ScrollArea className="flex-1 p-6 bg-slate-50/30">
                    <div className="space-y-6">
                        {chats.map((chat, i) => (
                            <div key={i} className={`flex gap-4 ${chat.isUser ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border ring-2 ring-start-2 ${
                                    chat.isUser ? 'bg-primary text-primary-foreground border-primary ring-blue-50' : 
                                    chat.speaker === "Moderator" ? 'bg-slate-800 text-white ring-slate-100' : 'bg-white text-slate-700 ring-white'
                                }`}>
                                    {chat.speaker[0]}
                                </div>
                                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                                    chat.isUser 
                                        ? 'bg-blue-600 text-white rounded-tr-none' 
                                        : chat.speaker === "Moderator"
                                            ? 'bg-slate-100 text-slate-800 border-l-4 border-slate-700 italic rounded-tl-none'
                                            : 'bg-white text-slate-800 border rounded-tl-none'
                                }`}>
                                    <div className="flex justify-between items-center gap-4 mb-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                            chat.isUser ? 'text-blue-100' : 'text-slate-500'
                                        }`}>
                                            {chat.speaker}
                                        </span>
                                        <span className={`text-[10px] ${chat.isUser ? 'text-blue-200' : 'text-slate-400'}`}>
                                            {new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{chat.text}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
                
                {/* Input Area */}
                <div className="p-4 bg-white border-t space-y-3 z-10">
                   {/* Typing/Status Indicator */}
                   <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 h-5">
                        {isPaused ? (
                            <span className="flex items-center gap-1.5 text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full">
                                <Pause className="w-3 h-3" /> Session Paused
                            </span>
                        ) : sendMessage.isPending ? (
                            <span className="flex items-center gap-1.5 text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" /> {nextSpeaker !== "user" && nextSpeaker !== "any" ? `${nextSpeaker} is typing...` : "AI thinking..."}
                            </span>
                        ) : nextSpeaker === "user" ? (
                            <span className="flex items-center gap-1.5 text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full animate-bounce">
                                <Mic className="w-3 h-3" /> It's your turn to speak!
                            </span>
                        ) : null}
                   </div>

                   <div className="flex gap-3 relative">
                        <Input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={isPaused ? "Resume session to type..." : "Type your arguments here..."}
                            disabled={isPaused || sendMessage.isPending}
                            className="h-12 pl-4 pr-12 shadow-sm bg-slate-50 focus:bg-white transition-all border-slate-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                        />
                        <Button 
                            onClick={handleSend} 
                            disabled={isPaused || sendMessage.isPending || !input.trim()}
                            size="icon" 
                            className="h-12 w-12 shrink-0 shadow-md bg-blue-600 hover:bg-blue-700 transition-all rounded-lg"
                        >
                            {sendMessage.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
                        </Button>
                   </div>
                </div>
            </div>

            {/* Sidebar Stats */}
            <div className="lg:col-span-3 flex flex-col gap-6">
                
                {/* Participants Card (REDESIGNED) */}
                <Card className="shadow-sm border-none bg-slate-50">
                    <CardContent className="p-5 space-y-5">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Discussion Flow</h3>
                            <ListTodo className="w-4 h-4 text-slate-400" />
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-[10px] text-muted-foreground leading-tight">
                                This shows the "Share of VOice". Aim for balanced participation!
                            </p>
                            
                            {/* User */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span>You ({user?.name || "User"})</span>
                                    </div>
                                    <span className="bg-white border px-2 py-0.5 rounded-full text-[10px]">{turnCounts['user'] || 0} turns</span>
                                </div>
                            </div>

                            {/* Bots */}
                            {bots.map(bot => (
                                <div key={bot.name} className="space-y-1.5">
                                    <div className="flex justify-between items-center text-xs font-medium text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                            <span>{bot.name} <span className="text-[10px] opacity-70 font-normal">({bot.description})</span></span>
                                        </div>
                                        <span className="bg-white border px-2 py-0.5 rounded-full text-[10px]">{turnCounts[bot.name.toLowerCase()] || 0} turns</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Info Card */}
                 <Card className="shadow-sm border-none bg-blue-50/80">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                           <Brain className="w-4 h-4" /> Speaking Tips
                        </div>
                        <ul className="text-xs text-blue-700/90 space-y-2 list-disc pl-4 leading-relaxed">
                            <li><strong>Acknowledge</strong> previous speakers before adding your point.</li>
                            <li>Use <strong>"I agree/disagree because..."</strong> structure.</li>
                            <li><strong>Invite others</strong> to speak if the conversation stalls.</li>
                        </ul>
                    </CardContent>
                 </Card>

                 {pauseCount > 0 && (
                     <Card className="shadow-sm border border-orange-200 bg-orange-50 animate-in fade-in slide-in-from-right-4">
                        <CardContent className="p-4 flex items-start gap-3">
                            <Scale className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-orange-800">Score Penalty Active</p>
                                <p className="text-[10px] text-orange-700 leading-tight mt-1">
                                    You have paused <strong>{pauseCount} times</strong>. Each pause deducts points from your final score.
                                </p>
                            </div>
                        </CardContent>
                     </Card>
                 )}
            </div>
        </div>
      </div>
    </Layout>
  );
}
