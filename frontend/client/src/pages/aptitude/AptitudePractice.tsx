import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Calculator, BrainCircuit, BookOpen, Sparkles, Zap } from "lucide-react";
import AptitudeQuiz from "./AptitudeQuiz";

const TOPICS = [
  { id: "quantitative", label: "Quantitative Aptitude", icon: Calculator, desc: "Numbers, algebra, and math problems" },
  { id: "logical", label: "Logical Reasoning", icon: BrainCircuit, desc: "Patterns, sequences, and logic puzzles" },
  { id: "verbal", label: "Verbal Ability", icon: BookOpen, desc: "Grammar, vocabulary, and comprehension" },
];

export default function AptitudePractice() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [isAIPowered, setIsAIPowered] = useState(false);

  if (selectedTopic) {
    return (
      <AptitudeQuiz 
        topic={selectedTopic} 
        questionCount={isAIPowered ? 3 : questionCount}
        aiPowered={isAIPowered}
        onExit={() => {
          setSelectedTopic(null);
          setIsAIPowered(false);
        }} 
      />
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-display font-bold tracking-tight">Aptitude Practice</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Choose your practice mode: Regular tests with customizable questions or AI-powered challenge tests.
          </p>
        </div>

        {/* AI-Powered Test Hero Card */}
        <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-purple-50 to-blue-50 hover:border-primary/40 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
          <CardContent className="p-8 relative">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                  <h2 className="text-2xl font-bold">AI-Powered Challenge Test</h2>
                  <span className="px-2 py-0.5 bg-primary text-white text-xs font-bold rounded-full uppercase">New</span>
                </div>
                <p className="text-muted-foreground">
                  3 challenging questions on your selected topic
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 md:gap-2 w-full md:w-auto">
                {TOPICS.map((topic) => (
                  <Button
                    key={topic.id}
                    onClick={() => {
                      setSelectedTopic(topic.id);
                      setIsAIPowered(true);
                    }}
                    className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-gradient-to-br from-primary to-purple-600 hover:from-primary/90 hover:to-purple-500 shadow-lg"
                  >
                    <topic.icon className="w-6 h-6" />
                    <span className="text-xs font-bold leading-tight text-center">{topic.label.split(' ')[0]}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regular Practice Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <h3 className="text-xl font-bold">Regular Practice Mode</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Questions:</span>
              <span className="text-xl font-bold text-primary min-w-[3ch] text-center">{questionCount}</span>
              <Slider
                value={[questionCount]}
                onValueChange={(value) => setQuestionCount(value[0])}
                min={10}
                max={30}
                step={1}
                className="w-44"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TOPICS.map((topic) => (
              <Card 
                key={topic.id}
                className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => {
                  setSelectedTopic(topic.id);
                  setIsAIPowered(false);
                }}
              >
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <topic.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{topic.label}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{topic.desc}</p>
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    Start {questionCount} Questions
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
