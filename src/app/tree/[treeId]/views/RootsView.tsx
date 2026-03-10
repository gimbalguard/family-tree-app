'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Person, FamilyTree } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define the shape of the project data
interface RootsProjectData {
  projectName?: string;
  coverPage?: {
    title?: string;
    studentName?: string;
    teacherName?: string;
    submissionDate?: string;
  };
  // Add other steps data structure later
  [key: string]: any;
}

// Define the steps for the wizard
const WIZARD_STEPS = [
  { id: 1, label: 'שער המבוא' },
  { id: 2, label: 'אני' },
  { id: 3, label: 'משפחה קרובה' },
  { id: 4, label: 'שורשים' },
  { id: 5, label: 'סיכום' },
];

type RootsViewProps = {
  treeId: string;
  people: Person[];
  tree: FamilyTree | null;
};

// Debounce hook
function useDebounce(value: any, delay: number) {  
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function RootsView({ treeId, people, tree }: RootsViewProps) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<RootsProjectData>({});
  const [chatHistory, setChatHistory] = useState<{ role: 'ai' | 'user', content: string }[]>([]);
  const [userInput, setUserInput] = useState('');

  const debouncedProjectData = useDebounce(projectData, 2000);
  const isInitialLoad = useRef(true);

  // Load existing project or create a new one
  useEffect(() => {
    if (!user || !db || !treeId) return;
    
    const projectDocRef = doc(db, `users/${user.uid}/familyTrees/${treeId}/rootsProjects/main`);
    
    const loadProject = async () => {
      try {
        const docSnap = await getDoc(projectDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProjectId(docSnap.id);
          setProjectData(data.projectData || {});
          setCurrentStep(data.currentStep || 1);
          setChatHistory(data.chatHistory || [{ role: 'ai', content: `שלום! ברוכים הבאים לאשף עבודת השורשים. מה תרצו שיהיה שם הפרויקט?` }]);
        } else {
          // No project exists, prompt for a name and create it
          const newProjectId = 'main';
          const initialProjectData = { projectName: tree?.treeName || "עבודת שורשים" };
          const initialChat = [{ role: 'ai' as const, content: `שלום! יצרתי עבורך פרויקט חדש בשם "${initialProjectData.projectName}". בוא נתחיל בשלב הראשון: שער המבוא.` }];

          await setDoc(projectDocRef, {
            userId: user.uid,
            treeId: treeId,
            projectName: initialProjectData.projectName,
            projectData: initialProjectData,
            currentStep: 1,
            chatHistory: initialChat,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          setProjectId(newProjectId);
          setProjectData(initialProjectData);
          setChatHistory(initialChat);
        }
      } catch (error) {
        console.error("Error loading/creating roots project:", error);
        toast({
          variant: "destructive",
          title: "שגיאה",
          description: "לא ניתן היה לטעון או ליצור את פרויקט השורשים.",
        });
      } finally {
        setIsLoading(false);
        isInitialLoad.current = false;
      }
    };

    loadProject();
  }, [user, db, treeId, tree, toast]);

  // Auto-save debounced data
  useEffect(() => {
    if (isInitialLoad.current || !user || !db || !projectId) return;
    
    const saveProject = async () => {
      const projectDocRef = doc(db, `users/${user.uid}/familyTrees/${treeId}/rootsProjects/${projectId}`);
      try {
        await setDoc(projectDocRef, {
          projectData: debouncedProjectData,
          currentStep,
          chatHistory,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        console.error("Error auto-saving project:", error);
      }
    };
    
    saveProject();
  }, [debouncedProjectData, currentStep, chatHistory, user, db, treeId, projectId]);


  const handleStepChange = (step: number) => {
    if (step >= 1 && step <= WIZARD_STEPS.length) {
      setCurrentStep(step);
    }
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    const newHistory = [...chatHistory, { role: 'user' as const, content: userInput }];
    // Placeholder AI response
    newHistory.push({ role: 'ai' as const, content: `הבנתי. תודה על המידע: "${userInput}"` });
    setChatHistory(newHistory);
    setUserInput('');
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex bg-muted/30" dir="rtl">
      {/* Left Panel: Preview */}
      <div className="w-3/5 p-4">
        <Card className="h-full shadow-lg">
          <CardHeader>
            <h2 className="text-xl font-bold text-center">
              תצוגה מקדימה: {WIZARD_STEPS.find(s => s.id === currentStep)?.label}
            </h2>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)] flex items-center justify-center">
            <p className="text-muted-foreground">תוכן השלב יוצג כאן...</p>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel: Wizard */}
      <div className="w-2/5 p-4 flex flex-col gap-4">
        <Card className="flex-1 flex flex-col shadow-lg">
          {/* Stepper */}
          <div className="p-4 border-b">
            <div className="mb-2 text-center text-sm font-medium">
              שלב {currentStep} מתוך {WIZARD_STEPS.length}: {WIZARD_STEPS.find(s => s.id === currentStep)?.label}
            </div>
            <Progress value={(currentStep / WIZARD_STEPS.length) * 100} />
            <div className="flex justify-between mt-2">
              {WIZARD_STEPS.map(step => (
                <div key={step.id} className="flex flex-col items-center">
                  <button
                    onClick={() => handleStepChange(step.id)}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors",
                      currentStep >= step.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step.id}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Chat Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {chatHistory.map((msg, index) => (
                <div key={index} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent'
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="p-4 border-t space-y-2">
             <div className="relative">
                <Textarea
                    placeholder="כתוב כאן..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    className="pr-10"
                />
                <Button size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => handleStepChange(currentStep - 1)} disabled={currentStep === 1}>
                → הקודם
              </Button>
              <Button onClick={() => handleStepChange(currentStep + 1)} disabled={currentStep === WIZARD_STEPS.length}>
                הבא ←
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
