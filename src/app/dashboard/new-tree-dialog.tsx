'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser } from '@/firebase';
import { createTree } from '@/lib/actions/trees';
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
  treeName: z.string().min(3, 'Tree name must be at least 3 characters.'),
});

type NewTreeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTreeCreated: () => void;
};

export function NewTreeDialog({
  open,
  onOpenChange,
  onTreeCreated,
}: NewTreeDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      treeName: '',
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(isOpen);
      if (!isOpen) {
        form.reset();
      }
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to create a tree.',
      });
      return;
    }

    setIsLoading(true);
    const result = await createTree({ ...values, userId: user.uid });

    if (result.success && result.data) {
      toast({
        title: 'Tree Created',
        description: `Your new tree "${result.data.treeName}" is ready.`,
      });
      onTreeCreated();
      handleOpenChange(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error,
      });
    }

    setIsLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Family Tree</DialogTitle>
          <DialogDescription>
            Give your new family tree a name. You can change it later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="treeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tree Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., The Doe Family"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Tree
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
