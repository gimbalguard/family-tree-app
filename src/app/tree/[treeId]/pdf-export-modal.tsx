'use client';

import { useState, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import { useReactFlow } from 'reactflow';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, File as FileIcon } from 'lucide-react';
import type { FamilyTree } from '@/lib/types';

type PdfExportOptions = {
  title: string;
  orientation: 'portrait' | 'landscape';
  quality: 'normal' | 'high' | 'max';
  scope: 'current' | 'full';
  includeNames: boolean;
  includeImages: boolean;
};

type PdfExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tree: FamilyTree | null;
};

export function PdfExportModal({ isOpen, onClose, tree }: PdfExportModalProps) {
  const { toast } = useToast();
  const { getNodes, getViewport, setViewport, fitView } = useReactFlow();

  const defaultTitle = useMemo(() => tree?.treeName || 'My Family Tree', [tree]);
  
  const [options, setOptions] = useState<PdfExportOptions>({
    title: defaultTitle,
    orientation: 'landscape',
    quality: 'high',
    scope: 'current',
    includeNames: true,
    includeImages: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOptions(prev => ({ ...prev, title: defaultTitle }));
    }
  }, [isOpen, defaultTitle]);

  const handleExport = async () => {
    setIsExporting(true);

    const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
    if (!reactFlowElement) {
        toast({ variant: 'destructive', title: 'שגיאה בייצוא', description: 'רכיב הקנבס לא נמצא.' });
        setIsExporting(false);
        return;
    }
    
    // Create temporary header and footer for capture
    const headerEl = document.createElement('div');
    headerEl.style.position = 'absolute';
    headerEl.style.top = '20px';
    headerEl.style.left = '20px';
    headerEl.style.right = '20px';
    headerEl.style.zIndex = '20';
    headerEl.style.direction = 'rtl';
    headerEl.style.fontFamily = 'Rubik, sans-serif';
    headerEl.style.pointerEvents = 'none';
    headerEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; background: hsla(var(--background), 0.7); padding: 5px 10px; border-radius: 6px;">
            <h1 style="font-size: 1.25rem; font-weight: 600; color: hsl(var(--foreground));">${options.title}</h1>
            <p style="font-size: 0.8rem; color: hsl(var(--muted-foreground));">הופק בתאריך: ${new Date().toLocaleDateString('he-IL')}</p>
        </div>
    `;

    const footerEl = document.createElement('div');
    footerEl.style.position = 'absolute';
    footerEl.style.bottom = '10px';
    footerEl.style.left = '10px';
    footerEl.style.fontSize = '0.7rem';
    footerEl.style.color = 'hsl(var(--muted-foreground))';
    footerEl.style.zIndex = '20';
    footerEl.style.pointerEvents = 'none';
    footerEl.innerHTML = 'נוצר באמצעות FamilyTree';

    document.body.classList.add('pdf-export-mode');
    reactFlowElement.appendChild(headerEl);
    reactFlowElement.appendChild(footerEl);

    const previousViewport = getViewport();

    // Give DOM time to update before capture
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      if (options.scope === 'full') {
        const nodes = getNodes();
        if (nodes.length > 0) {
            await fitView({ padding: 0.1, duration: 0 });
            await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      const canvas = await html2canvas(reactFlowElement, {
        scale: options.quality === 'max' ? 3 : options.quality === 'high' ? 2 : 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: 'hsl(var(--background))',
        logging: false,
      });

      const orientation = options.orientation === 'landscape' ? 'l' : 'p';
      const pdf = new jsPDF(orientation, 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgProps = pdf.getImageProperties(imgData);
      
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${options.title.replace(/ /g, '_')}-${new Date().getFullYear()}.pdf`);
      
      toast({ title: 'קובץ PDF הורד בהצלחה ✓' });

    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה בייצוא PDF',
        description: 'נסה שוב. אם הבעיה נמשכת, בדוק את הקונסול.',
      });
    } finally {
        if (options.scope === 'full') {
            setViewport(previousViewport, { duration: 0 });
        }
        document.body.classList.remove('pdf-export-mode');
        if (reactFlowElement.contains(headerEl)) reactFlowElement.removeChild(headerEl);
        if (reactFlowElement.contains(footerEl)) reactFlowElement.removeChild(footerEl);
        setIsExporting(false);
        onClose();
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        {isExporting && (
          <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg">מייצא PDF...</p>
          </div>
        )}
        <DialogHeader className="text-right">
          <DialogTitle>ייצוא PDF</DialogTitle>
          <DialogDescription>הגדר את אפשרויות הייצוא לקובץ PDF.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="doc-title">כותרת המסמך</Label>
            <Input id="doc-title" value={options.title} onChange={(e) => setOptions({...options, title: e.target.value})} />
          </div>

          <div className="grid gap-2">
            <Label>כיוון דף</Label>
            <RadioGroup
              value={options.orientation}
              onValueChange={(value: 'portrait' | 'landscape') => setOptions({...options, orientation: value})}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2"><RadioGroupItem value="portrait" id="p-portrait" /><Label htmlFor="p-portrait">לאורך</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="landscape" id="p-landscape" /><Label htmlFor="p-landscape">לרוחב</Label></div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label>איכות</Label>
             <RadioGroup
              value={options.quality}
              onValueChange={(value: 'normal' | 'high' | 'max') => setOptions({...options, quality: value})}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2"><RadioGroupItem value="normal" id="q-normal" /><Label htmlFor="q-normal">רגילה</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="high" id="q-high" /><Label htmlFor="q-high">גבוהה</Label></div>
               <div className="flex items-center gap-2"><RadioGroupItem value="max" id="q-max" /><Label htmlFor="q-max">מקסימלית</Label></div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label>מה לייצא</Label>
             <RadioGroup
              value={options.scope}
              onValueChange={(value: 'current' | 'full') => setOptions({...options, scope: value})}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2"><RadioGroupItem value="current" id="s-current" /><Label htmlFor="s-current">תצוגה נוכחית</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="full" id="s-full" /><Label htmlFor="s-full">כל העץ</Label></div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="include-names" checked={options.includeNames} onCheckedChange={(checked) => setOptions({...options, includeNames: !!checked})} disabled />
                <Label htmlFor="include-names" className="opacity-50">כלול שמות</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="include-images" checked={options.includeImages} onCheckedChange={(checked) => setOptions({...options, includeImages: !!checked})} disabled />
                <Label htmlFor="include-images" className="opacity-50">כלול תמונות</Label>
              </div>
          </div>

        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
          <Button type="button" onClick={handleExport}>
            <FileIcon className="ml-2 h-4 w-4" />
            ייצא PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
