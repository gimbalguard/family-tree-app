'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Connection } from 'reactflow';
import { useEffect, useState, useMemo } from 'react';

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
import { Trash2 } from 'lucide-react';

const relationshipSchema = z.object({
  relationshipType: z.string(), // value will be 'father', 'mother', etc.
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

// Mapping for relationship options
const relationshipOptions = [
    { value: 'father', label: 'אבא', type: 'parent', gender: 'male', direction: 'parent' },
    { value: 'mother', label: 'אמא', type: 'parent', gender: 'female', direction: 'parent' },
    { value: 'adoptive_father', label: 'אבא מאמץ', type: 'adoptive_parent', gender: 'male', direction: 'parent' },
    { value: 'adoptive_mother', label: 'אמא מאמצת', type: 'adoptive_parent', gender: 'female', direction: 'parent' },
    { value: 'step_father', label: 'אבא חורג', type: 'step_parent', gender: 'male', direction: 'parent' },
    { value: 'step_mother', label: 'אמא חורגת', type: 'step_parent', gender: 'female', direction: 'parent' },
    { value: 'spouse', label: 'בן/בת זוג', type: 'spouse' },
    { value: 'ex_spouse', label: 'בן/בת זוג לשעבר', type: 'ex_spouse' },
    { value: 'sibling', label: 'אח/אחות', type: 'sibling' },
    { value: 'twin', label: 'תאום/תאומה', type: 'twin' },
    { value: 'guardian', label: 'אפוטרופוס', type: 'guardian' },
    { value: 'godparent', label: 'סנדק/סנדקית', type: 'godparent' },
];


type RelationshipModalProps = {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection | null;
  relationship: Relationship | null;
  people: Person[];
  onSave: (data: { relData: any, genderUpdate?: { personId: string, gender: 'male' | 'female' | 'other' }}) => void;
  onDelete: (relationshipId: string) => void;
};

export function RelationshipModal({
  isOpen,
  onClose,
  connection,
  relationship,
  people,
  onSave,
  onDelete,
}: RelationshipModalProps) {
  
  const isEditing = !!relationship;

  const form = useForm<z.infer<typeof relationshipSchema>>({
    resolver: zodResolver(relationshipSchema),
    defaultValues: { relationshipType: 'father', startDate: '', endDate: '', notes: '' },
  });

  // Determine personA and personB from either connection or existing relationship
  const { personA, personB } = useMemo(() => {
    // For a new connection, source is where the drag started. Let's assume this is the active person (e.g. the parent).
    const sourceId = relationship?.personAId || connection?.source;
    const targetId = relationship?.personBId || connection?.target;
    return {
      personA: people.find((p) => p.id === sourceId),
      personB: people.find((p) => p.id === targetId),
    };
  }, [connection, relationship, people]);

  useEffect(() => {
    if (isOpen && relationship) {
        // Find the specific relationship value (e.g. 'father'/'mother') from the generic type and gender
        const personAGender = personA?.gender;
        let selectedType = relationshipOptions.find(o => o.type === relationship.relationshipType && o.gender === personAGender);
        if (!selectedType) {
            // Fallback for non-gendered or default
            selectedType = relationshipOptions.find(o => o.type === relationship.relationshipType);
        }

        form.reset({
            relationshipType: selectedType?.value || '',
            startDate: relationship.startDate || '',
            endDate: relationship.endDate || '',
            notes: relationship.notes || '',
        });
    } else if (isOpen && !relationship) {
        // Reset for new connection
        form.reset({
            relationshipType: 'father',
            startDate: '',
            endDate: '',
            notes: '',
        });
    }
  }, [relationship, personA, form, isOpen]); // Rerun when modal opens/relationship changes

  function onSubmit(values: z.infer<typeof relationshipSchema>) {
    const selectedOption = relationshipOptions.find(o => o.value === values.relationshipType);
    if (!selectedOption || !personA || !personB) return;
    
    let personAId = personA.id;
    let personBId = personB.id;

    // For non-parental relationships that are symmetrical, sort by ID for consistency
    const symmetricalTypes = ['spouse', 'sibling', 'twin', 'ex_spouse'];
    if(symmetricalTypes.includes(selectedOption.type) && personAId > personBId) {
        [personAId, personBId] = [personBId, personAId];
    }
    
    // For parent-child, personA is always the parent (the source of the drag)
    if (selectedOption.direction === 'parent') {
        personAId = personA.id;
        personBId = personB.id;
    }

    const relData = {
      personAId,
      personBId,
      relationshipType: selectedOption.type,
      startDate: values.startDate,
      endDate: values.endDate,
      notes: values.notes,
    };
    
    let genderUpdate;
    if (selectedOption.gender) {
        // Only suggest update if gender is different
        if (personA.gender !== selectedOption.gender) {
            genderUpdate = { personId: personAId, gender: selectedOption.gender as 'male' | 'female' };
        }
    }
    
    onSave({ relData, genderUpdate });
  }

  const handleDelete = () => {
    if (relationship) {
      onDelete(relationship.id);
    }
  }

  const relationshipType = form.watch('relationshipType');
  const currentSelectedOption = relationshipOptions.find(opt => opt.value === relationshipType);

  if (!personA || !personB) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="rounded-xl">
        <DialogHeader className="text-right">
          <DialogTitle>{isEditing ? 'עריכת קשר' : 'הגדרת קשר'}</DialogTitle>
          <DialogDescription>
            {isEditing ? `עריכת הקשר בין` : `צור קשר בין`}{' '}
            <strong>{`${personA.firstName} ${personA.lastName}`}</strong> ו-{' '}
            <strong>{`${personB.firstName} ${personB.lastName}`}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="flex items-center justify-center gap-2 text-lg text-center bg-muted p-3 rounded-md">
                <strong>{personA.firstName}</strong>
                <span className="text-muted-foreground">{currentSelectedOption?.label}</span>
                <span className="text-muted-foreground">של</span>
                <strong>{personB.firstName}</strong>
            </div>

            <FormField
              control={form.control}
              name="relationshipType"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>סוג קשר</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                        {relationshipOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                   </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
               <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem className="text-right"><FormLabel>תאריך התחלה (אופציונלי)</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )}/>
               <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem className="text-right"><FormLabel>תאריך סיום (אופציונלי)</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )}/>
            </div>
             <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="text-right"><FormLabel>הערות (אופציונלי)</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
              )}/>
            <DialogFooter className="pt-2 sm:justify-between sm:flex-row-reverse">
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
                <Button type="submit">שמור קשר</Button>
              </div>
              {isEditing && (
                 <Button type="button" variant="destructive" onClick={handleDelete}>
                    <Trash2 className="ml-2"/>
                    מחק קשר
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
