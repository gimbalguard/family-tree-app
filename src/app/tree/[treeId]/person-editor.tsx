'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import type { Person, SocialLink } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Sparkles, Settings2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateDescription } from '@/ai/flows/ai-description-generation-flow';
import { Switch } from '@/components/ui/switch';

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
  // Additional fields
  middleName: z.string().optional(),
  previousFirstName: z.string().optional(),
  maidenName: z.string().optional(),
  nickname: z.string().optional(),
  religion: z.enum(['jewish', 'christian', 'muslim', 'buddhist', 'other']).optional(),
  countryOfResidence: z.string().optional(),
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
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);
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
      middleName: '',
      previousFirstName: '',
      maidenName: '',
      nickname: '',
      countryOfResidence: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'socialLinks',
  });

  useEffect(() => {
    if (isOpen) {
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
          middleName: '',
          previousFirstName: '',
          maidenName: '',
          nickname: '',
          countryOfResidence: '',
        });
      }
      setShowAdditionalFields(false); // Reset on open
    }
  }, [person, isOpen, form]);

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
    onClose();
  }
  
  const buttonText = isEditing ? 'שמור שינויים' : 'צור אדם';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl w-[90vw] flex flex-col max-h-[90vh]">
        <DialogHeader className="text-right">
          <DialogTitle>{isEditing ? 'עריכת אדם' : 'הוספת אדם חדש'}</DialogTitle>
          <DialogDescription>
            {isEditing ? `עריכת הפרופיל של ${person?.firstName} ${person?.lastName}.` : 'הוסף אדם חדש לעץ המשפחה שלך.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 pr-1 -mr-4">
              <div className="space-y-6 py-4 pr-5">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>שם פרטי</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>שם משפחה</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>תאריך לידה</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="deathDate" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>תאריך פטירה</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>מין</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl"><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="male">זכר</SelectItem><SelectItem value="female">נקבה</SelectItem><SelectItem value="other">אחר</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>סטטוס</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl"><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="alive">חי</SelectItem><SelectItem value="deceased">נפטר</SelectItem><SelectItem value="unknown">לא ידוע</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )}/>
                </div>
               
                <FormField control={form.control} name="birthPlace" render={({ field }) => (
                  <FormItem className="text-right"><FormLabel>מקום לידה</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="photoURL" render={({ field }) => (
                  <FormItem className="text-right"><FormLabel>כתובת URL של תמונה</FormLabel><FormControl><Input placeholder="https://" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                
                {showAdditionalFields && (
                    <>
                    <Separator/>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="middleName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם אמצעי</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="nickname" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>כינוי</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="previousFirstName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם פרטי קודם</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="maidenName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם משפחה קודם (נעורים)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="religion" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>דת</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                                    <FormControl><SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="jewish">יהדות</SelectItem>
                                        <SelectItem value="christian">נצרות</SelectItem>
                                        <SelectItem value="muslim">אסלאם</SelectItem>
                                        <SelectItem value="buddhist">בודהיזם</SelectItem>
                                        <SelectItem value="other">אחר</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage /></FormItem>
                            )}/>
                             <FormField control={form.control} name="countryOfResidence" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>ארץ מגורים</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                    </div>
                    <Separator/>
                    </>
                )}


                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <div className="flex items-center justify-between">
                          <FormLabel>תיאור ביוגרפי</FormLabel>
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
                         <FormDescription className='text-right'>
                          מקסימום 2000 תווים. השתמש ב-AI כדי להעשיר את התיאור.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                <div className="text-right">
                  <FormLabel>קישורים חברתיים</FormLabel>
                   <div className="space-y-4 mt-2">
                      {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-2">
                          <FormField control={form.control} name={`socialLinks.${index}.platform`} render={({ field }) => (
                               <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
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
                               <Input placeholder="https://..." {...field} className="flex-1" />
                          )}/>
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => append({ platform: 'website', url: '' })} className="mt-2">
                        <PlusCircle className="ml-2 h-4 w-4" /> הוסף קישור
                      </Button>
                    </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t items-center">
              <div className="flex-1 flex items-center gap-2 justify-end">
                <Label htmlFor="additional-fields-switch">פרטים נוספים</Label>
                <Switch
                  id="additional-fields-switch"
                  checked={showAdditionalFields}
                  onCheckedChange={setShowAdditionalFields}
                />
              </div>
              <div className="flex-shrink-0">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                  ביטול
                </Button>
                <Button type="submit" disabled={isSaving} className="mr-2">
                  {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  {buttonText}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
