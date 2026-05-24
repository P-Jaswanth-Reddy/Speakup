import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useSubmitAptitudeTest, useAptitudeQuestions } from "@/hooks/use-api";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface Props {
  topic: string;
  questionCount: number;
  aiPowered: boolean;
  onExit: () => void;
}

export default function AptitudeQuiz({ topic, questionCount, aiPowered, onExit }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  
  const submitTest = useSubmitAptitudeTest();
  const { data: questionsData, isLoading, error } = useAptitudeQuestions(topic, questionCount, aiPowered);
  
  const questions = questionsData?.questions || [];

  const toggleExpanded = (idx: number) => {
    setExpandedQuestion(prev => prev === idx ? null : idx);
  };

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentIndex] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    if (!user) return;

    try {
      // Prepare answers array (filling gaps with null)
      const answersPayload = questions.map((_, i) => 
        selectedAnswers[i] !== undefined ? selectedAnswers[i] : null
      );
      
      const timeTaken = Math.round((Date.now() - startTime) / 1000);

      const result = await submitTest.mutateAsync({
        userId: user?.uid || "",
        topic,
        questions: questions,
        answers: answersPayload,
        timeTaken: timeTaken,
      });

      // Save result for the results page
      sessionStorage.setItem("aptitude_results", JSON.stringify(result));
      
      // Navigate to results
      setLocation("/aptitude/results");
      
    } catch (err: any) {
      toast({ title: "Failed to submit test", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !questionsData) {
    return (
        <Layout>
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <p className="text-destructive font-medium">Failed to load questions.</p>
                <Button onClick={onExit}>Go Back</Button>
            </div>
        </Layout>
    );
  }

  if (isFinished) {
    const correctCount = questions.reduce((acc, q, idx) => {
      return acc + (selectedAnswers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);
    const score = Math.round((correctCount / questions.length) * 100);

    return (
      <Layout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-card border rounded-2xl p-8 text-center space-y-6">
            <h2 className="text-2xl font-bold">Quiz Complete!</h2>
            
            <div className="w-48 h-48 mx-auto">
              <CircularProgressbar 
                value={score} 
                text={`${score}%`} 
                styles={buildStyles({
                  pathColor: score > 70 ? '#22c55e' : '#3b82f6',
                  textColor: '#1e293b',
                  trailColor: '#f1f5f9',
                })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-muted p-4 rounded-xl">
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Questions</p>
                <p className="text-2xl font-bold">{questions.length}</p>
              </div>
              <div className="bg-muted p-4 rounded-xl">
                <p className="text-xs text-muted-foreground uppercase font-bold">Correct Answers</p>
                <p className="text-2xl font-bold text-green-600">{correctCount}</p>
              </div>
            </div>
          </div>

          {/* Question Review - Accordion Style */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold px-2">Review Your Answers</h3>
            {questions.map((q: any, idx: number) => {
              const isCorrect = selectedAnswers[idx] === q.correctAnswer;
              const isExpanded = expandedQuestion === idx;
              
              return (
                <div 
                  key={idx} 
                  className={`bg-card border-2 rounded-xl overflow-hidden transition-all ${
                    isCorrect ? 'border-green-200' : 'border-red-200'
                  }`}
                >
                  {/* Collapsed Header - Single Line */}
                  <div 
                    onClick={() => toggleExpanded(idx)}
                    className="p-4 cursor-pointer hover:bg-muted/30 transition-colors flex items-center gap-3"
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        <span className="text-muted-foreground mr-2">Q{idx + 1}:</span>
                        {q.question}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t bg-muted/10">
                      {/* Question */}
                      <div className="p-4 pb-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Question</p>
                        <p className="text-sm font-medium">{q.question}</p>
                      </div>
                      
                      {/* Options */}
                      <div className="px-4 pb-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Options</p>
                        <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt: string, optIdx: number) => {
                            const isUserChoice = selectedAnswers[idx] === optIdx;
                            const isRightAnswer = q.correctAnswer === optIdx;
                            
                            return (
                              <div 
                                key={optIdx}
                                className={`text-sm px-3 py-2 rounded-lg flex items-center justify-between ${
                                  isRightAnswer 
                                    ? 'bg-green-100 text-green-800 font-medium border border-green-300' 
                                    : isUserChoice 
                                    ? 'bg-red-100 text-red-800 border border-red-300' 
                                    : 'bg-muted/50 text-muted-foreground'
                                }`}
                              >
                                <span>{opt}</span>
                                {isRightAnswer && <span className="text-green-700 font-bold">✓ Correct</span>}
                                {isUserChoice && !isRightAnswer && <span className="text-red-700 font-bold">✗ Your Answer</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Explanation */}
                      {q.explanation && (
                        <div className="px-4 pb-4 pt-2 border-t bg-blue-50/50">
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">💡 Explanation</p>
                          <p className="text-sm text-foreground leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4">
            <Button onClick={onExit} size="lg" className="w-full">Back to Topics</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold capitalize">{topic} Quiz</h2>
          <span className="text-sm font-medium bg-muted px-3 py-1 rounded-full">
            Question {currentIndex + 1} / {questions.length}
          </span>
        </div>

        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-xl font-medium mb-8 leading-relaxed">
            {currentQuestion.question}
          </h3>

          <div className="space-y-3">
            {currentQuestion.options.map((option: string, idx: number) => {
              const isSelected = selectedAnswers[currentIndex] === idx;
              return (
                <div
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-between ${
                    isSelected 
                      ? "border-primary bg-primary/5 shadow-md" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <span className={`font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {option}
                  </span>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4">
          <Button 
            variant="ghost" 
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
          >
            Previous
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={selectedAnswers[currentIndex] !== undefined} // Enabled only if NO answer selected
            >
              Skip
            </Button>
            <Button 
              onClick={handleNext} 
              disabled={selectedAnswers[currentIndex] === undefined} // Enabled only if answer IS selected
            >
              {currentIndex === questions.length - 1 ? (
                submitTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finish Quiz"
              ) : "Next Question"}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
