'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Connection } from 'reactflow';

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
import { Textarea } from '@/components/ui/textarea';
import type { Person, Relationship } from '@/lib/types';

const relationshipSchema = z.object({
  relationshipType: z.enum([
    'parent',
    'spouse',
    'adoptive_parent',
    'step_parent',
  ]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

type RelationshipModalProps = {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection;
  people: Person[];
  onSave: (data: Omit<Relationship, 'id' | 'treeId' | 'userId'>) => void;
};

export function RelationshipModal({
  isOpen,
  onClose,
  connection,
  people,
  onSave,
}: RelationshipModalProps) {
  const form = useForm<z.infer<typeof relationshipSchema>>({
    resolver: zodResolver(relationshipSchema),
    defaultValues: { relationshipType: 'parent' },
  });

  const personA = people.find((p) => p.id === connection.source);
  const personB = people.find((p) => p.id === connection.target);

  function onSubmit(values: z.infer<typeof relationshipSchema>) {
    if (!connection.source || !connection.target) return;
    
    // For parent relationship, source is parent, target is child.
    let personAId = connection.source;
    let personBId = connection.target;
    
    // For spouses, order doesn't matter, but let's be consistent.
    if(values.relationshipType === 'spouse' && connection.source > connection.target) {
        [personAId, personBId] = [connection.target, connection.source];
    }
    
    onSave({
      ...values,
      personAId: personAId,
      personBId: personBId,
      relationshipType: values.relationshipType,
    });
  }

  if (!personA || !personB) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הגדרת קשר</DialogTitle>
          <DialogDescription>
            צור קשר בין{' '}
            <strong>{`${personA.firstName} ${personA.lastName}`}</strong> ו-{' '}
            <strong>{`${personB.firstName} ${personB.lastName}`}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="relationshipType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג קשר</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="parent">הורה</SelectItem>
                        <SelectItem value="spouse">בן/בת זוג</SelectItem>
                        <SelectItem value="adoptive_parent">הורה מאמץ</SelectItem>
                        <SelectItem value="step_parent">הורה חורג</SelectItem>
                    </SelectContent>
                   </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
               <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>תאריך התחלה (אופציונלי)</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )}/>
               <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem><FormLabel>תאריך סיום (אופציונלי)</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )}/>
            </div>
             <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>הערות (אופציונלי)</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
              )}/>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
              <Button type="submit">שמור קשר</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
