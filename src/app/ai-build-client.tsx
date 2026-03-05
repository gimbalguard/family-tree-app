'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Paperclip, Send, Loader2, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

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
      const docRef = await addDoc(collection(db, 'users', user.uid, 'familyTrees'), treeData);
      toast({
        title: 'עץ חדש נוצר',
        description: 'כעת תועבר לקנבס כדי להתחיל בבנייה.',
      });
      router.push(`/tree/${docRef.id}`);
    } catch (error) {
      console.error("Error creating new tree:", error);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה ליצור עץ משפחה חדש. נסה שוב.',
      });
      setIsCreatingManually(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          צור את עץ המשפחה שלך
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          הסבר בטקסט, בהודעה קולית, או העלה מסמכים, והבינה המלאכותית תבנה עבורך את הבסיס.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>בניית עץ משפחה עם AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>איך מתחילים?</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pr-5 mt-2 space-y-1">
                <li>התחילו מעצמכם: "שמי [שם], תאריך הלידה שלי הוא...".</li>
                <li>המשיכו להורים: "ההורים שלי הם [שם האב] ו[שם האם]".</li>
                <li>פרטו על אחים, בני זוג וילדים.</li>
                <li>ככל שתספקו יותר פרטים (תאריכים, מקומות), כך העץ יהיה מדויק יותר.</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex-grow flex flex-col space-y-4 p-4 border rounded-lg h-72 bg-muted/20 overflow-y-auto">
            {/* Chat messages will go here */}
            <div className="text-center text-muted-foreground p-8">
              הודעות הצ'אט יופיעו כאן...
            </div>
          </div>

          <div className="relative">
            <Textarea
              placeholder="רשום כאן את סיפור המשפחה או העלה קבצים..."
              className="pr-28 pl-12 h-20"
              disabled // disabled for now
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
            <Button variant="default" size="icon" className="absolute left-3 top-1/2 -translate-y-1/2" disabled>
              <Send className="h-5 w-5" />
              <span className="sr-only">שלח</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <SeparatorWithText text="או" />

      <div className="text-center mt-8">
        <Button size="lg" onClick={handleManualCreate} disabled={isCreatingManually}>
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
