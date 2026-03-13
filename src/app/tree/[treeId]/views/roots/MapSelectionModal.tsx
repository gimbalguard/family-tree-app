'use client';
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { MapView } from '../MapView';
import type { Person } from '@/lib/types';
import { toPng } from 'html-to-image';
import { useToast } from '@/hooks/use-toast';

interface MapSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (dataUrl: string) => void;
    people: Person[];
}

export function MapSelectionModal({ isOpen, onClose, onConfirm, people }: MapSelectionModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const mapRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const handleConfirm = async () => {
        if (!mapRef.current) return;
        setIsLoading(true);
        try {
            // This filter function excludes external stylesheets to prevent CORS errors with html-to-image.
            const filter = (node: HTMLElement) => {
                if (
                    node.tagName === 'LINK' &&
                    node.rel === 'stylesheet' &&
                    node.hasAttribute('href') &&
                    node.getAttribute('href')?.startsWith('https://')
                ) {
                    return false;
                }
                return true;
            };

            const dataUrl = await toPng(mapRef.current, { 
                quality: 0.95, 
                pixelRatio: 2,
                backgroundColor: '#f1f5f9', // same as stats view bg
                filter: filter,
                skipFonts: true,
            });
            onConfirm(dataUrl);
        } catch (error) {
            console.error("Failed to capture map image:", error);
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לצלם את המפה.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0" dir="rtl">
                <DialogHeader className="p-6 pb-0 text-right">
                    <DialogTitle>בחירת תצוגת מפה</DialogTitle>
                    <DialogDescription>מקם את המפה כפי שתרצה שתופיע במצגת ולחץ על אישור.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 relative" ref={mapRef}>
                    <MapView people={people} onEditPerson={() => {}} />
                </div>
                <DialogFooter className="p-4 border-t">
                     <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                        ביטול
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={isLoading}>
                        {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        אישור ושמירת תמונה
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
