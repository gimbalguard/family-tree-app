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
import { Mic, Paperclip, Send, Loader2, ArrowLeft, Bot } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { generateTreeFromStory } from '@/ai/flows/ai-tree-generation-flow';
import type { GenerateTreeOutput } from '@/ai/flows/ai-tree-generation.types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: React.ReactNode;
}

function SeparatorWithText({ text }: { text: string }) {
  return (
    <div className="relative my-8">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">
          {text}
        </span>
      </div>
    </div>
  );
}

export function AiBuildClient() {
  const router = useRouter();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isCreatingManually, setIsCreatingManually] = useState(false);
  const [treeName, setTreeName] = useState('עץ משפחה חדש');
  const [story, setStory] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedData, setGeneratedData] =
    useState<GenerateTreeOutput | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatHistory]);

  const handleManualCreate = async () => {
    setIsCreatingManually(true);
    if (!user || user.isAnonymous || !db) {
      toast({
        variant: 'destructive',
        title: 'נדרש אימות',
        description: 'כדי ליצור עץ, עליך להתחבר.',
      });
      router.push('/login');
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

  const handleSendStory = async () => {
    if (!story.trim() || !user) return;
    if (!treeName.trim()) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'אנא תן שם לעץ המשפחה שלך.',
      });
      return;
    }
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
    setGeneratedData(null);

    try {
      const result = await generateTreeFromStory({ story, treeName });
      setGeneratedData(result);

      const assistantMessageContent = (
        <div className="space-y-4">
          <p>{result.summary}</p>
          {result.clarificationQuestion ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>שאלה להבהרה</AlertTitle>
              <AlertDescription>
                {result.clarificationQuestion}
              </AlertDescription>
            </Alert>
          ) : (
            <Button onClick={handleCreateTreeFromAI} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : null}
              צור את העץ
            </Button>
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
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'מצטער, נתקלתי בשגיאה בעת ניתוח הסיפור שלך. נסה לנסח מחדש או נסה שוב מאוחר יותר.',
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

  const handleCreateTreeFromAI = async () => {
    if (!generatedData || !user || !db) return;
    setIsCreating(true);

    try {
      // 1. Create the new FamilyTree document
      const treeDocRef = await addDoc(
        collection(db, 'users', user.uid, 'familyTrees'),
        {
          treeName: treeName,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      const treeId = treeDocRef.id;

      // 2. Prepare a batch write for all people and relationships
      const batch = writeBatch(db);
      const tempIdToFirestoreId: Record<string, string> = {};

      // 3. Add people to the batch
      generatedData.people.forEach((person) => {
        const personDocRef = doc(
          collection(db, 'users', user.uid, 'familyTrees', treeId, 'people')
        );
        tempIdToFirestoreId[person.key] = personDocRef.id;
        batch.set(personDocRef, {
          ...person,
          userId: user.uid,
          treeId: treeId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // 4. Add relationships to the batch
      generatedData.relationships.forEach((rel) => {
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
          batch.set(relDocRef, {
            ...rel,
            personAId,
            personBId,
            userId: user.uid,
            treeId: treeId,
          });
        }
      });

      // 5. Commit the batch
      await batch.commit();

      toast({
        title: 'עץ נוצר בהצלחה!',
        description: `כעת תועבר לעץ החדש שלך: "${treeName}"`,
      });

      // 6. Navigate to the new tree
      router.push(`/tree/${treeId}`);
    } catch (error) {
      console.error('Error creating tree from AI data:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה ליצור את עץ המשפחה. נסה שוב.',
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          צור את עץ המשפחה שלך
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          הסבר בטקסט, בהודעה קולית, או העלה מסמכים, והבינה המלאכותית תבנה עבורך
          את הבסיס.
        </p>
      </div>

      <Card className="mb-8">
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

          <div className="flex h-96 flex-col space-y-4 rounded-lg border bg-muted/20 p-4">
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              <div className="pr-4 space-y-6">
                {chatHistory.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <p>הודעות הצ'אט יופיעו כאן...</p>
                  </div>
                ) : (
                  chatHistory.map((message) => (
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
                        className={`max-w-[75%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))
                )}
                {isGenerating && (
                  <div className="flex items-start gap-4">
                    <Avatar className="h-8 w-8 border">
                      <AvatarFallback>
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[75%] rounded-lg bg-background p-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="relative mt-4">
              <Textarea
                placeholder="רשום כאן את סיפור המשפחה או העלה קבצים..."
                className="pr-28 pl-12 h-20"
                value={story}
                onChange={(e) => setStory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendStory();
                  }
                }}
                disabled={isGenerating}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled>
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">צרף קובץ</span>
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <Mic className="h-5 w-5" />
                  <span className="sr-only">הקלט הודעה</span>
                </Button>
              </div>
              <Button
                variant="default"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2"
                onClick={handleSendStory}
                disabled={isGenerating || !story.trim()}
              >
                <Send className="h-5 w-5" />
                <span className="sr-only">שלח</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SeparatorWithText text="או" />

      <div className="text-center mt-8">
        <Button
          size="lg"
          onClick={handleManualCreate}
          disabled={isCreatingManually}
        >
          {isCreatingManually ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowLeft className="ml-2 h-4 w-4" />
          )}
          התחל יצירה באופן ידני
        </Button>
      </div>
    </div>
  );
}
