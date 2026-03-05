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
  url: z.string().url('Must be a valid URL.'),
});

const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  gender: z.enum(['male', 'female', 'other']),
  status: z.enum(['alive', 'deceased', 'unknown']),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  birthPlace: z.string().optional(),
  photoURL: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters.').optional(),
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
      form.reset();
    }
  }, [person, form]);

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
        toast({ title: 'Description generated successfully!' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'AI Error', description: 'Failed to generate description.' });
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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Person' : 'Add New Person'}</SheetTitle>
          <SheetDescription>
            {isEditing ? `Editing the profile of ${person?.firstName} ${person?.lastName}.` : 'Add a new person to your family tree.'}
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 pr-6 -mr-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>Gender</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="alive">Alive</SelectItem><SelectItem value="deceased">Deceased</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )}/>
              </div>
               <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem><FormLabel>Birth Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="deathDate" render={({ field }) => (
                  <FormItem><FormLabel>Death Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="birthPlace" render={({ field }) => (
                <FormItem><FormLabel>Place of Birth</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField control={form.control} name="photoURL" render={({ field }) => (
                <FormItem><FormLabel>Photo URL</FormLabel><FormControl><Input placeholder="https://" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Biographical Description</FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleGenerateDescription}
                          disabled={isAiLoading || !form.getValues('firstName')}
                        >
                          {isAiLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4 text-yellow-400" />
                          )}
                          AI Assist
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea className="min-h-[120px]" {...field} />
                      </FormControl>
                       <FormDescription>
                        Max 2000 characters. Use AI to enrich the description.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <div>
                <FormLabel>Social Links</FormLabel>
                 <div className="space-y-4 mt-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <FormField control={form.control} name={`socialLinks.${index}.platform`} render={({ field }) => (
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="website">Website</SelectItem>
                                    <SelectItem value="facebook">Facebook</SelectItem>
                                    <SelectItem value="twitter">Twitter</SelectItem>
                                    <SelectItem value="instagram">Instagram</SelectItem>
                                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
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
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Social Link
                    </Button>
                  </div>
              </div>
            </div>
            </ScrollArea>

            <SheetFooter className="pt-6 pr-6">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
