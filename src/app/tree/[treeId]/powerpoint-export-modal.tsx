'use client';

import { useState, useMemo, useEffect } from 'react';
import PptxGenJS from 'pptxgenjs';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Presentation } from 'lucide-react';
import type { FamilyTree, Person, Relationship } from '@/lib/types';
import { exportToPowerPoint } from '@/lib/powerpoint-handler';
import { format } from 'date-fns';

export type PptxExportTheme = 'light' | 'dark' | 'family';
export type PptxExportOptions = {
  title: string;
  theme: PptxExportTheme;
  includeTitle: boolean;
  includePersonSlides: boolean;
  includeGenerations: boolean;
  includeStats: boolean;
  includeEnding: boolean;
};

type PowerPointExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tree: FamilyTree | null;
  people: Person[];
  relationships: Relationship[];
  onSave: (blob: Blob, fileName: string) => Promise<void>;
};

export function PowerPointExportModal({ isOpen, onClose, tree, people, relationships, onSave }: PowerPointExportModalProps) {
  const { toast } = useToast();
  const defaultTitle = useMemo(() => tree?.treeName || 'עץ המשפחה שלי', [tree]);
  
  const [options, setOptions] = useState<PptxExportOptions>({
    title: defaultTitle,
    theme: 'dark',
    includeTitle: true,
    includePersonSlides: true,
    includeGenerations: true,
    includeStats: true,
    includeEnding: true,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ text: '', percentage: 0 });

  useEffect(() => {
    if (isOpen) {
      setOptions(prev => ({ ...prev, title: defaultTitle }));
      setIsExporting(false);
      setProgress({ text: '', percentage: 0});
    }
  }, [isOpen, defaultTitle]);

  const handleExport = async () => {
    if (!tree) return;
    setIsExporting(true);
    setProgress({ text: 'מתחיל...', percentage: 0 });

    try {
      const blob = await exportToPowerPoint({
        options,
        tree,
        people,
        relationships,
        onProgress: (p) => setProgress(p)
      });
      
      const fileName = `משפחת-${tree.treeName}-${format(new Date(), 'yyyy-MM-dd')}.pptx`;
      
      await onSave(blob, fileName);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast({ title: 'המצגת הורדה בהצלחה 📑' });
    } catch (error) {
      console.error('PowerPoint export failed:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה בייצוא PowerPoint',
        description: 'נסה שוב. אם הבעיה נמשכת, בדוק את הקונסול.',
      });
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        {isExporting && (
          <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg mb-2">מייצר מצגת...</p>
            <p className="text-sm text-muted-foreground">{progress.text} ({Math.round(progress.percentage)}%)</p>
          </div>
        )}
        <DialogHeader className="text-right">
          <DialogTitle>ייצוא PowerPoint</DialogTitle>
          <DialogDescription>הגדר את אפשרויות הייצוא למצגת.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ppt-title">כותרת המצגת</Label>
            <Input id="ppt-title" value={options.title} onChange={(e) => setOptions({...options, title: e.target.value})} />
          </div>

          <div className="grid gap-2">
            <Label>עיצוב</Label>
            <RadioGroup value={options.theme} onValueChange={(value: PptxExportTheme) => setOptions({...options, theme: value})} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="light" id="t-light" /><Label htmlFor="t-light">בהיר</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="dark" id="t-dark" /><Label htmlFor="t-dark">כהה</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="family" id="t-family" /><Label htmlFor="t-family">משפחתי</Label></div>
            </RadioGroup>
          </div>
          
          <div className="grid gap-2">
             <Label>מה לכלול</Label>
             <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                 <div className="flex items-center gap-2"><Checkbox id="inc-title" checked={options.includeTitle} onCheckedChange={(c) => setOptions({...options, includeTitle: !!c})} /><Label htmlFor="inc-title">שקף פתיחה</Label></div>
                 <div className="flex items-center gap-2"><Checkbox id="inc-persons" checked={options.includePersonSlides} onCheckedChange={(c) => setOptions({...options, includePersonSlides: !!c})} /><Label htmlFor="inc-persons">שקף לכל אדם</Label></div>
                 <div className="flex items-center gap-2"><Checkbox id="inc-gens" checked={options.includeGenerations} onCheckedChange={(c) => setOptions({...options, includeGenerations: !!c})} /><Label htmlFor="inc-gens">שקפי דורות</Label></div>
                 <div className="flex items-center gap-2"><Checkbox id="inc-stats" checked={options.includeStats} onCheckedChange={(c) => setOptions({...options, includeStats: !!c})} /><Label htmlFor="inc-stats">שקף סטטיסטיקות</Label></div>
                 <div className="flex items-center gap-2"><Checkbox id="inc-end" checked={options.includeEnding} onCheckedChange={(c) => setOptions({...options, includeEnding: !!c})} /><Label htmlFor="inc-end">שקף סיום</Label></div>
             </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
          <Button type="button" onClick={handleExport}>
            <Presentation className="ml-2 h-4 w-4" />
            ייצא מצגת
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
