
'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  treeName: z.string().min(3, 'שם העץ חייב להכיל לפחות 3 תווים.'),
});

type RenameTreeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmRename: (newName: string) => Promise<void>;
  currentName: string;
};

export function RenameTreeDialog({
  open,
  onOpenChange,
  onConfirmRename,
  currentName,
}: RenameTreeDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      treeName: currentName,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ treeName: currentName });
    }
  }, [open, currentName, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    await onConfirmRename(values.treeName);
    setIsSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>שנה שם עץ</DialogTitle>
          <DialogDescription>
            הזן שם חדש עבור העץ שלך.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="treeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם העץ</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                ביטול
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                שמור שינויים
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
