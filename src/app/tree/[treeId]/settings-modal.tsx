'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Copy } from 'lucide-react';
import type { FamilyTree, Person } from '@/lib/types';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';


const settingsSchema = z.object({
  treeName: z.string().min(1, 'שם העץ הוא שדה חובה.'),
  ownerPersonId: z.string().optional(),
  language: z.enum(['he', 'en']),
  privacy: z.enum(['private', 'link', 'public']),
  creatorCardBacklightIntensity: z.number().min(0).max(100).optional(),
  creatorCardBacklightDisabled: z.boolean().optional(),
  creatorCardSize: z.number().min(50).max(200).optional(),
  creatorCardDesign: z.enum(['default', 'modern', 'elegant', 'minimalist']).optional(),
  cardBackgroundColor: z.string().optional(),
  cardBorderColor: z.string().optional(),
  cardBorderWidth: z.number().min(0).max(10).optional(),
  canvasBackgroundColor: z.string().optional(),
});

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tree: FamilyTree;
  people: Person[];
  onUpdate: (details: Partial<FamilyTree>) => Promise<void>;
};

const designOptions: {value: NonNullable<FamilyTree['creatorCardDesign']>, label: string, preview: React.FC}[] = [
    { value: 'default', label: 'ברירת מחדל', preview: () => <div className="w-full h-full bg-card border rounded-md" /> },
    { value: 'modern', label: 'מודרני', preview: () => <div className="w-full h-full bg-card border rounded-lg shadow-lg relative"><div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/20 border-2 border-primary" /></div> },
    { value: 'elegant', label: 'אלגנטי', preview: () => <div className="w-full h-full bg-stone-800 border border-stone-600 rounded-md flex flex-col p-1"><div className="font-serif text-stone-300 text-[6px]">שם</div><div className="flex-1 border-t border-stone-600 mt-1" /></div> },
    { value: 'minimalist', label: 'מינימליסטי', preview: () => <div className="w-full h-full bg-card rounded-md flex items-center p-1"><div className="w-4 h-4 rounded-full bg-muted"/><div className="flex-1 h-3 bg-muted ml-1 rounded-sm"/></div> },
];

export function SettingsModal({ isOpen, onClose, tree, people, onUpdate }: SettingsModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      treeName: '',
      ownerPersonId: '',
      language: 'he',
      privacy: 'private',
      creatorCardBacklightIntensity: 50,
      creatorCardBacklightDisabled: false,
      creatorCardSize: 100,
      creatorCardDesign: 'default',
      cardBackgroundColor: '#ffffff',
      cardBorderColor: '#e5e7eb',
      cardBorderWidth: 1,
      canvasBackgroundColor: '#f8fafc',
    },
  });
  
  const privacyValue = form.watch('privacy');
  const isBacklightDisabled = form.watch('creatorCardBacklightDisabled');

  useEffect(() => {
    if (tree && isOpen) {
      form.reset({
        treeName: tree.treeName,
        ownerPersonId: tree.ownerPersonId || '',
        language: tree.language || 'he',
        privacy: tree.privacy || 'private',
        creatorCardBacklightIntensity: tree.creatorCardBacklightIntensity ?? 50,
        creatorCardBacklightDisabled: tree.creatorCardBacklightDisabled ?? false,
        creatorCardSize: tree.creatorCardSize ?? 100,
        creatorCardDesign: tree.creatorCardDesign ?? 'default',
        cardBackgroundColor: tree.cardBackgroundColor || '#ffffff',
        cardBorderColor: tree.cardBorderColor || '#e5e7eb',
        cardBorderWidth: tree.cardBorderWidth ?? 1,
        canvasBackgroundColor: tree.canvasBackgroundColor || '#f8fafc',
      });
      if (tree.privacy === 'link' && tree.shareToken) {
        setShareLink(`${window.location.origin}/view/${tree.id}?token=${tree.shareToken}`);
      } else {
        setShareLink('');
      }
    }
  }, [tree, form, isOpen]);
  
  useEffect(() => {
     if (privacyValue === 'link' && tree.shareToken) {
        setShareLink(`${window.location.origin}/view/${tree.id}?token=${tree.shareToken}`);
     } else {
        setShareLink('');
     }
  }, [privacyValue, tree]);


  const handleSaveChanges = async (values: z.infer<typeof settingsSchema>) => {
    setIsLoading(true);
    
    const detailsToUpdate: Partial<FamilyTree> = { ...values };

    if (detailsToUpdate.ownerPersonId === '--none--') {
      detailsToUpdate.ownerPersonId = '';
    }

    if (values.privacy === 'link' && !tree.shareToken) {
        const newShareToken = uuidv4();
        detailsToUpdate.shareToken = newShareToken;
    }

    try {
      await onUpdate(detailsToUpdate);
      toast({ title: 'ההגדרות נשמרו' });
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה לשמור את השינויים.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({ title: 'הקישור הועתק' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="text-right shrink-0 p-6 pb-0">
          <DialogTitle>הגדרות עץ</DialogTitle>
          <DialogDescription>נהל את הגדרות העץ והפרטיות שלו.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="settings-form" onSubmit={form.handleSubmit(handleSaveChanges)} className="flex-1 flex flex-col min-h-0">
             <div className="flex-1 min-h-0 px-6">
                 <ScrollArea className="h-full">
                    <div className="space-y-6 py-4">
                    {/* Tree Details Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold">פרטי העץ</h3>
                        <FormField
                        control={form.control}
                        name="treeName"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>שם העץ</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="ownerPersonId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>מי אני בעץ?</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                                <FormControl><SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="--none--">- ללא -</SelectItem>
                                    {people.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                    
                    <Separator />

                    {/* Global Styles */}
                    <div className="space-y-4">
                        <h3 className="font-semibold">עיצוב כללי</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="canvasBackgroundColor" render={({ field }) => (
                                <FormItem><FormLabel>צבע רקע קנבס</FormLabel><FormControl><Input type="color" {...field} /></FormControl></FormItem>
                            )}/>
                            <FormField control={form.control} name="cardBackgroundColor" render={({ field }) => (
                                <FormItem><FormLabel>צבע רקע כרטיס</FormLabel><FormControl><Input type="color" {...field} /></FormControl></FormItem>
                            )}/>
                             <FormField control={form.control} name="cardBorderColor" render={({ field }) => (
                                <FormItem><FormLabel>צבע גבול כרטיס</FormLabel><FormControl><Input type="color" {...field} /></FormControl></FormItem>
                            )}/>
                        </div>
                         <FormField control={form.control} name="cardBorderWidth" render={({ field }) => (
                            <FormItem><FormLabel>עובי גבול ({field.value}px)</FormLabel><FormControl><Slider value={[field.value || 0]} onValueChange={(vals) => field.onChange(vals[0])} max={10} step={1} /></FormControl></FormItem>
                        )}/>
                    </div>

                    <Separator />
                    
                    {/* Creator Card Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold">כרטיס יוצר העץ</h3>
                        <FormField control={form.control} name="creatorCardBacklightIntensity" render={({ field }) => (
                        <FormItem>
                            <FormLabel>עוצמת תאורה אחורית ({field.value || 0}%)</FormLabel>
                            <FormControl>
                            <Slider disabled={isBacklightDisabled} value={[field.value || 0]} onValueChange={(vals) => field.onChange(vals[0])} max={100} step={1} />
                            </FormControl>
                        </FormItem>
                        )}/>
                        <FormField control={form.control} name="creatorCardBacklightDisabled" render={({ field }) => (
                        <FormItem className="flex flex-row-reverse items-center justify-end gap-2 space-y-0">
                            <FormLabel>בטל הבלטת כרטיס</FormLabel>
                            <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>
                        )}/>
                        <FormField control={form.control} name="creatorCardSize" render={({ field }) => (
                        <FormItem>
                            <FormLabel>גודל כרטיס יוצר העץ ({field.value || 100}%)</FormLabel>
                            <FormControl>
                            <Slider value={[field.value || 100]} onValueChange={(vals) => field.onChange(vals[0])} min={50} max={200} step={10} />
                            </FormControl>
                        </FormItem>
                        )}/>
                        <FormField
                            control={form.control}
                            name="creatorCardDesign"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>עיצוב כרטיס יוצר</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2"
                                    >
                                    {designOptions.map(opt => {
                                        const itemId = `design-option-${opt.value}`;
                                        return (
                                            <FormItem key={opt.value}>
                                                <FormControl>
                                                    <RadioGroupItem value={opt.value} id={itemId} className="sr-only" />
                                                </FormControl>
                                                <Label
                                                htmlFor={itemId}
                                                className={cn(
                                                    "flex flex-col items-center justify-between gap-2 rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer h-24",
                                                    field.value === opt.value && "border-primary"
                                                )}
                                                >
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <div className="w-16 h-10"><opt.preview/></div>
                                                </div>
                                                <span className="text-xs font-normal text-center">{opt.label}</span>
                                                </Label>
                                            </FormItem>
                                        );
                                    })}
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>


                    <Separator />

                    {/* Language Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold">שפה</h3>
                        <FormField
                            control={form.control}
                            name="language"
                            render={({ field }) => (
                            <FormItem>
                                <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="he">עברית</SelectItem>
                                        <SelectItem value="en">English</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    
                    <Separator />

                    {/* Privacy Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold">פרטיות</h3>
                        <FormField
                            control={form.control}
                            name="privacy"
                            render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                                    <FormItem className="flex items-center space-x-3 space-x-reverse">
                                        <FormControl><RadioGroupItem value="private" /></FormControl>
                                        <FormLabel className="font-normal">פרטי (רק אני יכול לראות)</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-3 space-x-reverse">
                                        <FormControl><RadioGroupItem value="link" /></FormControl>
                                        <FormLabel className="font-normal">קישור בלבד (כל מי עם הקישור יכול לראות)</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-3 space-x-reverse">
                                        <FormControl><RadioGroupItem value="public" /></FormControl>
                                        <FormLabel className="font-normal">ציבורי (גלוי לכל משתמשי הפלטפורמה)</FormLabel>
                                    </FormItem>
                                </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        {privacyValue === 'link' && (
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <Input value={shareLink} readOnly />
                                <Button type="button" size="icon" onClick={copyShareLink} disabled={!shareLink}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
                </ScrollArea>
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button type="button" variant="outline" onClick={onClose}>
                    ביטול
                </Button>
                <Button type="submit" form="settings-form" disabled={isLoading}>
                    {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    שמור שינויים
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
