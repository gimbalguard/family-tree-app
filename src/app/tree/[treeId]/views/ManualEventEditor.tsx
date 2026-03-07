
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parse } from 'date-fns';
import type { ManualEvent } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const eventSchema = z.object({
  title: z.string().min(1, 'כותרת היא שדה חובה.'),
  date: z.string().min(1, 'תאריך הוא שדה חובה.'),
  allDay: z.boolean(),
  time: z.string().optional(),
  description: z.string().optional(),
  color: z.string().min(1, 'יש לבחור צבע.'),
}).refine(data => !data.allDay ? !!data.time : true, {
  message: "יש להזין שעה עבור אירוע שאינו לאורך כל היום.",
  path: ["time"],
});

type EventEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  event: Partial<ManualEvent> | null;
  onSave: (data: Omit<ManualEvent, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'treeId'> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const colorOptions = [
    { value: '#7c3aed', label: 'סגול', className: 'bg-purple-600' },
    { value: '#2563eb', label: 'כחול', className: 'bg-blue-600' },
    { value: '#ea580c', label: 'כתום', className: 'bg-orange-600' },
    { value: '#db2777', label: 'ורוד', className: 'bg-pink-600' },
    { value: '#16a34a', label: 'ירוק', className: 'bg-green-600' },
];

export function ManualEventEditor({ isOpen, onClose, event, onSave, onDelete }: EventEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isEditing = !!event?.id;

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '', date: '', allDay: true, time: '', description: '', color: colorOptions[0].value,
    },
  });

  useEffect(() => {
    if (isOpen) {
        setIsSaving(false);
        setIsDeleting(false);
        if (event) {
            form.reset({
                title: event.title || '',
                date: event.date ? format(new Date(event.date), 'yyyy-MM-dd') : '',
                allDay: event.allDay ?? true,
                time: event.time || '',
                description: event.description || '',
                color: event.color || colorOptions[0].value,
            });
        } else {
            form.reset({
                title: '', date: '', allDay: true, time: '', description: '', color: colorOptions[0].value,
            });
        }
    }
  }, [event, isOpen, form]);
  
  async function onSubmit(values: z.infer<typeof eventSchema>) {
    setIsSaving(true);
    try {
        const dataToSave = {
            ...values,
            id: event?.id,
        };
        await onSave(dataToSave);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשמור את האירוע.' });
    } finally {
        setIsSaving(false);
    }
  }

  const handleDelete = async () => {
    if (!event?.id) return;
    setIsDeleting(true);
    try {
        await onDelete(event.id);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את האירוע.' });
    } finally {
        setIsDeleting(false);
    }
  }

  const allDayValue = form.watch('allDay');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="sm:max-w-[480px]">
        <DialogHeader className="text-right">
          <DialogTitle>{isEditing ? 'עריכת אירוע' : 'הוספת אירוע חדש'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'ערוך את פרטי האירוע.' : 'הוסף אירוע מותאם אישית ללוח השנה.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>כותרת</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>תאריך</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                {!allDayValue && (
                    <FormField control={form.control} name="time" render={({ field }) => (
                        <FormItem><FormLabel>שעה</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                )}
            </div>
             <FormField control={form.control} name="allDay" render={({ field }) => (
                <FormItem className="flex flex-row-reverse items-center justify-end gap-2 space-y-0">
                    <FormLabel>לאורך כל היום</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
            )}/>
            <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>תיאור (אופציונלי)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>צבע</FormLabel>
                    <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                            {colorOptions.map(opt => (
                                <FormItem key={opt.value} className="flex items-center space-x-1 space-x-reverse space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value={opt.value} className={cn('w-8 h-8 border-2', opt.className)} />
                                    </FormControl>
                                </FormItem>
                            ))}
                        </RadioGroup>
                    </FormControl>
                <FormMessage />
                </FormItem>
            )}/>
            <DialogFooter className="pt-6 border-t flex-row-reverse justify-between">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>ביטול</Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        {isEditing ? 'שמור שינויים' : 'צור אירוע'}
                    </Button>
                </div>
                {isEditing && (
                    <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Trash2 className="ml-2 h-4 w-4"/>}
                        מחק
                    </Button>
                )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
