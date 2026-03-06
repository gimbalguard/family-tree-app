'use client';

import { useEffect, useState, useRef } from 'react';
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
import { Loader2, PlusCircle, Trash2, Sparkles, Settings2, Camera, UploadCloud, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateDescription } from '@/ai/flows/ai-description-generation-flow';
import { Switch } from '@/components/ui/switch';
import { useUser, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

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
  middleName: z.string().optional(),
  previousFirstName: z.string().optional(),
  maidenName: z.string().optional(),
  nickname: z.string().optional(),
  religion: z.enum(['jewish', 'christian', 'muslim', 'buddhist', 'other', '']).optional(),
  countryOfResidence: z.string().optional(),
});

type PersonEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  person?: Person | null;
  treeId: string;
  onSave: (data: any) => Promise<void>;
  onDelete: (personId: string) => void;
};

export function PersonEditor({
  isOpen,
  onClose,
  person,
  treeId,
  onSave,
  onDelete,
}: PersonEditorProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const storage = useStorage();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isEditing = !!person;

  const form = useForm<z.infer<typeof personSchema>>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      firstName: '', lastName: '', gender: 'other', status: 'alive',
      birthDate: '', deathDate: '', birthPlace: '', photoURL: '',
      description: '', socialLinks: [], middleName: '',
      previousFirstName: '', maidenName: '', nickname: '',
      religion: '', countryOfResidence: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'socialLinks',
  });

  const deathDateValue = form.watch('deathDate');
  useEffect(() => {
    const currentStatus = form.getValues('status');
    if (deathDateValue && currentStatus !== 'deceased') {
      form.setValue('status', 'deceased');
    } else if (!deathDateValue && currentStatus === 'deceased') {
      // Revert to alive only if it was deceased due to death date
      form.setValue('status', 'alive');
    }
  }, [deathDateValue, form]);

  useEffect(() => {
    if (isOpen) {
      if (person) {
        // Sanitize person data to prevent 'uncontrolled input' error
        form.reset({
          firstName: person.firstName || '',
          lastName: person.lastName || '',
          gender: person.gender || 'other',
          status: person.status || 'alive',
          birthDate: person.birthDate || '',
          deathDate: person.deathDate || '',
          birthPlace: person.birthPlace || '',
          photoURL: person.photoURL || '',
          description: person.description || '',
          middleName: person.middleName || '',
          previousFirstName: person.previousFirstName || '',
          maidenName: person.maidenName || '',
          nickname: person.nickname || '',
          religion: person.religion || '',
          countryOfResidence: person.countryOfResidence || '',
          socialLinks: person.socialLinks || [],
        });
      } else {
        // Reset for new person, ensuring no undefined values and status is 'alive'
        form.reset({
          firstName: '', lastName: '', gender: 'other', status: 'alive',
          birthDate: '', deathDate: '', birthPlace: '', photoURL: '',
          description: '', socialLinks: [], middleName: '',
          previousFirstName: '', maidenName: '', nickname: '',
          religion: '', countryOfResidence: '',
        });
      }
      setShowAdditionalFields(false);
      setIsCameraOpen(false);
      setIsUploading(false);
    } else {
      // Cleanup camera stream when modal closes
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }
  }, [person, isOpen, form, cameraStream]);

  const handleImageUpload = (file: File | Blob) => {
    if (!storage || !user || !treeId) return;
    setIsUploading(true);
    setUploadProgress(0);

    const personId = person?.id || 'new';
    const filePath = `users/${user.uid}/trees/${treeId}/photos/${personId}_${Date.now()}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        setIsUploading(false);
        toast({ variant: 'destructive', title: 'שגיאת העלאה', description: error.message });
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          form.setValue('photoURL', downloadURL, { shouldValidate: true });
          setIsUploading(false);
          toast({ title: 'התמונה הועלתה בהצלחה' });
        });
      }
    );
  };
  
  const handleDragEvents = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvents(e);
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };
  
  const openCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(stream);
        setIsCameraOpen(true);
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'שגיאת מצלמה', description: 'לא ניתן לגשת למצלמה. אנא בדוק הרשאות.' });
      }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0);
            canvasRef.current.toBlob(blob => {
                if (blob) handleImageUpload(blob);
            }, 'image/jpeg');
            closeCamera();
        }
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setIsCameraOpen(false);
  };


  const handleDeleteClick = () => {
    if (person) onDelete(person.id);
  }

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
  const photoUrlValue = form.watch('photoURL');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl w-[90vw] flex flex-col max-h-[90vh]" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>{isEditing ? 'עריכת אדם' : 'הוספת אדם חדש'}</DialogTitle>
          <DialogDescription>
            {isEditing ? `עריכת הפרופיל של ${person?.firstName} ${person?.lastName}.` : 'הוסף אדם חדש לעץ המשפחה שלך.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 pr-6 pl-2 -mr-6">
              <div className="space-y-6 py-4 pr-0 pl-4">

                <div 
                  className={cn(
                    "relative w-40 h-40 mx-auto rounded-full border-2 border-dashed flex items-center justify-center text-muted-foreground transition-colors",
                    isDragging && "border-primary bg-primary/10"
                  )}
                  onDragEnter={(e) => {handleDragEvents(e); setIsDragging(true);}}
                  onDragLeave={(e) => {handleDragEvents(e); setIsDragging(false);}}
                  onDragOver={handleDragEvents}
                  onDrop={handleDrop}
                >
                  <Avatar className="w-full h-full">
                    <AvatarImage src={photoUrlValue} className="object-cover" />
                    <AvatarFallback className="bg-transparent">
                      <UploadCloud className="w-12 h-12" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <Button type="button" size="icon" variant="ghost" className="text-white hover:text-white hover:bg-white/20" onClick={() => fileInputRef.current?.click()}>
                      <UploadCloud className="w-6 h-6" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="text-white hover:text-white hover:bg-white/20" onClick={openCamera}>
                      <Camera className="w-6 h-6" />
                    </Button>
                  </div>

                  {isUploading && (
                    <div className="absolute inset-0 bg-background/80 rounded-full flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <Progress value={uploadProgress} className="w-3/4 h-2" />
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} className="hidden" accept="image/*" />
                </div>
                 
                {isCameraOpen && (
                    <div className='p-4 border rounded-lg space-y-2'>
                        <video ref={videoRef} autoPlay playsInline className='w-full rounded-md' />
                        <div className='flex justify-center gap-2'>
                            <Button type="button" onClick={capturePhoto}>צלם תמונה</Button>
                            <Button type="button" variant="outline" onClick={closeCamera}>סגור מצלמה</Button>
                        </div>
                    </div>
                )}
                <canvas ref={canvasRef} className="hidden"></canvas>


                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>שם פרטי</FormLabel><FormControl><Input {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>שם משפחה</FormLabel><FormControl><Input {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
                
                {showAdditionalFields && (
                    <div className="space-y-6 p-4 border rounded-md">
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="middleName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם אמצעי</FormLabel><FormControl><Input {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="nickname" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>כינוי</FormLabel><FormControl><Input {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="previousFirstName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם פרטי קודם</FormLabel><FormControl><Input {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="maidenName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם משפחה קודם (נעורים)</FormLabel><FormControl><Input {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                    </div>
                )}

                 <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>תאריך לידה</FormLabel><FormControl><Input type="date" {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="deathDate" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>תאריך פטירה</FormLabel><FormControl><Input type="date" {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>מין</FormLabel><Select onValueChange={field.onChange} value={field.value} dir="rtl"><FormControl><SelectTrigger className="bg-white text-zinc-950"><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="male">זכר</SelectItem><SelectItem value="female">נקבה</SelectItem><SelectItem value="other">אחר</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )}/>
                   <FormField control={form.control} name="birthPlace" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>מקום לידה</FormLabel><FormControl><Input {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
               
                <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>סטטוס</FormLabel><Select onValueChange={field.onChange} value={field.value} dir="rtl"><FormControl><SelectTrigger className="bg-white text-zinc-950"><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="alive">חי</SelectItem><SelectItem value="deceased">נפטר</SelectItem><SelectItem value="unknown">לא ידוע</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )}/>
                
                 <FormField control={form.control} name="photoURL" render={({ field }) => (
                  <FormItem className="text-right"><FormLabel>כתובת URL של תמונה (חלופה)</FormLabel><FormControl><Input placeholder="https://" {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                )}/>
                
                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="religion" render={({ field }) => (
                        <FormItem className="text-right"><FormLabel>דת</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} dir="rtl">
                            <FormControl><SelectTrigger className="bg-white text-zinc-950"><SelectValue placeholder="בחר..." /></SelectTrigger></FormControl>
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
                        <FormItem className="text-right"><FormLabel>ארץ מגורים</FormLabel><FormControl><Input {...field} className="bg-white text-zinc-950" /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                <Separator/>

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
                            onClick={() => {}}
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
                          <Textarea className="min-h-[120px] bg-white text-zinc-950" {...field} />
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
                                  <FormControl><SelectTrigger className="w-[120px] bg-white text-zinc-950"><SelectValue /></SelectTrigger></FormControl>
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
                               <Input placeholder="https://" {...field} className="flex-1 bg-white text-zinc-950" />
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
            <DialogFooter className="pt-6 border-t items-center flex-row-reverse justify-between">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                        ביטול
                    </Button>
                    <Button type="submit" disabled={isSaving || isUploading}>
                        {(isSaving || isUploading) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        {buttonText}
                    </Button>
                    {isEditing && (
                        <Button type="button" variant="destructive" onClick={handleDeleteClick} disabled={isSaving}>
                            <Trash2 className="ml-2 h-4 w-4"/>
                            מחק
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="additional-fields-switch">פרטים נוספים</Label>
                    <Switch
                        id="additional-fields-switch"
                        checked={showAdditionalFields}
                        onCheckedChange={setShowAdditionalFields}
                    />
                </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
