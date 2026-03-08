'use client';

import { useState, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
    document.body.classList.add('pdf-export-mode');

    // Delay to allow UI to hide
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const element = document.querySelector('.react-flow') as HTMLElement;
      if (!element) {
        throw new Error('Canvas element not found.');
      }
      
      const canvas = await html2canvas(element, {
        scale: options.quality === 'max' ? 3 : options.quality === 'high' ? 2 : 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f0f4f8',
        logging: false,
      });

      const orientation = options.orientation === 'landscape' ? 'l' : 'p';
      const pdf = new jsPDF(orientation, 'mm', 'a4');
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text(options.title, pdf.internal.pageSize.getWidth() / 2, 12, { align: 'center' });
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`הופק בתאריך: ${new Date().toLocaleDateString('he-IL')}`, pdf.internal.pageSize.getWidth() - 10, 12, { align: 'right' });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const imgProps= pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth - 20;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 18;

      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - position);

      while (heightLeft > 0) {
        position -= (pdfHeight - 20); // Move image "up" on the new page, with margins
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 20);
      }
      
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text('נוצר באמצעות FamilyTree', 10, pdfHeight - 5);
      
      pdf.save(`${options.title.replace(/ /g, '_')}-${new Date().getFullYear()}.pdf`);
      
      toast({
        title: 'קובץ PDF הורד בהצלחה ✓',
      });

    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה בייצוא PDF',
        description: 'נסה שוב. אם הבעיה נמשכת, בדוק את הקונסול.',
      });
    } finally {
      setIsExporting(false);
      document.body.classList.remove('pdf-export-mode');
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
              <div className="flex items-center gap-2"><RadioGroupItem value="full" id="s-full" disabled /><Label htmlFor="s-full" className="opacity-50">כל העץ (בקרוב)</Label></div>
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
