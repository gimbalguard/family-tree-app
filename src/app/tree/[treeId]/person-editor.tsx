
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
import type { Person, SocialLink, GalleryPhoto } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Sparkles, Camera, UploadCloud, X } from 'lucide-react';
import { generateDescription } from '@/ai/flows/ai-description-generation-flow';
import { Switch } from '@/components/ui/switch';
import { useUser, useStorage, useFirestore } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc } from 'firebase/firestore';


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
  cityOfResidence: z.string().optional(),
  profession: z.string().optional(),
  hobby: z.string().optional(),
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
  const db = useFirestore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isAvatarDragging, setIsAvatarDragging] = useState(false);
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

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
      religion: '', countryOfResidence: '', cityOfResidence: '',
      profession: '', hobby: ''
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'socialLinks',
  });
  
  const statusValue = form.watch('status');
  const deathDateValue = form.watch('deathDate');

  useEffect(() => {
    // Automatically set status to 'deceased' if a death date is entered
    const currentStatus = form.getValues('status');
    if (deathDateValue && currentStatus !== 'deceased') {
      form.setValue('status', 'deceased');
    }
  }, [deathDateValue, form]);


  useEffect(() => {
    if (isOpen) {
        const defaultValues = {
            firstName: '', lastName: '', gender: 'other' as const, status: 'alive' as const,
            birthDate: '', deathDate: '', birthPlace: '', photoURL: '',
            description: '', socialLinks: [], middleName: '',
            previousFirstName: '', maidenName: '', nickname: '',
            religion: '' as const, countryOfResidence: '', cityOfResidence: '',
            profession: '', hobby: '',
        };

        if (person) {
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
                cityOfResidence: person.cityOfResidence || '',
                profession: person.profession || '',
                hobby: person.hobby || '',
                socialLinks: person.socialLinks || [],
            });
            // Fetch gallery photos
            if (user && db) {
              const galleryRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'people', person.id, 'gallery');
              getDocs(galleryRef).then(snapshot => {
                const photos = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as GalleryPhoto);
                setGallery(photos);
              });
            }
        } else {
            form.reset(defaultValues);
            setGallery([]);
        }
        setShowAdditionalFields(false);
        setIsCameraOpen(false);
        setIsUploading(false);
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }
  }, [person, isOpen, form, cameraStream, db, user, treeId]);

  const handleImageUpload = async (file: File | Blob, isProfile: boolean = true, isGallery: boolean = false) => {
    if (!user || !treeId || !storage || !db || !person) return;
    setIsUploading(true);
  
    try {
      let path: string;
      const filename = `${uuidv4()}-${(file instanceof File) ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'capture.jpg'}`;
  
      if (isGallery) {
        path = `users/${user.uid}/trees/${treeId}/people/${person.id}/gallery/${filename}`;
      } else {
        path = `users/${user.uid}/trees/${treeId}/photos/${filename}`;
      }
      
      const imageRef = storageRef(storage, path);
      const snapshot = await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      if (isProfile) {
        form.setValue('photoURL', downloadURL, { shouldValidate: true });
        toast({ title: 'תמונת הפרופיל הועלתה' });
      }
  
      if (isGallery) {
        const galleryRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'people', person.id, 'gallery');
        const newPhotoDoc = {
          userId: user.uid,
          treeId,
          personId: person.id,
          url: downloadURL,
          storagePath: path,
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(galleryRef, newPhotoDoc);
        setGallery(prev => [...prev, { ...newPhotoDoc, id: docRef.id, createdAt: new Date() as any }]);
        toast({ title: 'תמונה נוספה לגלריה' });
      }
  
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ variant: 'destructive', title: 'שגיאת העלאה', description: error.message || 'An unknown error occurred' });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleGalleryPhotoDelete = async (photo: GalleryPhoto) => {
    if (!user || !db || !storage) return;

    try {
      // Delete from storage
      const photoStorageRef = storageRef(storage, photo.storagePath);
      await deleteObject(photoStorageRef);

      // Delete from firestore
      const photoDocRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', photo.personId, 'gallery', photo.id);
      await deleteDoc(photoDocRef);

      setGallery(prev => prev.filter(p => p.id !== photo.id));
      toast({ title: 'התמונה נמחקה מהגלריה' });
    } catch (error) {
      console.error("Error deleting gallery photo:", error);
      toast({ variant: 'destructive', title: 'שגיאת מחיקה' });
    }
  };
  
  const handleAvatarDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAvatarDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0], true, false);
    }
  };
  
  const handleGalleryFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const filesToUpload = Array.from(files).slice(0, 15 - gallery.length);
    if (filesToUpload.length < files.length) {
        toast({
            variant: 'destructive',
            title: 'הגעת למגבלת התמונות',
            description: `ניתן להעלות עד ${15 - gallery.length} תמונות נוספות.`,
        });
    }

    // Process files one by one to give user feedback
    for (const file of filesToUpload) {
        await handleImageUpload(file, false, true);
    }
  };
  
  const handleGalleryDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGalleryDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleGalleryFilesSelected(e.dataTransfer.files);
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
    // Remove the socialLinks array before saving, as it's handled in a subcollection
    const { socialLinks, ...personData } = values;
    const dataToSave = { id: person?.id, ...personData };
    await onSave(dataToSave);
    setIsSaving(false);
    onClose();
  }
  
  const buttonText = isEditing ? 'שמור שינויים' : 'צור אדם';
  const photoUrlValue = form.watch('photoURL');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl w-[90vw] flex flex-col max-h-[90vh] z-[1002]" dir="rtl" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="text-right">
          <DialogTitle>{isEditing ? 'עריכת אדם' : 'הוספת אדם חדש'}</DialogTitle>
          <DialogDescription>
            {isEditing ? `עריכת הפרופיל של ${person?.firstName} ${person?.lastName}.` : 'הוסף אדם חדש לעץ המשפחה שלך.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
             <div className="flex-1 overflow-y-auto p-6 space-y-6">

                <div 
                  className={cn(
                    "relative w-40 h-40 mx-auto rounded-full border-2 border-dashed flex items-center justify-center text-muted-foreground transition-colors",
                    isAvatarDragging && "border-primary bg-primary/10"
                  )}
                  onDragEnter={(e) => {e.preventDefault(); e.stopPropagation(); setIsAvatarDragging(true);}}
                  onDragLeave={(e) => {e.preventDefault(); e.stopPropagation(); setIsAvatarDragging(false);}}
                  onDragOver={(e) => {e.preventDefault(); e.stopPropagation();}}
                  onDrop={handleAvatarDrop}
                >
                  <Avatar className="w-full h-full">
                    <AvatarImage src={photoUrlValue || undefined} className="object-cover" />
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
                    <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                      <Loader2 className="w-10 h-10 animate-spin text-primary" />
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

                <FormField control={form.control} name="photoURL" render={({ field }) => (
                  <FormItem className="text-right">
                    <FormLabel>כתובת URL של תמונה (חלופה)</FormLabel>
                    <FormControl><Input placeholder="https://" {...field} value={field.value || ''} className="bg-card" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>


                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>שם פרטי</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                  )}/>
                   <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>שם משפחה</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
                
                {showAdditionalFields && (
                    <div className="space-y-6 p-4 border rounded-md bg-muted/20">
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="middleName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם אמצעי</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="nickname" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>כינוי</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="previousFirstName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם פרטי קודם</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={form.control} name="maidenName" render={({ field }) => (
                                <FormItem className="text-right"><FormLabel>שם משפחה קודם (נעורים)</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                    </div>
                )}

                 <div className="grid grid-cols-2 gap-4">
                   <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>תאריך לידה</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="birthPlace" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>מקום לידה</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>מין</FormLabel><Select onValueChange={field.onChange} value={field.value} dir="rtl"><FormControl><SelectTrigger className="bg-card"><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="male">זכר</SelectItem><SelectItem value="female">נקבה</SelectItem><SelectItem value="other">אחר</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )}/>
                   <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem className="text-right">
                        <FormLabel>סטטוס</FormLabel>
                        <Select onValueChange={(value) => {
                            field.onChange(value);
                            if (value !== 'deceased') {
                                form.setValue('deathDate', '', { shouldValidate: true });
                            }
                        }} value={field.value} dir="rtl">
                            <FormControl><SelectTrigger className="bg-card"><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="alive">חי</SelectItem>
                                <SelectItem value="deceased">נפטר</SelectItem>
                                <SelectItem value="unknown">לא ידוע</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )}/>
                </div>
               
                {statusValue === 'deceased' && (
                     <FormField control={form.control} name="deathDate" render={({ field }) => (
                        <FormItem className="text-right"><FormLabel>תאריך פטירה</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                    )}/>
                )}
                
                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="countryOfResidence" render={({ field }) => (
                        <FormItem className="text-right"><FormLabel>ארץ מגורים</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="cityOfResidence" render={({ field }) => (
                        <FormItem className="text-right"><FormLabel>עיר מגורים</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="profession" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>מקצוע</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="hobby" render={({ field }) => (
                    <FormItem className="text-right"><FormLabel>תחביב</FormLabel><FormControl><Input {...field} value={field.value || ''} className="bg-card" /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
                <div className="grid grid-cols-1">
                    <FormField control={form.control} name="religion" render={({ field }) => (
                        <FormItem className="text-right"><FormLabel>דת</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} dir="rtl">
                            <FormControl><SelectTrigger className="bg-card"><SelectValue placeholder="בחר..." /></SelectTrigger></FormControl>
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
                          <Textarea className="min-h-[120px] bg-card" {...field} value={field.value || ''} />
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
                                  <FormControl><SelectTrigger className="w-[120px] bg-card"><SelectValue /></SelectTrigger></FormControl>
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
                               <Input placeholder="https://" {...field} value={field.value || ''} className="flex-1 bg-card" />
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

                {isEditing && (
                  <div 
                    className={cn(
                        "space-y-2 text-right relative border-2 border-dashed rounded-lg p-4 transition-colors",
                        isGalleryDragging ? "border-primary bg-primary/10" : "border-transparent"
                    )}
                    onDragEnter={(e) => {e.preventDefault(); e.stopPropagation(); setIsGalleryDragging(true);}}
                    onDragLeave={(e) => {e.preventDefault(); e.stopPropagation(); setIsGalleryDragging(false);}}
                    onDragOver={(e) => {e.preventDefault(); e.stopPropagation();}}
                    onDrop={handleGalleryDrop}
                  >
                    <Label>גלריית תמונות</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {gallery.map(photo => (
                        <div key={photo.id} className="relative group aspect-square">
                          <img src={photo.url} alt="Gallery photo" className="w-full h-full object-cover rounded-md border" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleGalleryPhotoDelete(photo)}>
                              <Trash2 className="h-4 w-4"/>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {gallery.length < 15 && (
                        <button type="button" onClick={() => galleryFileInputRef.current?.click()} className="aspect-square border-2 border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary">
                          <UploadCloud className="h-8 w-8" />
                          <span className="text-xs mt-1 text-center">הוסף תמונות<br/>(עד {15-gallery.length})</span>
                        </button>
                      )}
                    </div>
                    <input type="file" ref={galleryFileInputRef} multiple onChange={(e) => handleGalleryFilesSelected(e.target.files)} className="hidden" accept="image/*" />
                  </div>
                )}
              </div>
            <DialogFooter className="pt-6 border-t items-center flex justify-between">
                <div>
                     {isEditing && (
                        <Button type="button" variant="ghost" size="icon" onClick={handleDeleteClick} disabled={isSaving}>
                            <Trash2 className="h-5 w-5 text-destructive"/>
                            <span className="sr-only">מחק</span>
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="additional-fields-switch">פרטים נוספים</Label>
                        <Switch
                            id="additional-fields-switch"
                            checked={showAdditionalFields}
                            onCheckedChange={setShowAdditionalFields}
                        />
                    </div>
                    <div className='flex items-center gap-2'>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                            ביטול
                        </Button>
                        <Button type="submit" disabled={isSaving || isUploading}>
                            {(isSaving || isUploading) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {buttonText}
                        </Button>
                    </div>
                </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
