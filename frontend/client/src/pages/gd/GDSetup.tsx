import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Sparkles, Dice5, Target, Timer } from "lucide-react";

const TOPICS = [
  "Impact of AI on Job Security", 
  "Privatization of Education: Pros and Cons", 
  "Ethics of Space Exploration", 
  "Social Media and Mental Health", 
  "Cryptocurrency: The Future of Money?"
];

export default function GDSetup() {
  const [, setLocation] = useLocation();
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [duration, setDuration] = useState("600");

  const generateRandomTopic = () => {
    const random = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    setTopic(random);
  };

  const handleStart = () => {
    if (!topic.trim()) return;
    
    sessionStorage.setItem("gd_setup", JSON.stringify({ 
      topic, 
      difficulty,
      duration: parseInt(duration) 
    }));
    
    setLocation("/gd/session");
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8 py-8 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Group Discussion Setup</h1>
          <p className="text-muted-foreground">Choose a topic and settings to simulate a realistic discussion.</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Session Configuration
            </CardTitle>
            <CardDescription>Configure your GD environment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Topic Section */}
            <div className="space-y-3">
              <Label htmlFor="topic" className="font-semibold">GD Topic</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="topic"
                  placeholder="Enter GD Topic (e.g., Remote Work)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="flex-1 shadow-sm"
                />
                <Button variant="outline" onClick={generateRandomTopic} className="shrink-0 gap-2 font-medium">
                  <Dice5 className="w-4 h-4" />
                  Random Topic
                </Button>
              </div>
            </div>

            {/* Duration Section */}
            <div className="space-y-3">
              <Label className="font-semibold flex items-center gap-2">
                <Timer className="w-4 h-4" />
                Session Duration
              </Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="shadow-sm">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="600">10 Minutes (Standard)</SelectItem>
                  <SelectItem value="720">12 Minutes (Extended)</SelectItem>
                  <SelectItem value="900">15 Minutes (Comprehensive)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty Section */}
            <div className="space-y-4">
              <Label className="font-semibold">Difficulty Selection</Label>
              <RadioGroup value={difficulty} onValueChange={setDifficulty} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {['easy', 'medium', 'hard'].map((level) => (
                  <div key={level}>
                    <RadioGroupItem value={level} id={`level-${level}`} className="peer sr-only" />
                    <Label
                      htmlFor={`level-${level}`}
                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary transition-all cursor-pointer shadow-sm h-full"
                    >
                      <Target className={`w-5 h-5 mb-2 ${
                        level === 'easy' ? 'text-green-500' : 
                        level === 'medium' ? 'text-blue-500' : 'text-red-500'
                      }`} />
                      <span className="capitalize font-bold text-sm tracking-tight">{level}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Button 
              className="w-full h-12 text-base font-bold shadow-md hover:shadow-lg transition-all gap-2 mt-4" 
              onClick={handleStart} 
              disabled={!topic.trim()}
            >
              <Sparkles className="w-4 h-4" />
              Start Session
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
