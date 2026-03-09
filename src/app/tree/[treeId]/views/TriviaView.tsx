'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Trophy, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { Person, Relationship } from '@/lib/types';
import Confetti from 'react-confetti';
import { generateTrivia } from '@/ai/flows/trivia-generation-flow';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


type GameState = 'setup' | 'loading' | 'playing' | 'results';
type Difficulty = 'קל' | 'בינוני' | 'קשה' | 'מעורב';
type Topic = 'קשרי משפחה' | 'תאריכים' | 'מקומות' | 'סטטיסטיקות' | 'סיפורי חיים' | 'כללי';

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
}

const TOPICS_CONFIG: { id: Topic, label: string, icon: string }[] = [
    { id: 'קשרי משפחה', label: 'קשרי משפחה', icon: '👨‍👩‍👧' },
    { id: 'תאריכים', label: 'תאריכים', icon: '📅' },
    { id: 'מקומות', label: 'מקומות', icon: '📍' },
    { id: 'סטטיסטיקות', label: 'סטטיסטיקות', icon: '🔢' },
    { id: 'סיפורי חיים', label: 'סיפורי חיים', icon: '📖' },
    { id: 'כללי', label: 'כללי', icon: '🧩' },
];

const TIMER_DURATIONS: Record<Difficulty, number> = {
    'קל': 30,
    'בינוני': 20,
    'קשה': 10,
    'מעורב': 20
};

interface TriviaViewProps {
  people: Person[];
  relationships: Relationship[];
  setViewMode: (mode: 'tree' | 'trivia') => void;
}

export function TriviaView({ people, relationships, setViewMode }: TriviaViewProps) {
  const [gameState, setGameState] = useState<GameState>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('בינוני');
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>(['קשרי משפחה', 'תאריכים']);
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [timer, setTimer] = useState(20);
  const [answered, setAnswered] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const { toast } = useToast();
  
  const canUseLifeStories = useMemo(() => people.filter(p => p.description && p.description.length > 10).length >= 5, [people]);
  
  const handleTopicChange = (topic: Topic) => {
    setSelectedTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
  };

  const startGame = async () => {
    setGameState('loading');
    const peopleWithDescriptions = people.map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        deathDate: p.deathDate,
        birthPlace: p.birthPlace,
        countryOfResidence: p.countryOfResidence,
        cityOfResidence: p.cityOfResidence,
        gender: p.gender,
        status: p.status,
        religion: p.religion,
        description: p.description || null,
      }));

    try {
        const generatedQuestions = await generateTrivia({
            familyData: { people: peopleWithDescriptions, relationships },
            questionCount,
            difficulty,
            topics: selectedTopics,
        });
        setQuestions(generatedQuestions);
        setGameState('playing');
        setCurrentQuestionIndex(0);
        setScore(0);
        setUserAnswers([]);
        setAnswered(null);
    } catch (error) {
        console.error("Error generating trivia:", error);
        toast({
            variant: 'destructive',
            title: 'שגיאה ביצירת הטריוויה',
            description: 'לא הצלחנו לייצר שאלות. נסו שוב מאוחר יותר.'
        });
        setGameState('setup');
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === 'playing' && answered === null) {
      setTimer(TIMER_DURATIONS[difficulty]);
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAnswer(-1); // Times up
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, currentQuestionIndex, answered, difficulty]);
  
  const handleAnswer = (selectedIndex: number) => {
    if (answered !== null) return;

    setAnswered(selectedIndex);
    setUserAnswers(prev => [...prev, selectedIndex]);

    if (selectedIndex === questions[currentQuestionIndex].correctIndex) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setAnswered(null);
    } else {
      setGameState('results');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 8000);
    }
  };

  const renderSetup = () => (
    <div className="w-full max-w-2xl mx-auto">
        <Card className="shadow-xl">
            <CardHeader className="text-center">
                <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
                <CardTitle className="text-3xl font-bold">טריוויה משפחתית</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 p-6">
                <div className="space-y-3">
                    <Label className="font-semibold text-lg">רמת קושי</Label>
                    <RadioGroup value={difficulty} onValueChange={(v: Difficulty) => setDifficulty(v)} className="flex justify-center gap-4">
                        {(['קל', 'בינוני', 'קשה', 'מעורב'] as Difficulty[]).map(d => (
                            <Label key={d} className="flex items-center gap-2 border rounded-md px-4 py-2 cursor-pointer has-[input:checked]:bg-primary has-[input:checked]:text-primary-foreground has-[input:checked]:border-primary transition-colors">
                                <RadioGroupItem value={d} id={`d-${d}`} />
                                {d}
                            </Label>
                        ))}
                    </RadioGroup>
                </div>
                <div className="space-y-3">
                    <Label className="font-semibold text-lg">תחומי שאלות</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {TOPICS_CONFIG.map(topic => {
                            const isDisabled = topic.id === 'סיפורי חיים' && !canUseLifeStories;
                            const checkbox = (
                                <div key={topic.id} className="flex items-center gap-2 border rounded-md p-3 has-[input:checked]:bg-accent has-[input:disabled]:opacity-50">
                                    <Checkbox id={`t-${topic.id}`} checked={selectedTopics.includes(topic.id)} onCheckedChange={() => handleTopicChange(topic.id)} disabled={isDisabled} />
                                    <Label htmlFor={`t-${topic.id}`} className={cn("flex-1 cursor-pointer", isDisabled && "cursor-not-allowed")}>{topic.icon} {topic.label}</Label>
                                </div>
                            );
                            if (isDisabled) {
                                return (
                                    <TooltipProvider key={topic.id}>
                                        <Tooltip>
                                            <TooltipTrigger asChild><div>{checkbox}</div></TooltipTrigger>
                                            <TooltipContent><p>הוסף תיאורים ל-5 אנשים לפחות כדי לאפשר שאלות על סיפורי חיים</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            }
                            return checkbox;
                        })}
                    </div>
                </div>
                 <div className="space-y-3">
                    <Label className="font-semibold text-lg">מספר שאלות</Label>
                    <RadioGroup value={String(questionCount)} onValueChange={(v) => setQuestionCount(Number(v))} className="flex justify-center gap-4">
                        {[5, 10, 15, 20].map(c => (
                            <Label key={c} className="flex items-center gap-2 border rounded-md px-4 py-2 cursor-pointer has-[input:checked]:bg-primary has-[input:checked]:text-primary-foreground has-[input:checked]:border-primary transition-colors">
                                <RadioGroupItem value={String(c)} id={`c-${c}`} />
                                {c}
                            </Label>
                        ))}
                    </RadioGroup>
                </div>
                <Button size="lg" className="w-full text-lg" onClick={startGame}>התחל משחק 🎮</Button>
            </CardContent>
        </Card>
    </div>
  );
  
  const renderLoading = () => (
    <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="text-xl">מייצר משחק טריוויה... 🤖</p>
    </div>
  );

  const renderPlaying = () => {
    const question = questions[currentQuestionIndex];
    if (!question) return null;
    const timerPercentage = (timer / TIMER_DURATIONS[difficulty]) * 100;
    const timerColor = timerPercentage > 50 ? 'bg-green-500' : timerPercentage > 25 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">שאלה {currentQuestionIndex + 1} / {questions.length}</div>
                <div className="text-lg font-bold">ניקוד: {score}</div>
            </div>
            <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} />
            <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full transition-all duration-1000 linear", timerColor)} style={{ width: `${timerPercentage}%` }} />
            </div>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">{question.question}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {question.options.map((option, index) => {
                            const isCorrect = index === question.correctIndex;
                            const isSelected = index === answered;
                            
                            let buttonClass = 'bg-background hover:bg-muted';
                            if (answered !== null) {
                                if (isCorrect) buttonClass = 'bg-green-500 hover:bg-green-600 text-white animate-pulse';
                                else if (isSelected) buttonClass = 'bg-red-500 hover:bg-red-600 text-white animate-in fade-in-0 shake';
                                else buttonClass = 'bg-muted opacity-60';
                            }
                            
                            return (
                                <Button key={index} variant="outline" size="lg" className={`h-auto justify-start p-4 text-base ${buttonClass}`} onClick={() => handleAnswer(index)} disabled={answered !== null}>
                                    <span className="flex-1 text-right">{option}</span>
                                    {answered !== null && isSelected && (isCorrect ? <CheckCircle2 className="h-6 w-6"/> : <XCircle className="h-6 w-6"/>)}
                                </Button>
                            );
                        })}
                    </div>
                     {answered !== null && (
                        <div className="p-4 bg-accent rounded-md text-center space-y-2">
                           <p className="font-semibold">{question.explanation}</p>
                           <Button onClick={nextQuestion}>
                                {currentQuestionIndex < questions.length - 1 ? "השאלה הבאה" : "סיים משחק"}
                                <ArrowLeft className="mr-2 h-4 w-4" />
                           </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
  };
  
  const renderResults = () => {
    const percentage = Math.round((score / questions.length) * 100);
    const getRating = () => {
      if (percentage === 100) return '🏆 אלוף המשפחה!';
      if (percentage >= 80) return '🌟 מצוין!';
      if (percentage >= 60) return '👍 כל הכבוד!';
      if (percentage >= 40) return '📚 יש מה ללמוד!';
      return '😅 כדאי להכיר את המשפחה טוב יותר!';
    };

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            {showConfetti && <Confetti recycle={false} numberOfPieces={300} />}
            <Card className="text-center p-8 shadow-xl">
                <h2 className="text-4xl font-extrabold">{getRating()}</h2>
                <p className="text-6xl font-bold my-4">{percentage}%</p>
                <p className="text-muted-foreground text-lg">ענית נכון על {score} מתוך {questions.length} שאלות.</p>
            </Card>

            <Card>
                <CardHeader><CardTitle>סיכום שאלות</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {questions.map((q, i) => (
                        <div key={i} className="border p-3 rounded-md">
                            <p className="font-semibold">{i+1}. {q.question}</p>
                            <p className={cn(
                                "text-sm mt-1",
                                userAnswers[i] === q.correctIndex ? "text-green-600" : "text-red-600"
                            )}>
                                {userAnswers[i] === q.correctIndex ? '✔ תשובה נכונה' : `✖ תשובה שגויה. הנכונה: ${q.options[q.correctIndex]}`}
                            </p>
                        </div>
                    ))}
                </CardContent>
            </Card>
            
             <div className="flex justify-center gap-4">
                <Button size="lg" onClick={() => setGameState('setup')}>שחק שוב</Button>
                <Button size="lg" variant="outline" onClick={() => setViewMode('tree')}>חזור לעץ</Button>
            </div>
        </div>
    );
  };
  
  return (
    <div className="h-full w-full bg-muted/30 flex items-center justify-center p-4 sm:p-8" dir="rtl">
        {gameState === 'setup' && renderSetup()}
        {gameState === 'loading' && renderLoading()}
        {gameState === 'playing' && renderPlaying()}
        {gameState === 'results' && renderResults()}
    </div>
  );
}
