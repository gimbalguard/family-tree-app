'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ParsedExcelData } from '@/lib/excel-handler';

export type ImportMode = 'new' | 'merge' | 'replace';

type ImportConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  parsedData: ParsedExcelData | null;
  onConfirm: (mode: ImportMode) => void;
  isImporting: boolean;
};

export function ImportConfirmationModal({
  isOpen,
  onClose,
  parsedData,
  onConfirm,
  isImporting,
}: ImportConfirmationModalProps) {
  const [mode, setMode] = useState<ImportMode>('new');

  if (!parsedData) return null;

  const { people, relationships, manualEvents, treeName } = parsedData;

  const handleConfirm = () => {
    onConfirm(mode);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>אישור ייבוא</DialogTitle>
          <DialogDescription>
            נמצאו הנתונים הבאים בקובץ. בחר כיצד לייבא אותם.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="font-bold text-lg">{treeName || 'עץ ללא שם'}</p>
            <p className="text-sm text-muted-foreground">
              {people.length} אנשים · {relationships.length} קשרים · {manualEvents.length} אירועים
            </p>
          </div>

          <RadioGroup value={mode} onValueChange={(value: ImportMode) => setMode(value)} className="space-y-2">
            <Label
              htmlFor="mode-new"
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 has-[input:checked]:border-primary"
            >
              <RadioGroupItem value="new" id="mode-new" />
              <div className="text-right">
                <p className="font-semibold">צור עץ חדש</p>
                <p className="text-sm text-muted-foreground">
                  יוצר עץ חדש בחשבונך עם הנתונים מהקובץ. (מומלץ)
                </p>
              </div>
            </Label>
            <Label
              htmlFor="mode-merge"
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 has-[input:checked]:border-primary"
            >
              <RadioGroupItem value="merge" id="mode-merge" />
              <div className="text-right">
                <p className="font-semibold">הוסף לעץ הנוכחי</p>
                <p className="text-sm text-muted-foreground">
                  ממזג את הנתונים לעץ הפתוח. מדלג על אנשים וקשרים שכבר קיימים.
                </p>
              </div>
            </Label>
            <Label
              htmlFor="mode-replace"
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 has-[input:checked]:border-destructive"
            >
              <RadioGroupItem value="replace" id="mode-replace" />
              <div className="text-right">
                <p className="font-semibold">החלף את העץ הנוכחי</p>
                <p className="text-sm text-muted-foreground">
                  מוחק את כל הנתונים בעץ הנוכחי ומייבא את הנתונים מהקובץ במקומם.
                </p>
              </div>
            </Label>
          </RadioGroup>

          {mode === 'replace' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>אזהרה חמורה</AlertTitle>
              <AlertDescription>
                פעולה זו תמחק לצמיתות את כל הנתונים בעץ הנוכחי. לא ניתן לשחזר פעולה זו.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            ביטול
          </Button>
          <Button onClick={handleConfirm} disabled={isImporting}>
            {isImporting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            יבא
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
