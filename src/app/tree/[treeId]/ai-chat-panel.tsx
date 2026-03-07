'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  writeBatch,
  doc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Paperclip, Send, Loader2, Bot, StopCircle, X, GripVertical } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { generateTreeFromStory } from '@/ai/flows/ai-tree-generation-flow';
import type { GenerateTreeOutput } from '@/ai/flows/ai-tree-generation.types';
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: React.ReactNode;
}

interface AiChatPanelProps {
    treeId: string;
    treeName: string;
    onClose: () => void;
    onDataAdded: () => void;
}

export function AiChatPanel({ treeId, treeName, onClose, onDataAdded }: AiChatPanelProps) {
  const router = useRouter();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [story, setStory] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag and drop state
  const [position, setPosition] = useState({ x: 30, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };
  
  const handleDragMove = (e: MouseEvent) => {
    setPosition({
      x: e.clientX - dragStartPos.current.x,
      y: e.clientY - dragStartPos.current.y,
    });
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };


  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatHistory]);

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
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
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            if (!base64Audio) return;

            setIsTranscribing(true);
            try {
              const { transcript } = await transcribeAudio({ audioDataUri: base64Audio });
              setStory((prev) => (prev ? `${prev}\n${transcript}` : transcript));
              toast({ title: 'התמלול הושלם', description: 'הטקסט נוסף לתיבת הסיפור.' });
            } catch (error) {
              console.error("Error transcribing audio:", error);
              toast({ variant: 'destructive', title: 'שגיאת תמלול', description: 'לא ניתן היה לתמלל את ההקלטה.' });
            } finally {
              setIsTranscribing(false);
            }
          };
        };
        mediaRecorderRef.current.start();
      } catch (err) {
        console.error("Error accessing microphone:", err);
        toast({ variant: 'destructive', title: 'שגיאת מיקרופון', description: 'לא ניתן לגשת למיקרופון. אנא בדוק הרשאות.' });
        setIsRecording(false);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('text/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setStory((prev) => (prev ? `${prev}\n${text}` : text));
        toast({ title: 'הקובץ נטען', description: 'תוכן הקובץ נוסף לתיבת הסיפור.' });
      };
      reader.readAsText(file);
    } else {
      toast({ variant: 'destructive', title: 'סוג קובץ לא נתמך', description: 'אנא העלה קובץ טקסט (.txt, .md).'});
    }
    event.target.value = ''; // Reset for re-uploading the same file
  };


  const handleAddDataToTree = async (data: GenerateTreeOutput | null) => {
    if (!data || !user || !db || !treeId) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'נתונים חסרים להוספה לעץ.',
      });
      return;
    }
    setIsAdding(true);

    try {
      const batch = writeBatch(db);
      
      const tempIdToFirestoreId: Record<string, string> = {};

      data.people.forEach((person) => {
        const personDocRef = doc(
          collection(db, 'users', user.uid, 'familyTrees', treeId, 'people')
        );
        tempIdToFirestoreId[person.key] = personDocRef.id;
        
        const { key, ...personData } = person;

        batch.set(personDocRef, {
          ...personData,
          userId: user.uid,
          treeId: treeId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      data.relationships.forEach((rel) => {
        const personAId = tempIdToFirestoreId[rel.personAKey];
        const personBId = tempIdToFirestoreId[rel.personBKey];

        if (personAId && personBId) {
          const relDocRef = doc(
            collection(
              db,
              'users',
              user.uid,
              'familyTrees',
              treeId,
              'relationships'
            )
          );
          
          const { personAKey, personBKey, ...relData } = rel;

          batch.set(relDocRef, {
            ...relData,
            personAId,
            personBId,
            userId: user.uid,
            treeId: treeId,
          });
        }
      });

      await batch.commit();

      toast({
        title: 'הנתונים נוספו בהצלחה!',
        description: `המידע החדש נוסף לעץ "${treeName}"`,
      });
      onDataAdded();
      
    } catch (error) {
      console.error('Error adding data to tree:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה להוסיף את הנתונים לעץ המשפחה. נסה שוב.',
      });
    } finally {
        setIsAdding(false);
    }
  };

  const handleSendStory = async () => {
    if (!story.trim() || !user) return;
    if (user.isAnonymous) {
      toast({
        variant: 'destructive',
        title: 'נדרש אימות',
        description: 'כדי להשתמש ב-AI, עליך להתחבר.',
      });
      router.push('/login');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: story,
    };
    setChatHistory((prev) => [...prev, userMessage]);
    setStory('');
    setIsGenerating(true);

    try {
      const result = await generateTreeFromStory({ story, treeName });

      const relationshipLabels: Record<string, string> = {
        parent: 'הורה של', spouse: 'בן/בת זוג של', adoptive_parent: 'הורה מאמצ/ת של',
        step_parent: 'הורה חורג/ת של', sibling: 'אח/אחות של', twin: 'תאום/ה של',
        ex_spouse: 'בן/בת זוג לשעבר של', guardian: 'אפוטרופוס של', godparent: 'סנדק/ית של',
      };

      const assistantMessageContent = (
        <div className="space-y-4 text-right">
            <p className="font-semibold">{result.summary}</p>
            {result.people.length > 0 && (
                <div className="text-sm">
                <h4 className="font-medium underline">אנשים שזוהו:</h4>
                <ul className="list-disc list-inside text-muted-foreground">
                    {result.people.map(p => <li key={p.key}>{p.firstName} {p.lastName}</li>)}
                </ul>
                </div>
            )}
            {result.relationships.length > 0 && (
                <div className="text-sm">
                <h4 className="font-medium underline">קשרים שזוהו:</h4>
                <ul className="list-disc list-inside text-muted-foreground">
                    {result.relationships.map((r, i) => {
                    const personA = result.people.find(p => p.key === r.personAKey);
                    const personB = result.people.find(p => p.key === r.personBKey);
                    const relLabel = relationshipLabels[r.relationshipType] || r.relationshipType;
                    if (!personA || !personB) return null;
                    return <li key={i}>{`${personA.firstName} ${personA.lastName}`} הוא/היא {relLabel} {`${personB.firstName} ${personB.lastName}`}</li>
                    })}
                </ul>
                </div>
            )}
            {result.clarificationQuestion ? (
                <Alert dir="rtl">
                    <Info className="h-4 w-4" />
                    <AlertTitle>שאלה להבהרה</AlertTitle>
                    <AlertDescription>{result.clarificationQuestion}</AlertDescription>
                </Alert>
            ) : (
                <div className="pt-2">
                    <Button onClick={() => handleAddDataToTree(result)} disabled={isAdding}>
                        {isAdding ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                        הוסף לעץ
                    </Button>
                </div>
            )}
        </div>
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantMessageContent,
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error generating tree from story:', error);
      const errorMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'מצטער, נתקלתי בשגיאה בעת ניתוח הסיפור שלך. נסה לנסח מחדש או נסה שוב מאוחר יותר.',
      };
      setChatHistory((prev) => [...prev, errorMessage]);
      toast({ variant: 'destructive', title: 'שגיאת AI', description: 'לא ניתן היה לעבד את הסיפור.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const disabledWhileBusy = isGenerating || isRecording || isTranscribing;

  return (
    <div
      ref={panelRef}
      className="fixed bottom-8 right-8 z-[1050] w-full max-w-md"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <Card className="flex flex-col shadow-2xl h-[60vh] min-h-[400px]">
        <CardHeader
          className="flex-row items-center justify-between space-y-0 py-3 px-4 border-b cursor-grab"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">עוזר AI</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          <div className="flex h-full flex-col space-y-4 bg-muted/20 p-4">
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              <div className="pr-4 space-y-6">
                {chatHistory.length === 0 && !isTranscribing && (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <p>הודעות הצ'אט יופיעו כאן...</p>
                  </div>
                )}
                {chatHistory.map((message) => (
                  <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.role === 'assistant' && ( <Avatar className="h-8 w-8 border"><AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback></Avatar> )}
                    <div className={`max-w-[75%] rounded-lg p-3 ${ message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background' }`}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {(isGenerating || isTranscribing) && (
                  <div className="flex items-start gap-4">
                    <Avatar className="h-8 w-8 border"><AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback></Avatar>
                    <div className="max-w-[75%] rounded-lg bg-background p-3 flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{isTranscribing ? 'מתמלל הקלטה...' : 'חושב...'}</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="relative mt-4">
              <Textarea
                placeholder="ספר על אדם או קשר כדי להוסיף לעץ..."
                className="pr-28 pl-12 h-20"
                value={story}
                onChange={(e) => setStory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendStory(); }
                }}
                disabled={disabledWhileBusy}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="text/*" disabled={disabledWhileBusy} />
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={disabledWhileBusy}>
                    <Paperclip className="h-5 w-5" /><span className="sr-only">צרף קובץ</span>
                </Button>
                <Button variant={isRecording ? 'destructive' : 'ghost'} size="icon" onClick={handleMicClick} disabled={isTranscribing || isGenerating}>
                    {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    <span className="sr-only">{isRecording ? 'עצור הקלטה' : 'הקלט הודעה'}</span>
                </Button>
              </div>
              <Button variant="default" size="icon" className="absolute left-3 top-1/2 -translate-y-1/2" onClick={handleSendStory} disabled={disabledWhileBusy || !story.trim()}>
                <Send className="h-5 w-5" /><span className="sr-only">שלח</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
