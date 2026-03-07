
'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useAuth, useStorage } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { updateProfile, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';

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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UploadCloud } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const accountSchema = z.object({
  displayName: z.string().min(1, 'שם תצוגה הוא שדה חובה.'),
});

type AccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { user } = useUser();
  const auth = useAuth();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      displayName: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
      });
    }
  }, [user, form, isOpen]);

  const handleUpdateProfile = async (values: z.infer<typeof accountSchema>) => {
    if (!user) return;
    setIsLoading(true);
    try {
      await updateProfile(user, { displayName: values.displayName });
      toast({ title: 'הפרופיל עודכן בהצלחה' });
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה לעדכן את הפרופIL.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!user || !storage) return;
    setIsUploading(true);
    try {
      const filePath = `users/${user.uid}/avatars/${uuidv4()}-${file.name}`;
      const fileRef = storageRef(storage, filePath);
      const snapshot = await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(snapshot.ref);

      await updateProfile(user, { photoURL });
      // The useUser hook will pick up the change and re-render components.
      toast({ title: 'תמונת הפרופיל עודכנה' });
    } catch (error: any) {
      console.error("Image upload failed:", error); // Log the full error for debugging
      toast({
        variant: 'destructive',
        title: 'שגיאת העלאה',
        description: error.message || 'לא ניתן היה להעלות את התמונה.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({
        title: 'אימייל לאיפוס סיסמה נשלח',
        description: 'בדוק את תיבת הדואר הנכנס שלך.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה לשלוח את אימייל האיפוס.',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>החשבון שלי</DialogTitle>
          <DialogDescription>נהל את פרטי החשבון והאבטחה שלך.</DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-6 py-2">
          {/* User Details Section */}
          <div className="space-y-4">
            <h3 className="font-semibold">פרטי משתמש</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.photoURL ?? undefined} />
                  <AvatarFallback>{user?.displayName?.charAt(0) ?? '?'}</AvatarFallback>
                </Avatar>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute -bottom-2 -left-2 h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                />
              </div>
              <div className="text-sm text-muted-foreground flex-1">
                <p>
                  <strong>אימייל:</strong> {user?.email}
                </p>
                <p className="mt-1">
                  לחץ על העיפרון כדי להעלות תמונה חדשה.
                </p>
              </div>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdateProfile)}>
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שם תצוגה</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <Button type="submit" size="sm" className="mt-4" disabled={isLoading}>
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  שמור שם תצוגה
                </Button>
              </form>
            </Form>
          </div>

          <Separator />

          {/* Security Section */}
          {!user?.isAnonymous && (
            <div className="space-y-4">
              <h3 className="font-semibold">אבטחה</h3>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm">שנה את הסיסמה שלך</p>
                <Button variant="outline" size="sm" onClick={handlePasswordReset}>
                  שלח אימייל לאיפוס
                </Button>
              </div>
            </div>
          )}


          <Separator />
          
          {/* Account Actions Section */}
          <div className="space-y-4">
             <h3 className="font-semibold">פעולות בחשבון</h3>
             <div className="flex items-center justify-start gap-4">
                 <Button variant="destructive" onClick={handleSignOut}>התנתקות</Button>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
