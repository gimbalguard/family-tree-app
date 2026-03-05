'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { Person, SocialLink } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateDescription } from '@/ai/flows/ai-description-generation-flow';

const socialLinkSchema = z.object({
  platform: z.enum([
    'facebook',
    'instagram',
    'twitter',
    'linkedin',
    'website',
    'other',
  ]),
  url: z.string().url('חייב להיות URL חוקי.'),
});

const personSchema = z.object({
  firstName: z.string().min(1, 'שם פרטי הוא שדה חובה.'),
  lastName: z.string().min(1, 'שם משפחה הוא שדה חובה.'),
  gender: z.enum(['male', 'female', 'other']),
  status: z.enum(['alive', 'deceased', 'unknown']),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  birthPlace: z.string().optional(),
  photoURL: z.string().url('חייב להיות URL חוקי.').optional().or(z.literal('')),
  description: z.string().max(2000, 'התיאור לא יכול לעלות על 2000 תווים.').optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
});

type PersonEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  person?: Person | null;
  treeId: string;
  onSave: (data: any) => Promise<void>;
};

export function PersonEditor({
  isOpen,
  onClose,
  person,
  treeId,
  onSave,
}: PersonEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const isEditing = !!person;

  const form = useForm<z.infer<typeof personSchema>>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: 'other',
      status: 'unknown',
      birthDate: '',
      deathDate: '',
      birthPlace: '',
      photoURL: '',
      description: '',
      socialLinks: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'socialLinks',
  });

  useEffect(() => {
    if (person) {
      form.reset({
        ...person,
        socialLinks: [], // Social links need to be fetched separately
      });
    } else {
      form.reset({
        firstName: '',
        lastName: '',
        gender: 'other',
        status: 'unknown',
        birthDate: '',
        deathDate: '',
        birthPlace: '',
        photoURL: '',
        description: '',
        socialLinks: [],
      });
    }
  }, [person, form, isOpen]);

  const handleGenerateDescription = async () => {
    setIsAiLoading(true);
    const formData = form.getValues();
    try {
        const result = await generateDescription({
            firstName: formData.firstName,
            lastName: formData.lastName,
            gender: formData.gender,
            birthDate: formData.birthDate,
            deathDate: formData.deathDate,
            birthPlace: formData.birthPlace,
            status: formData.status,
            existingDescription: formData.description,
        });
        form.setValue('description', result.description, { shouldValidate: true });
        toast({ title: 'התיאור נוצר בהצלחה!' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'שגיאת AI', description: 'נכשל ביצירת תיאור.' });
    } finally {
        setIsAiLoading(false);
    }
  };

  async function onSubmit(values: z.infer<typeof personSchema>) {
    setIsSaving(true);
    const dataToSave = isEditing
      ? { ...person, ...values }
      : { ...values, treeId };
    await onSave(dataToSave);
    setIsSaving(false);
    if (!isEditing) {
        form.reset();
        onClose();
    }
  }
  
  const buttonText = isEditing ? 'שמור שינויים' : 'צור אדם';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="sm:max-w-lg w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'עריכת אדם' : 'הוספת אדם חדש'}</SheetTitle>
          <SheetDescription>
            {isEditing ? `עריכת הפרופיל של ${person?.firstName} ${person?.lastName}.` : 'הוסף אדם חדש לעץ המשפחה שלך.'}
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 pr-6 -mr-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel className="text-right w-full block">שם פרטי</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel className="text-right w-full block">שם משפחה</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel className="text-right w-full block">מין</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="male">זכר</SelectItem><SelectItem value="female">נקבה</SelectItem><SelectItem value="other">אחר</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel className="text-right w-full block">סטטוס</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="alive">חי</SelectItem><SelectItem value="deceased">נפטר</SelectItem><SelectItem value="unknown">לא ידוע</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )}/>
              </div>
               <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-right w-full block">תאריך לידה</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="deathDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-right w-full block">תאריך פטירה</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="birthPlace" render={({ field }) => (
                <FormItem><FormLabel className="text-right w-full block">מקום לידה</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField control={form.control} name="photoURL" render={({ field }) => (
                <FormItem><FormLabel className="text-right w-full block">כתובת URL של תמונה</FormLabel><FormControl><Input placeholder="https://" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-right">תיאור ביוגרפי</FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleGenerateDescription}
                          disabled={isAiLoading || !form.getValues('firstName')}
                        >
                          {isAiLoading ? (
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="ml-2 h-4 w-4 text-yellow-400" />
                          )}
                          עזרת AI
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea className="min-h-[120px]" {...field} />
                      </FormControl>
                       <FormDescription className="text-right">
                        מקסימום 2000 תווים. השתמש ב-AI כדי להעשיר את התיאור.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <div>
                <FormLabel className="text-right w-full block">קישורים חברתיים</FormLabel>
                 <div className="space-y-4 mt-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <FormField control={form.control} name={`socialLinks.${index}.platform`} render={({ field }) => (
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="website">אתר</SelectItem>
                                    <SelectItem value="facebook">פייסבוק</SelectItem>
                                    <SelectItem value="twitter">טוויטר</SelectItem>
                                    <SelectItem value="instagram">אינסטגרם</SelectItem>
                                    <SelectItem value="linkedin">לינקדאין</SelectItem>
                                    <SelectItem value="other">אחר</SelectItem>
                                </SelectContent>
                            </Select>
                        )}/>
                        <FormField control={form.control} name={`socialLinks.${index}.url`} render={({ field }) => (
                             <Input placeholder="https://..." {...field} />
                        )}/>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ platform: 'website', url: '' })}>
                      <PlusCircle className="ml-2 h-4 w-4" /> הוסף קישור חברתי
                    </Button>
                  </div>
              </div>
            </div>
            </ScrollArea>

            <SheetFooter className="pt-6 pr-6">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                ביטול
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {buttonText}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
