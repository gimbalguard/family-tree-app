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
import { useAiChat, type ChatMessage } from '@/context/ai-chat-context';
import type { Person, RootsProject } from '@/lib/types';
import * as XLSX from 'xlsx';
import { rootsAssistant } from '@/ai/flows/roots-assistant-flow';
import { WIZARD_STEPS, type RootsProjectData } from './views/RootsView';

interface AiChatPanelProps {
    treeId: string;
    treeName: string;
    people: Person[];
    onClose: () => void;
    onDataAdded: () => void;
    viewMode: 'tree' | 'roots' | 'timeline' | 'table' | 'map' | 'calendar' | 'statistics' | 'trivia';
    rootsProject: RootsProject | null;
    onRootsProjectUpdate: (updatedData: Partial<RootsProjectData>) => void;
}

const AttachmentPreview = ({ attachment, onRemove }: { attachment: { file: File }, onRemove: () => void }) => {
    return (
        <div className="flex items-center gap-2 p-2 mb-2 border rounded-lg bg-background">
            <Paperclip className="h-4 w-4 text-muted-foreground"/>
            <span className="text-sm text-muted-foreground flex-1 truncate">{attachment.file.name}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
                <X className="h-4 w-4"/>
            </Button>
        </div>
    );
};


export function AiChatPanel({ 
    treeId, 
    treeName, 
    people, 
    onClose, 
    onDataAdded, 
    viewMode,
    rootsProject,
    onRootsProjectUpdate
}: AiChatPanelProps) {
  const router = useRouter();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const {
    chatHistory,
    setChatHistory,
    isGenerating,
    setIsGenerating,
    isTranscribing,
    setIsTranscribing,
    addMessage,
  } = useAiChat();

  const [story, setStory] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [attachment, setAttachment] = useState<{ file: File, type: 'image' | 'text', data: string } | null>(null);
  const [isFileHovering, setIsFileHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag and drop state for the panel itself
  const [position, setPosition] = useState({ x: 30, y: 30 });
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handlePanelDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsPanelDragging(true);
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    document.addEventListener('mousemove', handlePanelDragMove);
    document.addEventListener('mouseup', handlePanelDragEnd);
  };
  
  const handlePanelDragMove = (e: MouseEvent) => {
    setPosition({
      x: e.clientX - dragStartPos.current.x,
      y: e.clientY - dragStartPos.current.y,
    });
  };
  
  const handlePanelDragEnd = () => {
    setIsPanelDragging(false);
    document.removeEventListener('mousemove', handlePanelDragMove);
    document.removeEventListener('mouseup', handlePanelDragEnd);
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

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB
        toast({ variant: 'destructive', title: 'קובץ גדול מדי', description: 'גודל הקובץ המקסימלי הוא 10MB.' });
        return;
    }
    setAttachment(null);

    const fileType = file.type;
    const fileName = file.name;

    if (fileType.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            setAttachment({ file, type: 'image', data: e.target?.result as string });
        };
        reader.readAsDataURL(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                let fullText = '';
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const text = XLSX.utils.sheet_to_txt(worksheet);
                    fullText += `--- ${sheetName} ---\n${text}\n\n`;
                });
                setAttachment({ file, type: 'text', data: fullText });
            } catch (error) {
                console.error("Error parsing Excel file:", error);
                toast({ variant: 'destructive', title: 'שגיאה בעיבוד הקובץ', description: 'לא ניתן היה לקרוא את קובץ האקסל.' });
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (fileType.startsWith('audio/')) {
        const assistantMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `קובץ שמע צורף: "${fileName}". ניתוח קבצי שמע אינו נתמך כרגע.`,
        };
        addMessage(assistantMessage);
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pptx')) {
        toast({ title: 'סוג קובץ לא נתמך', description: 'כרגע לא ניתן לעבד טקסט מקבצי PDF או PowerPoint.' });
    } else {
        toast({ variant: 'destructive', title: 'סוג קובץ לא נתמך' });
    }
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPanelDragging) {
        setIsFileHovering(true);
    }
  };
  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileHovering(false);
  };
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileHovering(false);
    if (!isPanelDragging && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
    }
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

      data.people?.forEach((person) => {
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

      data.relationships?.forEach((rel) => {
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

  const handleSend = async (messageContent: string) => {
    if ((!messageContent.trim() && !attachment) || !user) return;
    if (user.isAnonymous) {
      toast({
        variant: 'destructive',
        title: 'נדרש אימות',
        description: 'כדי להשתמש ב-AI, עליך להתחבר.',
      });
      router.push('/login');
      return;
    }
    
    const userMessageContent = (
      <div className="space-y-2 text-right">
        {attachment && attachment.type === 'image' && (
          <img src={attachment.data} alt={attachment.file.name} className="max-h-48 w-auto rounded-md border" />
        )}
        {attachment && (
          <p className="text-sm italic opacity-80 border-t border-white/20 pt-2 mt-2">
            קובץ מצורף: {attachment.file.name}
          </p>
        )}
        {messageContent && <p>{messageContent}</p>}
      </div>
    );

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
    };
    
    setStory(''); // Clear input immediately
    const currentAttachment = attachment;
    setAttachment(null);
    
    const newHistory = [...(chatHistory || []), userMessage];
    setChatHistory(newHistory);
    setIsGenerating(true);

    try {
        if (viewMode === 'roots' && rootsProject) {
            const stepInstruction = WIZARD_STEPS.find(s => s.id === rootsProject.currentStep)?.instruction || '';

            const treeDataSummary = JSON.stringify({
              people: people.map(p => ({ 
                name: `${p.firstName} ${p.lastName}`, 
                birth: p.birthDate, 
                birthplace: p.birthPlace,
                isOwner: p.id === rootsProject.userId
              })),
              relationships: rootsProject.projectData.relationships || [],
            });
            
            const result = await rootsAssistant({
              currentStep: rootsProject.currentStep,
              stepInstruction,
              treeDataSummary,
              stepChatHistory: newHistory.map(m => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : '[תגובה מורכבת]',
              })),
              newUserMessage: messageContent,
            });
      
            const aiMessage = { role: 'assistant' as const, id: (Date.now() + 1).toString(), content: result.aiResponse };
            addMessage(aiMessage);
            
            if (result.updatedProjectData) {
               onRootsProjectUpdate(result.updatedProjectData);
            }
        } else {
             const flowInput: any = {
                newUserMessage: messageContent,
                treeName: treeName,
                chatHistory: newHistory.map(m => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : 'משתמש סיפק תגובה מורכבת.',
                })),
                existingPeople: people.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })),
            };

            if (currentAttachment?.type === 'image') {
                flowInput.photoDataUri = currentAttachment.data;
            }

            if (currentAttachment?.type === 'text') {
                flowInput.newUserMessage = `[קובץ מצורף: ${currentAttachment.file.name}]\n[תוכן:]\n${currentAttachment.data}\n\n${messageContent}`;
            }
            
            const result = await generateTreeFromStory(flowInput);
            
            const assistantMessageContent = (
                <div className="space-y-4 text-right">
                    <p className="font-semibold">{result.summary}</p>
                    {result.clarificationQuestions && result.clarificationQuestions.length > 0 && (
                        <div className="space-y-2">
                        {result.clarificationQuestions.map((q, index) => (
                            <Alert dir="rtl" key={index}>
                            <Info className="h-4 w-4" />
                            <AlertTitle>{q.question}</AlertTitle>
                            {q.suggestedAnswers && q.suggestedAnswers.length > 0 && (
                                <AlertDescription className="pt-2 flex flex-wrap gap-2 justify-end">
                                {q.suggestedAnswers.map((ans, i) => (
                                    <Button key={i} size="sm" variant="outline" onClick={() => handleSend(ans)}>
                                    {ans}
                                    </Button>
                                ))}
                                </AlertDescription>
                            )}
                            </Alert>
                        ))}
                        </div>
                    )}
                </div>
            );

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: assistantMessageContent,
                data: result.isComplete ? result : null,
            };
            
            setChatHistory((prev) => [...prev, assistantMessage]);
        }

    } catch (error) {
      console.error('AI assistant error:', error);
      const errorMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'מצטער, נתקלתי בשגיאה. נוכל לנסות שוב?',
      };
      setChatHistory((prev) => [...prev, errorMessage]);
      toast({ variant: 'destructive', title: 'שגיאת AI', description: 'לא ניתן היה לעבד את הבקשה.' });
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
        cursor: isPanelDragging ? 'grabbing' : 'default',
      }}
      onDragEnter={handleFileDragOver}
      onDragOver={handleFileDragOver}
    >
      <Card className="flex flex-col shadow-2xl h-[60vh] min-h-[400px]">
        <CardHeader
          className="flex-row items-center justify-between space-y-0 py-3 px-4 border-b cursor-grab"
          onMouseDown={handlePanelDragStart}
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
             {isFileHovering && (
                <div 
                    className="absolute inset-0 z-10 border-2 border-dashed border-primary rounded-lg bg-primary/10 flex items-center justify-center m-4"
                    onDragLeave={handleFileDragLeave}
                    onDrop={handleFileDrop}
                >
                    <span className="font-bold text-primary">שחרר קובץ כאן</span>
                </div>
            )}
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
                    <div className={`max-w-[75%] rounded-lg p-3 break-words ${ message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background' }`}>
                      {message.content}
                       {message.data?.isComplete && viewMode === 'tree' && (
                        <div className="pt-2 text-right">
                          <Button onClick={() => handleAddDataToTree(message.data)} disabled={isAdding}>
                            {isAdding ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                            הוסף לעץ
                          </Button>
                        </div>
                      )}
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
               {attachment && <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} />}
              <Textarea
                placeholder="ספר על אדם או קשר כדי להוסיף לעץ..."
                className="pr-28 pl-12 h-20"
                value={story}
                onChange={(e) => setStory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(story); }
                }}
                disabled={disabledWhileBusy}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)} className="hidden" accept="image/*,.pdf,.xlsx,.xls,.pptx,.mp3,.wav,.m4a,.ogg" disabled={disabledWhileBusy} />
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={disabledWhileBusy}>
                    <Paperclip className="h-5 w-5" /><span className="sr-only">צרף קובץ</span>
                </Button>
                <Button variant={isRecording ? 'destructive' : 'ghost'} size="icon" onClick={handleMicClick} disabled={isTranscribing || isGenerating}>
                    {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    <span className="sr-only">{isRecording ? 'עצור הקלטה' : 'הקלט הודעה'}</span>
                </Button>
              </div>
              <Button variant="default" size="icon" className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => handleSend(story)} disabled={disabledWhileBusy || (!story.trim() && !attachment)}>
                <Send className="h-5 w-5" /><span className="sr-only">שלח</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
