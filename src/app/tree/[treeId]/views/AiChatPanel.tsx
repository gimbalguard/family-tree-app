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
import {
  Mic, Paperclip, Send, Loader2, Bot, StopCircle, X, GripVertical,
  Wand2, Search, SpellCheck, Lightbulb, Globe,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { generateTreeFromStory } from '@/ai/flows/ai-tree-generation-flow';
import type { GenerateTreeOutput } from '@/ai/flows/ai-tree-generation.types';
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAiChat, type ChatMessage } from '@/context/ai-chat-context';
import type { Person, Relationship, DesignPage, DesignElement } from '@/lib/types';
import { runDesignAssistant } from '@/ai/flows/design-assistant-flow';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface AiChatPanelProps {
    treeId: string;
    treeName: string;
    people: Person[];
    onClose: () => void;
    onDataAdded: () => void;
    context: 'tree-building' | 'design-assistant';
    currentPage?: DesignPage;
    onApplyDesignChanges?: (elements: DesignElement[]) => void;
}

const AttachmentPreview = ({ attachment, onRemove }: { attachment: { file: File }, onRemove: () => void }) => (
    <div className="flex items-center gap-2 p-2 mb-2 border rounded-lg bg-background">
        <Paperclip className="h-4 w-4 text-muted-foreground"/>
        <span className="text-sm text-muted-foreground flex-1 truncate">{attachment.file.name}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
            <X className="h-4 w-4"/>
        </Button>
    </div>
);

// ─── Quick action chips shown above the input ───────────────
interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

function getQuickActions(context: AiChatPanelProps['context'], currentPage?: DesignPage): QuickAction[] {
  if (context === 'design-assistant') {
    return [
      {
        id: 'suggest_subjects',
        label: 'נושאים לעמוד',
        icon: <Lightbulb className="h-3 w-3" />,
        prompt: `אני עובד על עמוד בשם "${currentPage?.title || 'עמוד'}". תציע לי 5 נושאים או תכנים רלוונטיים שאוכל להוסיף לעמוד הזה בעבודת השורשים שלי.`,
      },
      {
        id: 'rephrase',
        label: 'שפר ניסוח',
        icon: <SpellCheck className="h-3 w-3" />,
        prompt: 'עבור על כל תיבות הטקסט בעמוד הזה. תיקן שגיאות כתיב, שפר את הניסוח ועשה את הטקסט ברור יותר — שמור על אותו תוכן ואורך בערך.',
      },
      {
        id: 'bigger_text',
        label: 'הגדל טקסט',
        icon: <span className="text-[10px] font-bold">A+</span>,
        prompt: 'הגדל את גודל כל הטקסטים בעמוד ב-20%.',
      },
      {
        id: 'align_grid',
        label: 'סדר ברשת',
        icon: <span className="text-[10px]">⊞</span>,
        prompt: 'סדר את כל אלמנטי התמונה והכרטיסים בעמוד בצורת רשת מסודרת ואסתטית.',
      },
      {
        id: 'dark_bg',
        label: 'רקע כהה',
        icon: <span className="text-[10px]">🌙</span>,
        prompt: 'שנה את צבעי הרקע של הצורות לגוונים כהים ועמוקים יותר.',
      },
    ];
  }

  // tree-building context
  return [
    {
      id: 'research_person',
      label: 'חפש מידע',
      icon: <Globe className="h-3 w-3" />,
      prompt: 'חפש לי מידע באינטרנט על אחד האנשים בעץ המשפחה שלי. מי תרצה שאחפש עליו?',
    },
    {
      id: 'suggest_questions',
      label: 'שאלות לראיון',
      icon: <Lightbulb className="h-3 w-3" />,
      prompt: 'תציע לי 10 שאלות טובות לראיון סבא או סבתא לצורך עבודת השורשים שלי.',
    },
    {
      id: 'rephrase_story',
      label: 'שפר סיפור',
      icon: <SpellCheck className="h-3 w-3" />,
      prompt: 'שפר ותקן את הטקסט הבא שכתבתי — ',
    },
    {
      id: 'history_context',
      label: 'הקשר היסטורי',
      icon: <Search className="h-3 w-3" />,
      prompt: 'ספר לי על ההיסטוריה של ישראל בשנות ה-50 וה-60 כדי שאוכל לקשר אותה לסיפור המשפחתי שלי.',
    },
  ];
}

export function AiChatPanel({
    treeId,
    treeName,
    people,
    onClose,
    onDataAdded,
    context,
    currentPage,
    onApplyDesignChanges,
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
    setIsTranscribing
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

  // Drag to reposition panel
  const [position, setPosition] = useState({ x: 30, y: 30 });
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const quickActions = getQuickActions(context, currentPage);

  const handlePanelDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, textarea, input')) return;
    setIsPanelDragging(true);
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragStartPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.addEventListener('mousemove', handlePanelDragMove);
    document.addEventListener('mouseup', handlePanelDragEnd);
  };

  const handlePanelDragMove = (e: MouseEvent) => {
    setPosition({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
  };

  const handlePanelDragEnd = () => {
    setIsPanelDragging(false);
    document.removeEventListener('mousemove', handlePanelDragMove);
    document.removeEventListener('mouseup', handlePanelDragEnd);
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
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
        mediaRecorderRef.current.ondataavailable = (event) => { audioChunksRef.current.push(event.data); };
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
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'קובץ גדול מדי', description: 'גודל הקובץ המקסימלי הוא 10MB.' });
      return;
    }
    setAttachment(null);
    const fileType = file.type;
    const fileName = file.name;
    if (fileType.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => { setAttachment({ file, type: 'image', data: e.target?.result as string }); };
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
            fullText += `--- ${sheetName} ---\n${XLSX.utils.sheet_to_txt(worksheet)}\n\n`;
          });
          setAttachment({ file, type: 'text', data: fullText });
        } catch (error) {
          toast({ variant: 'destructive', title: 'שגיאה בעיבוד הקובץ', description: 'לא ניתן היה לקרוא את קובץ האקסל.' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (fileType.startsWith('audio/')) {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(), role: 'assistant',
        content: `קובץ שמע צורף: "${fileName}". ניתוח קבצי שמע אינו נתמך כרגע.`,
        textContent: `קובץ שמע צורף: "${fileName}". ניתוח קבצי שמע אינו נתמך כרגע.`,
      };
      setChatHistory(prev => [...prev, assistantMessage]);
    } else {
      toast({ variant: 'destructive', title: 'סוג קובץ לא נתמך' });
    }
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isPanelDragging) setIsFileHovering(true);
  };
  const handleFileDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsFileHovering(false); };
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsFileHovering(false);
    if (!isPanelDragging && e.dataTransfer.files?.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleAddDataToTree = async (data: GenerateTreeOutput | null) => {
    if (!data || !user || !db || !treeId) {
      toast({ variant: 'destructive', title: 'שגיאה', description: 'נתונים חסרים להוספה לעץ.' });
      return;
    }
    setIsAdding(true);
    try {
      const batch = writeBatch(db);
      const tempIdToFirestoreId: Record<string, string> = {};
      data.people?.forEach((person) => {
        const personDocRef = doc(collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'));
        tempIdToFirestoreId[person.key] = personDocRef.id;
        const { key, ...personData } = person;
        batch.set(personDocRef, { ...personData, userId: user.uid, treeId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      data.relationships?.forEach((rel) => {
        const personAId = tempIdToFirestoreId[rel.personAKey];
        const personBId = tempIdToFirestoreId[rel.personBKey];
        if (personAId && personBId) {
          const relDocRef = doc(collection(db, 'users', user.uid, 'familyTrees', treeId, 'relationships'));
          const { personAKey, personBKey, ...relData } = rel;
          batch.set(relDocRef, { ...relData, personAId, personBId, userId: user.uid, treeId });
        }
      });
      await batch.commit();
      toast({ title: 'הנתונים נוספו בהצלחה!', description: `המידע החדש נוסף לעץ "${treeName}"` });
      onDataAdded();
    } catch (error) {
      console.error('Error adding data to tree:', error);
      toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה להוסיף את הנתונים לעץ המשפחה. נסה שוב.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleSend = async (messageContent: string) => {
    if ((!messageContent.trim() && !attachment) || !user) return;
    if (user.isAnonymous) {
      toast({ variant: 'destructive', title: 'נדרש אימות', description: 'כדי להשתמש ב-AI, עליך להתחבר.' });
      router.push('/login');
      return;
    }

    const userMessageContent = (
      <div className="space-y-2 text-right">
        {attachment?.type === 'image' && <img src={attachment.data} alt={attachment.file.name} className="max-h-48 w-auto rounded-md border" />}
        {attachment && <p className="text-sm italic opacity-80 border-t border-white/20 pt-2 mt-2">קובץ מצורף: {attachment.file.name}</p>}
        {messageContent && <p>{messageContent}</p>}
      </div>
    );

    const userMessage: ChatMessage = {
      id: Date.now().toString(), role: 'user',
      content: userMessageContent, textContent: messageContent,
    };

    setStory('');
    const currentAttachment = attachment;
    setAttachment(null);
    setChatHistory(prev => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      if (context === 'design-assistant') {
        if (!currentPage || !onApplyDesignChanges) throw new Error("Design context not available.");

        const result = await runDesignAssistant({ elements: currentPage.elements, prompt: messageContent });
        onApplyDesignChanges(result.updatedElements);

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(), role: 'assistant',
          content: (
            <div className="space-y-2 text-right">
              <p className="text-green-400 font-medium">✓ השינויים בוצעו בעמוד.</p>
              <p className="text-sm text-muted-foreground">אפשר לבקש שינויים נוספים או לבטל עם Ctrl+Z.</p>
            </div>
          ),
          textContent: "ביצעתי את השינויים שביקשת בעמוד.",
        };
        setChatHistory(prev => [...prev, assistantMessage]);

      } else {
        // tree-building context
        const historyForAI = [...chatHistory, userMessage];
        const flowInput: any = {
          newUserMessage: messageContent,
          treeName,
          chatHistory: historyForAI.map(m => ({ role: m.role, content: m.textContent })),
          existingPeople: people.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })),
        };
        if (currentAttachment?.type === 'image') flowInput.photoDataUri = currentAttachment.data;
        if (currentAttachment?.type === 'text') flowInput.newUserMessage = `[קובץ מצורף: ${currentAttachment.file.name}]\n[תוכן:]\n${currentAttachment.data}\n\n${messageContent}`;

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
                          <Button key={i} size="sm" variant="outline" onClick={() => handleSend(ans)}>{ans}</Button>
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
          id: (Date.now() + 1).toString(), role: 'assistant',
          content: assistantMessageContent, textContent: result.summary,
          data: result.isComplete ? result : null,
        };
        setChatHistory(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('AI assistant error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'מצטער, נתקלתי בשגיאה. נוכל לנסות שוב?',
        textContent: 'מצטער, נתקלתי בשגיאה. נוכל לנסות שוב?',
      };
      setChatHistory(prev => [...prev, errorMessage]);
      toast({ variant: 'destructive', title: 'שגיאת AI', description: 'לא ניתן היה לעבד את הבקשה.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const disabledWhileBusy = isGenerating || isRecording || isTranscribing;
  const placeholder = context === 'design-assistant'
    ? "בקש שינוי עיצוב, למשל 'הפוך את הרקע לכחול'..."
    : "ספר על אדם או קשר כדי להוסיף לעץ...";
  const title = context === 'design-assistant' ? 'עורך AI' : 'עוזר AI';
  const Icon = context === 'design-assistant' ? Wand2 : Bot;

  const emptyStateText = context === 'design-assistant'
    ? 'אני יכול לעזור לך לעצב את העמוד.\nלחץ על אחד הכפתורים למטה או כתוב בקשה חופשית.'
    : 'הודעות הצ\'אט יופיעו כאן...\nספר לי על בני המשפחה שלך.';

  return (
    <div
      ref={panelRef}
      className="fixed bottom-8 right-8 z-[1050] w-full min-w-[320px]"
      style={{ transform: `translate(${position.x}px, ${position.y}px)`, cursor: isPanelDragging ? 'grabbing' : 'default', maxWidth: '90vw' }}
      onDragEnter={handleFileDragOver}
      onDragOver={handleFileDragOver}
    >
      <Card className="flex flex-col shadow-2xl h-[60vh] min-h-[400px] resize overflow-hidden bg-gradient-to-br from-gray-900/90 via-slate-800/90 to-gray-900/90 border-slate-700 backdrop-blur-sm">
        <CardHeader
          className="flex-row items-center justify-between space-y-0 py-3 px-4 border-b border-slate-700 cursor-grab"
          onMouseDown={handlePanelDragStart}
        >
          <div className="flex items-center gap-2 text-primary-foreground">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <Icon className={cn("h-5 w-5", context === 'design-assistant' ? 'text-teal-400' : 'text-indigo-400')} />
            <CardTitle className="text-lg">{title}</CardTitle>
            {currentPage && context === 'design-assistant' && (
              <span className="text-[10px] text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                {currentPage.title}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <div className="p-4 flex-1 flex flex-col min-h-0 gap-3">
          {/* Chat history */}
          <div className="relative flex-1 min-h-0">
            {isFileHovering && (
              <div
                className="absolute inset-0 z-10 border-2 border-dashed border-primary rounded-lg bg-primary/10 flex items-center justify-center"
                onDragLeave={handleFileDragLeave}
                onDrop={handleFileDrop}
              >
                <span className="font-bold text-primary">שחרר קובץ כאן</span>
              </div>
            )}
            <ScrollArea className="h-full" ref={scrollAreaRef}>
              <div className="pr-4 space-y-6">
                {chatHistory.length === 0 && !isTranscribing && (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-center py-6">
                    <div className="space-y-2">
                      <Icon className={cn("h-8 w-8 mx-auto opacity-30", context === 'design-assistant' ? 'text-teal-400' : 'text-indigo-400')} />
                      <p className="text-sm whitespace-pre-line">{emptyStateText}</p>
                    </div>
                  </div>
                )}
                {chatHistory.map((message) => (
                  <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.role === 'assistant' && (
                      <Avatar className="h-8 w-8 border flex-shrink-0">
                        <AvatarFallback><Icon className="h-5 w-5" /></AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[75%] rounded-lg p-3 break-words ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
                      {message.content}
                      {message.data?.isComplete && context === 'tree-building' && (
                        <div className="pt-2 text-right">
                          <Button onClick={() => handleAddDataToTree(message.data)} disabled={isAdding}>
                            {isAdding && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            הוסף לעץ
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(isGenerating || isTranscribing) && (
                  <div className="flex items-start gap-4">
                    <Avatar className="h-8 w-8 border flex-shrink-0">
                      <AvatarFallback><Icon className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                    <div className="max-w-[75%] rounded-lg bg-background p-3 flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">{isTranscribing ? 'מתמלל הקלטה...' : context === 'design-assistant' ? 'מעדכן עיצוב...' : 'חושב...'}</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Quick action chips */}
          <div className="flex flex-wrap gap-1.5 flex-shrink-0">
            {quickActions.map(action => (
              <button
                key={action.id}
                disabled={disabledWhileBusy}
                onClick={() => handleSend(action.prompt)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                  'bg-slate-800/80 border-slate-600 text-slate-300 hover:border-indigo-400 hover:text-white hover:bg-slate-700',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  context === 'design-assistant' ? 'hover:border-teal-500' : 'hover:border-indigo-400'
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="relative shrink-0">
            {attachment && <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} />}
            <Textarea
              placeholder={placeholder}
              className="pr-28 pl-12 h-20 bg-background/80 text-sm"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(story); } }}
              disabled={disabledWhileBusy}
              dir="rtl"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <input
                type="file" ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)}
                className="hidden" accept="image/*,.pdf,.xlsx,.xls,.pptx,.mp3,.wav,.m4a,.ogg"
                disabled={disabledWhileBusy}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} disabled={disabledWhileBusy}>
                <Paperclip className="h-4 w-4" /><span className="sr-only">צרף קובץ</span>
              </Button>
              <Button variant={isRecording ? 'destructive' : 'ghost'} size="icon" className="h-7 w-7" onClick={handleMicClick} disabled={isTranscribing || isGenerating}>
                {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span className="sr-only">{isRecording ? 'עצור הקלטה' : 'הקלט הודעה'}</span>
              </Button>
            </div>
            <Button
              variant="default" size="icon"
              className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-7 w-7", context === 'design-assistant' ? 'bg-teal-600 hover:bg-teal-500' : '')}
              onClick={() => handleSend(story)}
              disabled={disabledWhileBusy || (!story.trim() && !attachment)}
            >
              <Send className="h-4 w-4" /><span className="sr-only">שלח</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}