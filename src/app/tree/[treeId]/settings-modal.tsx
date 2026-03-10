
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Loader2, Copy, Heart, Baby, Users, Upload } from 'lucide-react';
import type { FamilyTree, Person } from '@/lib/types';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel"
import { Badge } from '@/components/ui/badge';

const settingsSchema = z.object({
  treeName: z.string().min(1, 'שם העץ הוא שדה חובה.'),
  ownerPersonId: z.string().optional(),
  language: z.enum(['he', 'en']),
  privacy: z.enum(['private', 'link', 'public']),
  cardDesign: z.enum(['default', 'tech', 'natural', 'elegant']).optional(),
  creatorCardDesign: z.enum(['default', 'tech', 'natural', 'elegant']).optional(),
  creatorCardBacklightIntensity: z.number().min(0).max(100).optional(),
  creatorCardBacklightDisabled: z.boolean().optional(),
  applyCreatorSettingsToTwins: z.boolean().optional(),
  creatorCardSize: z.number().min(50).max(200).optional(),
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
  onUploadCover: () => void;
};

const CardPreview = ({
  design,
  bgColor,
  borderColor,
  borderWidth,
  owner,
}: {
  design: 'default' | 'tech' | 'natural' | 'elegant',
  bgColor?: string,
  borderColor?: string,
  borderWidth?: number,
  owner?: Person,
}) => {
    const cardStyles: React.CSSProperties = {};
    let designClasses = '';

    if (design === 'default') {
        cardStyles.backgroundColor = bgColor || 'hsl(var(--card))';
        cardStyles.borderColor = borderColor || 'hsl(var(--border))';
        cardStyles.borderWidth = borderWidth ? `${borderWidth}px` : '1px';
    } else if (design === 'tech') {
        designClasses = 'card-design-tech';
    } else if (design === 'natural') {
        designClasses = 'card-design-natural';
    } else if (design === 'elegant') {
        designClasses = 'card-design-elegant';
    }

    const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : "שם האדם";
    const photo = owner?.photoURL || getPlaceholderImage(owner?.gender || 'other');

    return (
      <div className="w-full h-full p-4 flex items-center justify-center bg-muted/20 rounded-md">
        <div
            className={cn("w-64 h-[116px] border rounded-lg shadow-sm relative p-4 flex items-center gap-4", designClasses)}
            style={cardStyles}
        >
            <div className={cn('avatar-frame rounded-full')}>
              <Avatar className={cn("h-16 w-16 border")}>
                <AvatarImage src={photo || ''} className="object-cover"/>
                <AvatarFallback>
                  {ownerName.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-1 overflow-hidden text-right">
                <div className={cn("truncate text-lg font-bold text-main")}>
                    {ownerName}
                </div>
                 <p className={cn("text-xs text-muted-foreground text-sub")}>1975 - 2024</p>
                 <div className='flex items-center justify-end gap-2 pt-1'>
                    <Badge variant="outline" className="border-blue-500 text-blue-500">זכר</Badge>
                    <Heart className="h-4 w-4 text-green-500 fill-green-500" />
                </div>
                <div className="flex items-center justify-end gap-x-3 gap-y-1 pt-1.5 text-sub">
                    <div className="flex items-center gap-1 text-xs" title={`2 ילדים`}>
                        <Baby className="h-4 w-4" />
                        <span className="font-medium">2</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" title={`3 אחים`}>
                        <Users className="h-4 w-4" />
                        <span className="font-medium">3</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    )
}

const designOptions: {value: NonNullable<FamilyTree['creatorCardDesign']>, label: string}[] = [
    { value: 'default', label: 'רגיל' },
    { value: 'tech', label: 'טכנולוגי' },
    { value: 'natural', label: 'טבעי' },
    { value: 'elegant', label: 'אלגנטי' },
];

function DesignCarousel({
    field,
    owner,
    formValues,
}: {
    field: any;
    owner?: Person;
    formValues: any;
}) {
    const [api, setApi] = useState<CarouselApi>()
    const selectedIndex = designOptions.findIndex(o => o.value === field.value);

    useEffect(() => {
        if (api && selectedIndex !== -1 && api.selectedScrollSnap() !== selectedIndex) {
            api.scrollTo(selectedIndex)
        }
    }, [api, selectedIndex])

    return (
        <Carousel setApi={setApi} className="w-full max-w-sm mx-auto">
            <CarouselContent>
                {designOptions.map((opt) => (
                    <CarouselItem key={opt.value} onClick={() => field.onChange(opt.value)}>
                         <div className="cursor-pointer">
                            <CardPreview
                                design={opt.value}
                                owner={owner}
                                bgColor={formValues.cardBackgroundColor}
                                borderColor={formValues.cardBorderColor}
                                borderWidth={formValues.cardBorderWidth}
                            />
                            <p className={cn(
                                "text-center text-sm font-medium mt-1",
                                field.value === opt.value ? "text-primary" : "text-muted-foreground"
                            )}>
                                {opt.label}
                            </p>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
        </Carousel>
    );
}

export function SettingsModal({ isOpen, onClose, tree, people, onUpdate, onUploadCover }: SettingsModalProps) {
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
      cardDesign: 'default',
      creatorCardDesign: 'default',
      creatorCardBacklightIntensity: 50,
      creatorCardBacklightDisabled: false,
      applyCreatorSettingsToTwins: false,
      creatorCardSize: 100,
      cardBackgroundColor: '#ffffff',
      cardBorderColor: '#e5e7eb',
      cardBorderWidth: 1,
      canvasBackgroundColor: '#f8fafc',
    },
  });
  
  const privacyValue = form.watch('privacy');
  const isBacklightDisabled = form.watch('creatorCardBacklightDisabled');
  const formValues = form.watch();
  
  const ownerPerson = useMemo(() => {
    const ownerId = form.watch('ownerPersonId');
    if (!ownerId) return undefined;
    return people.find(p => p.id === ownerId);
  }, [form.watch('ownerPersonId'), people]);


  useEffect(() => {
    if (tree && isOpen) {
      form.reset({
        treeName: tree.treeName,
        ownerPersonId: tree.ownerPersonId || '',
        language: tree.language || 'he',
        privacy: tree.privacy || 'private',
        cardDesign: tree.cardDesign ?? 'default',
        creatorCardDesign: tree.creatorCardDesign ?? 'default',
        creatorCardBacklightIntensity: tree.creatorCardBacklightIntensity ?? 50,
        creatorCardBacklightDisabled: tree.creatorCardBacklightDisabled ?? false,
        applyCreatorSettingsToTwins: tree.applyCreatorSettingsToTwins ?? false,
        creatorCardSize: tree.creatorCardSize ?? 100,
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
      <DialogContent dir="rtl" className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="text-right shrink-0 p-6 border-b">
          <DialogTitle>הגדרות עץ</DialogTitle>
          <DialogDescription>נהל את הגדרות העץ והפרטיות שלו.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="settings-form" onSubmit={form.handleSubmit(handleSaveChanges)} className="flex-1 flex flex-col min-h-0">
            <Tabs defaultValue="general" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="shrink-0 mx-6 mt-4 justify-end">
                <TabsTrigger value="creator-card">כרטיס היוצר</TabsTrigger>
                <TabsTrigger value="global-design">עיצוב כללי</TabsTrigger>
                <TabsTrigger value="general">כללי</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <TabsContent value="general" className="mt-0">
                        <div className="space-y-4 px-6 py-4">
                            <FormField control={form.control} name="treeName" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel className='text-xs'>שם העץ</FormLabel><FormControl><Input {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="ownerPersonId" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel className='text-xs'>מי אני בעץ?</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                                    <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="בחר..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="--none--">- ללא -</SelectItem>
                                        {people.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                            )}/>
                            <div className="text-right">
                               <Button type="button" variant="outline" size="sm" onClick={onUploadCover}>
                                   <Upload className="ml-2 h-4 w-4" />
                                   העלאת תמונת נושא
                               </Button>
                            </div>
                            <Separator/>
                            <FormField control={form.control} name="language" render={({ field }) => (
                                <FormItem className='text-right'><FormLabel className='text-xs'>שפה</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                                        <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="he">עברית</SelectItem>
                                            <SelectItem value="en">English</SelectItem>
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                            )}/>
                            <Separator/>
                            <FormField control={form.control} name="privacy" render={({ field }) => (
                                <FormItem className="space-y-3 text-right"><FormLabel className='text-xs'>פרטיות</FormLabel>
                                    <FormControl>
                                    <div className="space-y-2 flex flex-col items-end">
                                        <Button type="button" onClick={() => field.onChange('private')} variant={field.value === 'private' ? 'secondary' : 'outline'} className="w-full justify-end h-auto py-2 text-right">פרטי (רק אני יכול לראות)</Button>
                                        <Button type="button" onClick={() => field.onChange('link')} variant={field.value === 'link' ? 'secondary' : 'outline'} className="w-full justify-end h-auto py-2 text-right">קישור בלבד (כל מי עם הקישור יכול לראות)</Button>
                                        <Button type="button" onClick={() => field.onChange('public')} variant={field.value === 'public' ? 'secondary' : 'outline'} className="w-full justify-end h-auto py-2 text-right">ציבורי (גלוי לכל משתמשי הפלטפורמה)</Button>
                                    </div>
                                    </FormControl>
                                    <FormMessage />
                                    {privacyValue === 'link' && (
                                        <div className="flex items-center space-x-2 space-x-reverse pt-2">
                                            <Input value={shareLink} readOnly className="h-9" /><Button type="button" size="icon" onClick={copyShareLink} disabled={!shareLink} className="h-9 w-9"><Copy className="h-4 w-4" /></Button>
                                        </div>
                                    )}
                                </FormItem>
                            )}/>
                        </div>
                    </TabsContent>
                    <TabsContent value="global-design" className="mt-0">
                         <div className="space-y-6 px-6 py-4">
                            <FormField control={form.control} name="cardDesign" render={({ field }) => (
                                <FormItem className='text-right'>
                                <FormLabel>עיצוב כרטיס</FormLabel>
                                <FormControl><DesignCarousel field={field} owner={ownerPerson} formValues={formValues}/></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}/>
                             <Separator/>
                             <div className="space-y-4">
                                <FormField control={form.control} name="canvasBackgroundColor" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel>צבע רקע קנבס</FormLabel><FormControl><Input type="color" {...field} className="h-10 p-1"/></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="cardBackgroundColor" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel>צבע רקע כרטיס</FormLabel><FormControl><Input type="color" {...field} className="h-10 p-1"/></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="cardBorderColor" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel>צבע גבול כרטיס</FormLabel><FormControl><Input type="color" {...field} className="h-10 p-1"/></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="cardBorderWidth" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel>עובי גבול ({field.value}px)</FormLabel><FormControl><Slider value={[field.value || 0]} onValueChange={(vals) => field.onChange(vals[0])} max={10} step={1} /></FormControl></FormItem>
                                )}/>
                             </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="creator-card" className="mt-0">
                       <div className="space-y-6 px-6 py-4">
                            <FormField control={form.control} name="creatorCardDesign" render={({ field }) => (
                                <FormItem className='text-right'>
                                <FormLabel>עיצוב כרטיס יוצר</FormLabel>
                                <FormControl><DesignCarousel field={field} owner={ownerPerson} formValues={formValues}/></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}/>
                            <div className="space-y-2">
                                <FormField control={form.control} name="creatorCardSize" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel className='text-xs'>גודל כרטיס יוצר ({field.value || 100}%)</FormLabel><FormControl><Slider value={[field.value || 100]} onValueChange={(vals) => field.onChange(vals[0])} min={50} max={200} step={10} /></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="creatorCardBacklightIntensity" render={({ field }) => (
                                    <FormItem className='text-right'><FormLabel className='text-xs'>עוצמת תאורה אחורית ({field.value || 0}%)</FormLabel>
                                    <FormControl><Slider disabled={isBacklightDisabled} value={[field.value || 0]} onValueChange={(vals) => field.onChange(vals[0])} max={100} step={1} /></FormControl></FormItem>
                                )}/>
                            </div>
                            <div className="flex items-center justify-end gap-6 text-right">
                                <FormField control={form.control} name="applyCreatorSettingsToTwins" render={({ field }) => (
                                    <FormItem className="flex items-center gap-2"><FormLabel className="!mt-0 text-xs">החל על תאומים</FormLabel><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="creatorCardBacklightDisabled" render={({ field }) => (
                                    <FormItem className="flex items-center gap-2"><FormLabel className="!mt-0 text-xs">בטל הבלטה</FormLabel><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )}/>
                            </div>
                        </div>
                    </TabsContent>
                  </ScrollArea>
              </div>
            </Tabs>
            <DialogFooter className="p-4 border-t shrink-0">
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
