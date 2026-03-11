'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Person, FamilyTree, RootsProject, Relationship } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { rootsAssistant } from '@/ai/flows/roots-assistant-flow';
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, Mic, StopCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define the shape of the project data
interface RootsProjectData {
  projectName?: string;
  coverPage?: {
    title?: string;
    studentName?: string;
    teacherName?: string;
    submissionDate?: string;
    className?: string;
  };
  // Add other steps data structure later
  [key: string]: any;
}

// Define the steps for the wizard
const WIZARD_STEPS = [
  { id: 1, label: 'שער המבוא', instruction: "שאל על שם העבודה, שם התלמיד, בית הספר והכיתה. הצע את הנתונים הקיימים מהעץ." },
  { id: 2, label: 'אני', instruction: "שאל על שם התלמיד, משמעותו, תאריך לידה, תחביבים, חפץ יקר. הצע נתונים אם קיימים." },
  { id: 3, label: 'משפחה קרובה', instruction: "שאל על ההורים — מקום לידה, עיסוק, סיפור היכרות. אחים — גילאים וקשר." },
  { id: 4, label: 'שורשים', instruction: "נחה ראיון עומק עם הסבים — ילדות, עלייה, אירועים היסטוריים. שאלה אחת בכל פעם." },
  { id: 5, label: 'סיכום', instruction: "בקש רפלקציה — מה למד על עצמו? מה הפתיע אותו? סכם את כל העבודה לפרקים." },
];

type RootsViewProps = {
  treeId: string;
  people: Person[];
  relationships: Relationship[];
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

const EditableField = ({ value, onUpdate, placeholder, className }: { value: string; onUpdate: (newValue: string) => void; placeholder: string; className?: string }) => {
    const handleBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
      onUpdate(e.currentTarget.textContent || '');
    };
  
    return (
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        className={cn(
          "px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-blue-50 dark:focus:bg-blue-950",
          !value && "text-muted-foreground",
          className
        )}
        dangerouslySetInnerHTML={{ __html: value || placeholder }}
      />
    );
};

export function RootsView({ treeId, people, relationships, tree }: RootsViewProps) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<RootsProjectData>({});
  const [chatHistory, setChatHistory] = useState<{ role: 'assistant' | 'user', content: string }[]>([]);
  const [userInput, setUserInput] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
          const data = docSnap.data() as RootsProject;
          setProjectId(docSnap.id);
          setProjectData(data.projectData || {});
          setCurrentStep(data.currentStep || 1);
          const loadedChatHistory = data.chatHistory || [{ role: 'assistant', content: `שלום! ברוכים הבאים לאשף עבודת השורשים. מה תרצו שיהיה שם הפרויקט?` }];
          setChatHistory(loadedChatHistory.map(msg => ({...msg, role: msg.role === 'ai' ? 'assistant' : msg.role as 'assistant' | 'user' })));

        } else {
          // No project exists, prompt for a name and create it
          const newProjectId = 'main';
          const initialProjectData = { projectName: tree?.treeName || "עבודת שורשים" };
          const initialChat = [{ role: 'assistant' as const, content: `שלום! יצרתי עבורך פרויקט חדש בשם "${initialProjectData.projectName}". בוא נתחיל בשלב הראשון: שער המבוא.` }];

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

  const handleSendMessage = async () => {
    if (!userInput.trim() || !user) return;
    
    const userMessage = { role: 'user' as const, content: userInput };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setUserInput('');
    setIsAiLoading(true);

    try {
      const stepInstruction = WIZARD_STEPS.find(s => s.id === currentStep)?.instruction || '';

      const treeDataSummary = JSON.stringify({
        people: people.map(p => ({ 
          name: `${p.firstName} ${p.lastName}`, 
          birth: p.birthDate, 
          birthplace: p.birthPlace,
          isOwner: p.id === tree?.ownerPersonId
        })),
        relationships: (relationships || []).map(r => ({ from: r.personAId, to: r.personBId, type: r.relationshipType })),
      });
      
      const result = await rootsAssistant({
        currentStep,
        stepInstruction,
        treeDataSummary,
        stepChatHistory: newHistory,
        newUserMessage: userInput,
      });

      const aiMessage = { role: 'assistant' as const, content: result.aiResponse };
      setChatHistory(prev => [...prev, aiMessage]);
      
      if (result.updatedProjectData) {
         setProjectData(prev => {
            const newProjectData = { ...prev };
            for (const key in result.updatedProjectData) {
                if (typeof result.updatedProjectData[key] === 'object' && !Array.isArray(result.updatedProjectData[key]) && result.updatedProjectData[key] !== null) {
                    newProjectData[key] = { ...(prev[key] || {}), ...result.updatedProjectData[key] };
                } else if (result.updatedProjectData[key] !== undefined) {
                    newProjectData[key] = result.updatedProjectData[key];
                }
            }
            return newProjectData;
        });
      }

    } catch (error) {
      console.error("AI assistant error:", error);
      toast({ variant: "destructive", title: "שגיאת AI", description: "לא ניתן היה לקבל תגובה מהעוזר." });
      const errorMessage = { role: 'assistant' as const, content: 'מצטער, נתקלתי בשגיאה. נוכל לנסות שוב?' };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
        setIsAiLoading(false);
    }
  };
  
    const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsRecording(true);
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            if (!base64Audio) return;

            setIsTranscribing(true);
            try {
              const { transcript } = await transcribeAudio({ audioDataUri: base64Audio });
              setUserInput((prev) => (prev ? `${prev}\n${transcript}` : transcript));
              toast({ title: 'התמלול הושלם', description: 'הטקסט נוסף לתיבת הקלט.' });
            } catch (error) {
              console.error("Error transcribing audio:", error);
              toast({ variant: 'destructive', title: 'שגיאת תמלול' });
            } finally {
              setIsTranscribing(false);
            }
          };
        };
        mediaRecorderRef.current.start();
      } catch (err) {
        console.error("Error accessing microphone:", err);
        toast({ variant: 'destructive', title: 'שגיאת מיקרופון' });
        setIsRecording(false);
      }
    }
  };

  const handleProjectDataChange = (path: string[], value: any) => {
    setProjectData(prev => {
      const newProjectData = JSON.parse(JSON.stringify(prev)); // Deep copy
      let current: any = newProjectData;
      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = current[path[i]] || {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newProjectData;
    });
  };


  const renderPreview = () => {
    switch (currentStep) {
        case 1:
            const { title, studentName, teacherName, submissionDate, className } = projectData.coverPage || {};
            return (
                <div className="p-8 border-4 border-gray-700 bg-white h-full text-black text-center flex flex-col justify-center items-center font-serif">
                    <h1 className="text-4xl font-bold mb-12">
                        <EditableField value={title || ''} onUpdate={(newValue) => handleProjectDataChange(['coverPage', 'title'], newValue)} placeholder={projectData.projectName || 'שם הפרויקט'} className="font-bold text-4xl" />
                    </h1>
                    <div className="space-y-4 text-lg">
                        <p>מגיש/ה: <EditableField value={studentName || ''} onUpdate={(newValue) => handleProjectDataChange(['coverPage', 'studentName'], newValue)} placeholder="[שם התלמיד/ה]" /></p>
                        <p>כיתה: <EditableField value={className || ''} onUpdate={(newValue) => handleProjectDataChange(['coverPage', 'className'], newValue)} placeholder="[כיתה]" /></p>
                        <p>מורה: <EditableField value={teacherName || ''} onUpdate={(newValue) => handleProjectDataChange(['coverPage', 'teacherName'], newValue)} placeholder="[שם המורה]" /></p>
                        <p>תאריך הגשה: <EditableField value={submissionDate || ''} onUpdate={(newValue) => handleProjectDataChange(['coverPage', 'submissionDate'], newValue)} placeholder="[תאריך הגשה]" /></p>
                    </div>
                </div>
            )
        default:
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">תוכן השלב יוצג כאן...</p>
                </div>
            );
    }
}


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
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="text-xl font-bold text-center flex-1">
                תצוגה מקדימה: {WIZARD_STEPS.find(s => s.id === currentStep)?.label}
            </h2>
          </CardHeader>
          <CardContent className="h-[calc(100%-4.5rem)]">
            {renderPreview()}
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
              {(isAiLoading || isTranscribing) && (
                <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-accent flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        <span>{isTranscribing ? 'מתמלל...' : 'חושב...'}</span>
                    </div>
                </div>
              )}
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
                    className="pr-20"
                    disabled={isAiLoading || isTranscribing}
                />
                 <div className="absolute top-2 right-2 flex flex-col gap-2">
                    <Button size="icon" className="h-7 w-7" onClick={handleSendMessage} disabled={isAiLoading || isTranscribing || !userInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                     <Button size="icon" variant={isRecording ? "destructive" : "outline"} className="h-7 w-7" onClick={handleMicClick} disabled={isAiLoading || isTranscribing}>
                      {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => handleStepChange(currentStep - 1)} disabled={currentStep === 1 || isAiLoading}>
                → הקודם
              </Button>
              <Button onClick={() => handleStepChange(currentStep + 1)} disabled={currentStep === WIZARD_STEPS.length || isAiLoading}>
                הבא ←
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
