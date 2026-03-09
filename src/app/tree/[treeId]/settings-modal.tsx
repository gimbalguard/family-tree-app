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
import { Loader2, Copy, Star } from 'lucide-react';
import type { FamilyTree, Person } from '@/lib/types';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const settingsSchema = z.object({
  treeName: z.string().min(1, 'שם העץ הוא שדה חובה.'),
  ownerPersonId: z.string().optional(),
  language: z.enum(['he', 'en']),
  privacy: z.enum(['private', 'link', 'public']),
  creatorCardBacklightIntensity: z.number().min(0).max(100).optional(),
  creatorCardBacklightDisabled: z.boolean().optional(),
  creatorCardSize: z.number().min(50).max(200).optional(),
  creatorCardDesign: z.enum(['default', 'modern', 'elegant', 'star']).optional(),
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

const CardPreview = ({ design, bgColor, borderColor, borderWidth }: { design?: string, bgColor?: string, borderColor?: string, borderWidth?: number }) => {
    const style: React.CSSProperties = {
        backgroundColor: bgColor || 'hsl(var(--card))',
        borderColor: borderColor || 'hsl(var(--border))',
        borderWidth: borderWidth ? `${borderWidth}px` : '1px',
    };

    return (
        <div
            className="w-full h-full bg-card border rounded-md shadow-sm relative p-1 flex items-center gap-1"
            style={style}
        >
            <div className="w-5 h-5 rounded-full bg-muted shrink-0"/>
            <div className="flex-1 space-y-1">
                <div className="w-10 h-1.5 bg-muted rounded-sm"/>
                <div className="w-8 h-1 bg-muted/50 rounded-sm"/>
            </div>

            {design === 'modern' && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary/50 border border-primary" />}
            {design === 'elegant' && (
                <>
                    <div className="absolute top-1 left-1 w-2 h-px bg-muted-foreground/50"/>
                    <div className="absolute top-1 right-1 w-2 h-px bg-muted-foreground/50"/>
                    <div className="absolute bottom-1 left-1 w-2 h-px bg-muted-foreground/50"/>
                    <div className="absolute bottom-1 right-1 w-2 h-px bg-muted-foreground/50"/>
                </>
            )}
            {design === 'star' && <div className="absolute top-0 right-0"><Star className="w-2.5 h-2.5 text-amber-400 fill-amber-300" /></div>}
        </div>
    )
}

const designOptions: {value: NonNullable<FamilyTree['creatorCardDesign']>, label: string}[] = [
    { value: 'default', label: 'ברירת מחדל' },
    { value: 'modern', label: 'נקודת ציון' },
    { value: 'elegant', label: 'מסגרת קלאסית' },
    { value: 'star', label: 'כוכב העץ' },
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
  const formValues = form.watch();

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
      <DialogContent dir="rtl" className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="text-right shrink-0 p-6 border-b">
          <DialogTitle>הגדרות עץ</DialogTitle>
          <DialogDescription>נהל את הגדרות העץ והפרטיות שלו.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="settings-form" onSubmit={form.handleSubmit(handleSaveChanges)} className="flex-1 flex flex-col min-h-0">
            <Tabs defaultValue="general" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="shrink-0 mx-6 mt-4">
                <TabsTrigger value="general">כללי</TabsTrigger>
                <TabsTrigger value="global-design">עיצוב כללי</TabsTrigger>
                <TabsTrigger value="creator-card">כרטיס היוצר</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <TabsContent value="general" className="mt-0">
                        <div className="space-y-6 px-6 py-4">
                            <FormField control={form.control} name="treeName" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel>שם העץ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="ownerPersonId" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel>מי אני בעץ?</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                                    <FormControl><SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="--none--">- ללא -</SelectItem>
                                        {people.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                            )}/>
                            <Separator/>
                            <FormField control={form.control} name="language" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel>שפה</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="he">עברית</SelectItem>
                                            <SelectItem value="en">English</SelectItem>
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                            )}/>
                            <Separator/>
                            <FormField control={form.control} name="privacy" render={({ field }) => (
                                <FormItem className="space-y-3 text-right"><FormLabel>פרטיות</FormLabel>
                                    <FormControl>
                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                                        <FormItem className="flex items-center gap-2"><FormControl><RadioGroupItem value="private" /></FormControl><FormLabel className="font-normal">פרטי (רק אני יכול לראות)</FormLabel></FormItem>
                                        <FormItem className="flex items-center gap-2"><FormControl><RadioGroupItem value="link" /></FormControl><FormLabel className="font-normal">קישור בלבד (כל מי עם הקישור יכול לראות)</FormLabel></FormItem>
                                        <FormItem className="flex items-center gap-2"><FormControl><RadioGroupItem value="public" /></FormControl><FormLabel className="font-normal">ציבורי (גלוי לכל משתמשי הפלטפורמה)</FormLabel></FormItem>
                                    </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                    {privacyValue === 'link' && (
                                        <div className="flex items-center space-x-2 space-x-reverse pt-2">
                                            <Input value={shareLink} readOnly /><Button type="button" size="icon" onClick={copyShareLink} disabled={!shareLink}><Copy className="h-4 w-4" /></Button>
                                        </div>
                                    )}
                                </FormItem>
                            )}/>
                        </div>
                    </TabsContent>
                    <TabsContent value="global-design" className="mt-0">
                        <div className="space-y-6 px-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="canvasBackgroundColor" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel>צבע רקע קנבס</FormLabel><FormControl><Input type="color" {...field} className="h-12"/></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="cardBackgroundColor" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel>צבע רקע כרטיס</FormLabel><FormControl><Input type="color" {...field} className="h-12"/></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="cardBorderColor" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel>צבע גבול כרטיס</FormLabel><FormControl><Input type="color" {...field} className="h-12"/></FormControl></FormItem>
                                )}/>
                            </div>
                            <FormField control={form.control} name="cardBorderWidth" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel>עובי גבול ({field.value}px)</FormLabel><FormControl><Slider value={[field.value || 0]} onValueChange={(vals) => field.onChange(vals[0])} max={10} step={1} /></FormControl></FormItem>
                            )}/>
                        </div>
                    </TabsContent>
                    <TabsContent value="creator-card" className="mt-0">
                        <div className="space-y-6 px-6 py-4">
                            <FormField control={form.control} name="creatorCardDesign" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel>עיצוב כרטיס יוצר</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2"
                                        >
                                            {designOptions.map((opt) => {
                                                const itemId = `design-option-${opt.value}`;
                                                return (
                                                    <div key={opt.value}>
                                                        <RadioGroupItem value={opt.value} id={itemId} className="sr-only" />
                                                        <Label
                                                            htmlFor={itemId}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer h-28 w-full",
                                                                field.value === opt.value && "border-primary"
                                                            )}
                                                        >
                                                            <div className="w-24 h-16 relative">
                                                                <CardPreview
                                                                    design={opt.value}
                                                                    bgColor={formValues.cardBackgroundColor}
                                                                    borderColor={formValues.cardBorderColor}
                                                                    borderWidth={formValues.cardBorderWidth}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-normal text-center">{opt.label}</span>
                                                        </Label>
                                                    </div>
                                                );
                                            })}
                                        </RadioGroup>
                                    </FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="creatorCardSize" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel>גודל כרטיס יוצר ({field.value || 100}%)</FormLabel><FormControl><Slider value={[field.value || 100]} onValueChange={(vals) => field.onChange(vals[0])} min={50} max={200} step={10} /></FormControl></FormItem>
                            )}/>
                            <Separator/>
                            <FormField control={form.control} name="creatorCardBacklightIntensity" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel>עוצמת תאורה אחורית ({field.value || 0}%)</FormLabel>
                                <FormControl><Slider disabled={isBacklightDisabled} value={[field.value || 0]} onValueChange={(vals) => field.onChange(vals[0])} max={100} step={1} /></FormControl></FormItem>
                            )}/>
                            <FormField control={form.control} name="creatorCardBacklightDisabled" render={({ field }) => (
                                <FormItem className="flex items-center justify-end gap-2 text-right"><FormLabel className="!mt-0">בטל הבלטת כרטיס</FormLabel><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                            )}/>
                        </div>
                    </TabsContent>
                  </ScrollArea>
              </div>
            </Tabs>
            <DialogFooter className="p-6 border-t shrink-0">
                <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
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
