'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  addDoc,
  collection,
  serverTimestamp,
  writeBatch,
  doc,
  query,
  getDocs,
  limit,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Paperclip, Send, Loader2, ArrowLeft, Bot, StopCircle, X, Globe } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Info } from 'lucide-react';
import { generateTreeFromStory } from '@/ai/flows/ai-tree-generation-flow';
import type { GenerateTreeOutput } from '@/ai/flows/ai-tree-generation.types';
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAiChat, type ChatMessage } from '@/context/ai-chat-context';
import * as XLSX from 'xlsx';
import type { PublicTree } from '@/lib/types';
import { TreeCard } from './dashboard/tree-card';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { motion } from 'framer-motion';
import Image from 'next/image';

const features = [
  {
    title: "בנייה באמצעות AI",
    description: "ספרו את סיפור משפחתכם בטקסט או בקול, והבינה המלאכותית תשרטט עבורכם את העץ הראשוני.",
    imageId: "feature-ai-build"
  },
  {
    title: "קנבס אינטראקטיבי",
    description: "סדרו, קבצו וחברו בין בני משפחה על קנבס ויזואלי אינטואיטיבי.",
    imageId: "feature-canvas"
  },
  {
    title: "תצוגות מרובות",
    description: "חקרו את הנתונים שלכם דרך ציר זמן, מפה גיאוגרפית, טבלה דינמית ועוד.",
    imageId: "feature-views"
  },
  {
    title: "פרופילים עשירים",
    description: "הוסיפו תמונות, סיפורי חיים, קישורים ומידע מפורט לכל אדם בעץ.",
    imageId: "feature-profiles"
  },
  {
    title: "ניתוחים סטטיסטיים",
    description: "גלו תובנות מרתקות על המשפחה שלכם עם דשבורד סטטיסטיקות אוטומטי.",
    imageId: "feature-stats"
  },
  {
    title: "אשף עבודת שורשים",
    description: "צרו עבודת שורשים מרשימה למצגת בית ספרית בעזרת מדריך AI צעד-אחר-צעד.",
    imageId: "feature-roots"
  },
  {
    title: "שיתוף וייצוא",
    description: "שתפו את העץ לצפייה עם קרובים וייצאו את המידע ל-PDF, Excel ועוד.",
    imageId: "feature-export"
  }
];

const FeatureCard = ({ title, description, imageId }: { title: string, description: string, imageId: string }) => {
    const image = PlaceHolderImages.find(img => img.id === imageId);
    if (!image) return null;

    return (
        <div className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <Image
                src={image.imageUrl}
                alt={title}
                width={600}
                height={400}
                className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={image.imageHint}
            />
            <div className="p-4">
                <h3 className="font-bold text-lg text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
        </div>
    );
};

function SeparatorWithText({ text }: { text: string }) {
  return (
    <div className="relative my-12">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-4 text-lg font-medium text-muted-foreground">
          {text}
        </span>
      </div>
    </div>
  );
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


export function AiBuildClient() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const {
    chatHistory,
    setChatHistory,
    isGenerating,
    setIsGenerating,
    isTranscribing,
    setIsTranscribing,
  } = useAiChat();

  const [isCreatingManually, setIsCreatingManually] = useState(false);
  const [treeName, setTreeName] = useState('עץ משפחה חדש');
  const [story, setStory] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [attachment, setAttachment] = useState<{ file: File, type: 'image' | 'text', data: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [publicTrees, setPublicTrees] = useState<PublicTree[]>([]);
  const [isLoadingPublicTrees, setIsLoadingPublicTrees] = useState(true);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatHistory]);

  useEffect(() => {
    const fetchPublicTrees = async () => {
      // Don't fetch until auth state is resolved and db is available.
      if (isUserLoading || !db) {
        return;
      }
      setIsLoadingPublicTrees(true);
      try {
        const publicTreesQuery = query(collection(db, "publicTrees"), limit(20));
        const publicSnapshot = await getDocs(publicTreesQuery);
        setPublicTrees(publicSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PublicTree)));
      } catch (error) {
        console.error("Error fetching public trees:", error);
        toast({
          variant: 'destructive',
          title: 'שגיאה',
          description: 'לא ניתן היה לטעון עצים ציבוריים.',
        });
      } finally {
        setIsLoadingPublicTrees(false);
      }
    };

    fetchPublicTrees();
  }, [db, toast, isUserLoading]);


  const handleManualCreate = async () => {
    if (!user || user.isAnonymous) {
        setIsAuthModalOpen(true);
        return;
    }
    
    setIsCreatingManually(true);
    if (!db) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה להתחבר למסד הנתונים.',
      });
      setIsCreatingManually(false);
      return;
    }


    try {
      const treeData = {
        treeName: 'עץ משפחה חדש',
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(
        collection(db, 'users', user.uid, 'familyTrees'),
        treeData
      );
      toast({
        title: 'עץ חדש נוצר',
        description: 'כעת תועבר לקנבס כדי להתחיל בבנייה.',
      });
      router.push(`/tree/${docRef.id}`);
    } catch (error) {
      console.error('Error creating new tree:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה ליצור עץ משפחה חדש. נסה שוב.',
      });
      setIsCreatingManually(false);
    }
  };

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

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB
        toast({
            variant: 'destructive',
            title: 'קובץ גדול מדי',
            description: 'גודל הקובץ המקסימלי הוא 10MB.',
        });
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
            textContent: `קובץ שמע צורף: "${fileName}". ניתוח קבצי שמע אינו נתמך כרגע.`,
        };
        setChatHistory(prev => [...prev, assistantMessage]);
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pptx')) {
        toast({ title: 'סוג קובץ לא נתמך', description: 'כרגע ניתן לעבד טקסט מקבצי Excel בלבד. עיבוד PDF יתווסף בעתיד.' });
    } else {
        toast({ variant: 'destructive', title: 'סוג קובץ לא נתמך' });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
    }
  };


  const handleCreateTreeFromAI = async (data: GenerateTreeOutput | null) => {
    if (!user || user.isAnonymous) {
        setIsAuthModalOpen(true);
        return;
    }
    
    if (!data || !db) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'נתונים חסרים ליצירת העץ.',
      });
      return;
    }
    setIsCreating(true);

    try {
      const treeDocRef = doc(collection(db, 'users', user.uid, 'familyTrees'));
      
      const batch = writeBatch(db);
      
      batch.set(treeDocRef, {
        treeName: treeName,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const treeId = treeDocRef.id;

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
        title: 'עץ נוצר בהצלחה!',
        description: `כעת תועבר לעץ החדש שלך: "${treeName}"`,
      });

      router.push(`/tree/${treeId}`);
    } catch (error) {
      console.error('Error creating tree from AI data:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה ליצור את עץ המשפחה. נסה שוב.',
      });
    } finally {
        setIsCreating(false);
    }
  };

  const handleSend = async (messageContent: string) => {
    if (!user) return;
    if (user.isAnonymous) {
        setIsAuthModalOpen(true);
        return;
    }
    if (!messageContent.trim() && !attachment) return;
    if (!treeName.trim()) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'אנא תן שם לעץ המשפחה שלך.',
      });
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
      textContent: messageContent,
    };
    
    setStory(''); // Clear input immediately
    const currentAttachment = attachment;
    setAttachment(null);
    
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setIsGenerating(true);
    
    try {
      const flowInput: any = {
        newUserMessage: messageContent,
        treeName: treeName,
        chatHistory: newHistory.map(m => ({
          role: m.role,
          content: m.textContent,
        })),
        existingPeople: [], // No existing people on the build page
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
        textContent: result.summary,
        data: result.isComplete ? result : null,
      };

      setChatHistory(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error generating tree from story:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'מצטער, נתקלתי בשגיאה בעת ניתוח הסיפור שלך. נסה לנסח מחדש או נסה שוב מאוחר יותר.',
        textContent: 'מצטער, נתקלתי בשגיאה בעת ניתוח הסיפור שלך. נסה לנסח מחדש או נסה שוב מאוחר יותר.',
      };
      setChatHistory((prev) => [...prev, errorMessage]);
      toast({
        variant: 'destructive',
        title: 'שגיאת AI',
        description: 'לא ניתן היה לעבד את הסיפור.',
      });
    } finally {
      setIsGenerating(false);
    }
  };


  const disabledWhileBusy = isGenerating || isRecording || isTranscribing;

  return (
    <div className="w-full overflow-x-hidden">
      <div className="relative bg-gradient-to-b from-blue-50 to-blue-100/10 pt-24 pb-20 text-center">
        <div
            aria-hidden="true"
            className="absolute inset-0 top-20 m-auto h-[420px] w-[420px] scale-150 rounded-full bg-blue-200/20 blur-3xl"
        />
        <div className="container mx-auto max-w-4xl px-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
              צור את עץ המשפחה שלך
            </h1>
            <p className="mt-4 text-xl text-slate-600">
              הסבר בטקסט, בהודעה קולית, או העלה מסמכים, והבינה המלאכותית תבנה עבורך
              את הבסיס.
            </p>

            <Card className="mt-12 text-left shadow-2xl shadow-blue-500/10">
                <CardHeader>
                <CardTitle>בניית עץ משפחה עם AI</CardTitle>
                <CardDescription>
                    תן שם לעץ שלך, ספר את סיפור המשפחה, וה-AI יעשה את השאר.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                <Input
                    placeholder="שם עץ המשפחה (לדוגמה: משפחת כהן)"
                    value={treeName}
                    onChange={(e) => setTreeName(e.target.value)}
                    className="text-lg"
                    disabled={disabledWhileBusy}
                />

                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>איך מתחילים?</AlertTitle>
                    <AlertDescription>
                    <ul className="list-disc pr-5 mt-2 space-y-1">
                        <li>התחילו מעצמכם: "שמי [שם], תאריך הלידה שלי הוא...".</li>
                        <li>המשיכו להורים: "ההורים שלי הם [שם האב] ו[שם האם]".</li>
                        <li>פרטו על אחים, בני זוג וילדים.</li>
                        <li>
                        ככל שתספקו יותר פרטים (תאריכים, מקומות), כך העץ יהיה מדויק
                        יותר.
                        </li>
                    </ul>
                    </AlertDescription>
                </Alert>

                <div
                    className="flex h-96 flex-col space-y-4 rounded-lg border bg-muted/20 p-4"
                    onDragEnter={handleDragOver}
                    onDragOver={handleDragOver}
                >
                    {isDragging && (
                        <div 
                            className="absolute inset-0 z-10 border-2 border-dashed border-primary rounded-lg bg-primary/10 flex items-center justify-center m-4"
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
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
                        <div
                            key={message.id}
                            className={`flex items-start gap-4 ${
                            message.role === 'user' ? 'justify-end' : ''
                            }`}
                        >
                            {message.role === 'assistant' && (
                            <Avatar className="h-8 w-8 border">
                                <AvatarFallback>
                                <Bot className="h-5 w-5" />
                                </AvatarFallback>
                            </Avatar>
                            )}
                            <div
                            className={`max-w-[75%] rounded-lg p-3 break-words ${
                                message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background'
                            }`}
                            >
                            {message.content}
                            {message.data?.isComplete && (
                                <div className="pt-2 text-right">
                                <Button onClick={() => handleCreateTreeFromAI(message.data)} disabled={isCreating}>
                                    {isCreating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                                    צור את העץ
                                </Button>
                                </div>
                            )}
                            </div>
                        </div>
                        ))}
                        {(isGenerating || isTranscribing) && (
                        <div className="flex items-start gap-4">
                            <Avatar className="h-8 w-8 border">
                            <AvatarFallback>
                                <Bot className="h-5 w-5" />
                            </AvatarFallback>
                            </Avatar>
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
                            placeholder="רשום כאן את סיפור המשפחה או העלה קבצים..."
                            className="pr-28 pl-12 h-20"
                            value={story}
                            onChange={(e) => setStory(e.target.value)}
                            onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(story);
                            }
                            }}
                            disabled={disabledWhileBusy}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)}
                                className="hidden"
                                accept="image/*,.pdf,.xlsx,.xls,.pptx,.mp3,.wav,.m4a,.ogg"
                                disabled={disabledWhileBusy}
                            />
                            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={disabledWhileBusy}>
                                <Paperclip className="h-5 w-5" />
                                <span className="sr-only">צרף קובץ</span>
                            </Button>
                            <Button variant={isRecording ? 'destructive' : 'ghost'} size="icon" onClick={handleMicClick} disabled={isTranscribing || isGenerating}>
                                {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                                <span className="sr-only">{isRecording ? 'עצור הקלטה' : 'הקלט הודעה'}</span>
                            </Button>
                        </div>
                        <Button
                            variant="default"
                            size="icon"
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            onClick={() => handleSend(story)}
                            disabled={disabledWhileBusy || (!story.trim() && !attachment)}
                        >
                            <Send className="h-5 w-5" />
                            <span className="sr-only">שלח</span>
                        </Button>
                    </div>
                </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">פלטפורמה אחת, יכולות אין-סוף</h2>
                <p className="mt-4 text-lg text-slate-600">כל מה שצריך כדי לחקור, לבנות, לנתח ולשתף את הסיפור המשפחתי שלך.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                    <motion.div
                        key={feature.imageId}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                        <FeatureCard {...feature} />
                    </motion.div>
                ))}
            </div>
        </div>
      </section>

      <div className="container mx-auto px-4">
        <SeparatorWithText text="או" />
        <div className="text-center my-12">
            <Button
            size="lg"
            variant="secondary"
            onClick={handleManualCreate}
            disabled={isCreatingManually || disabledWhileBusy}
            >
            {isCreatingManually ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
                <ArrowLeft className="ml-2 h-4 w-4" />
            )}
            התחל יצירה באופן ידני
            </Button>
        </div>

        <div className="my-20">
            <div className="relative mb-12">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center">
                    <span className="bg-background px-4 text-xl font-medium text-muted-foreground flex items-center gap-3">
                        <Globe className="h-6 w-6"/>
                        עצים ציבוריים
                    </span>
                </div>
            </div>

            {isLoadingPublicTrees ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : publicTrees.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">אין עדיין עצים ציבוריים.</p>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {publicTrees.map((tree) => (
                        <TreeCard
                            key={`public-${tree.id}`}
                            tree={tree}
                            type="public"
                        />
                    ))}
                </div>
            )}
        </div>
      </div>


      <AlertDialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>הרשמה נדרשת</AlertDialogTitle>
            <AlertDialogDescription>
              כדי לשמור את העבודה שלך וליצור עצי משפחה, יש ליצור חשבון או להתחבר.
              <br/><br/>
              הסיסמה חייבת להכיל לפחות 8 תווים.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction asChild>
                <Link href="/login">כניסה</Link>
            </AlertDialogAction>
            <AlertDialogAction asChild>
                <Link href="/register">הרשמה</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
