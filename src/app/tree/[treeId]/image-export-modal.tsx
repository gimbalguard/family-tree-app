
'use client';

import { useState, useMemo, useEffect } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { useToast } from '@/hooks/use-toast';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import type { FamilyTree, ExportedFile } from '@/lib/types';
import { format } from 'date-fns';

type ImageExportOptions = {
  format: 'png' | 'jpg';
  quality: 1 | 2 | 3;
  includeTitle: boolean;
};

type ImageExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tree: FamilyTree | null;
  onSave: (blob: Blob, fileName: string, fileType: ExportedFile['fileType']) => Promise<void>;
};

export function ImageExportModal({ isOpen, onClose, tree, onSave }: ImageExportModalProps) {
  const { toast } = useToast();
  
  const [options, setOptions] = useState<ImageExportOptions>({
    format: 'png',
    quality: 1,
    includeTitle: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsExporting(false);
      setOptions({
        format: 'png',
        quality: 1,
        includeTitle: true,
      });
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!tree) return;
    setIsExporting(true);

    const captureTarget = document.querySelector('.react-flow') as HTMLElement;
    if (!captureTarget) {
      toast({ variant: 'destructive', title: 'שגיאה בייצוא', description: 'רכיב הקנבס לא נמצא.' });
      setIsExporting(false);
      return;
    }

    document.body.classList.add('pdf-export-mode');

    const exportStyle = document.createElement('style');
    exportStyle.id = 'export-edge-fix';
    exportStyle.textContent = `
      .react-flow__edges { overflow: visible !important; }
      .react-flow__edge path { 
        stroke: #26a69a !important; 
        stroke-width: 2px !important; 
        fill: none !important;
        visibility: visible !important;
        opacity: 1 !important;
        display: block !important;
      }
      .react-flow__edge-path {
        stroke: #26a69a !important;
        stroke-width: 2px !important;
        fill: none !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .react-flow__edges svg {
        overflow: visible !important;
      }
    `;
    document.head.appendChild(exportStyle);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const dataUrl = options.format === 'jpg'
        ? await toJpeg(captureTarget, { quality: 0.95, pixelRatio: options.quality, skipFonts: true })
        : await toPng(captureTarget, { pixelRatio: options.quality, skipFonts: true });
      
      document.getElementById('export-edge-fix')?.remove();

      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => { img.onload = resolve; });

      const headerHeight = options.includeTitle ? 50 : 0;
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = img.width;
      finalCanvas.height = img.height + (headerHeight * options.quality);
      const ctx = finalCanvas.getContext('2d');
      
      if (ctx) {
        // Draw background
        ctx.fillStyle = window.getComputedStyle(document.body).backgroundColor;
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        // Draw header if needed
        if (options.includeTitle) {
          ctx.fillStyle = '#26a69a'; // Teal color
          ctx.fillRect(0, 0, finalCanvas.width, headerHeight * options.quality);
          ctx.font = `bold ${20 * options.quality}px Rubik`;
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          const textY = (headerHeight * options.quality) / 2 + (7 * options.quality);
          ctx.fillText(tree.treeName, finalCanvas.width / 2, textY);
        }
        
        // Draw main content
        ctx.drawImage(img, 0, headerHeight * options.quality);
      }

      const imageType = options.format === 'jpg' ? 'image/jpeg' : 'image/png';
      const fileExtension = options.format;

      finalCanvas.toBlob(async (blob) => {
        if (blob) {
          const fileName = `משפחת-${tree.treeName}-${format(new Date(), 'yyyy-MM-dd')}.${fileExtension}`;
          
          // Trigger local download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          
          toast({ title: 'התמונה יוצאה בהצלחה' });
          
          // Save to cloud in the background
          await onSave(blob, fileName, fileExtension);
        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לייצר את קובץ התמונה.' });
        }
        
        document.body.classList.remove('pdf-export-mode');
        setIsExporting(false);
        onClose();

      }, imageType, 0.95);

    } catch (error) {
      console.error('Image export failed:', error);
      toast({ variant: 'destructive', title: 'שגיאה בייצוא תמונה', description: 'נסה שוב.' });
      document.getElementById('export-edge-fix')?.remove();
      document.body.classList.remove('pdf-export-mode');
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
            <p className="text-lg">מייצא תמונה...</p>
          </div>
        )}
        <DialogHeader className="text-right">
          <DialogTitle>ייצוא תמונה</DialogTitle>
          <DialogDescription>הגדר את אפשרויות הייצוא לקובץ תמונה.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          
          <div className="grid gap-2">
            <Label>פורמט</Label>
            <RadioGroup
              value={options.format}
              onValueChange={(value: 'png' | 'jpg') => setOptions({...options, format: value})}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2"><RadioGroupItem value="png" id="f-png" /><Label htmlFor="f-png">PNG</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="jpg" id="f-jpg" /><Label htmlFor="f-jpg">JPG</Label></div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label>איכות</Label>
             <RadioGroup
              value={String(options.quality)}
              onValueChange={(value) => setOptions({...options, quality: Number(value) as 1 | 2 | 3})}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2"><RadioGroupItem value="1" id="q-normal" /><Label htmlFor="q-normal">רגילה (1x)</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="2" id="q-high" /><Label htmlFor="q-high">גבוהה (2x)</Label></div>
               <div className="flex items-center gap-2"><RadioGroupItem value="3" id="q-max" /><Label htmlFor="q-max">מקסימלית (3x)</Label></div>
            </RadioGroup>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="include-title" checked={options.includeTitle} onCheckedChange={(checked) => setOptions({...options, includeTitle: !!checked})} />
            <Label htmlFor="include-title">הוסף כותרת עם שם העץ</Label>
          </div>

        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
          <Button type="button" onClick={handleExport}>
            <ImageIcon className="ml-2 h-4 w-4" />
            ייצא תמונה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
