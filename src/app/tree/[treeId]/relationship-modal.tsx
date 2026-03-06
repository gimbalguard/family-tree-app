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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Loader2, Trash2 } from 'lucide-react';

const relationshipSchema = z.object({
  relationshipType: z.string().min(1, 'יש לבחור סוג קשר.'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export const relationshipOptions = [
    // Parental (top/bottom handles)
    { value: 'father', label: 'אבא', type: 'parent', gender: 'male', direction: 'parent', category: 'parental', dates: 'none' },
    { value: 'mother', label: 'אמא', type: 'parent', gender: 'female', direction: 'parent', category: 'parental', dates: 'none' },
    { value: 'adoptive_father', label: 'אבא מאמץ', type: 'adoptive_parent', gender: 'male', direction: 'parent', category: 'parental', dates: 'both' },
    { value: 'adoptive_mother', label: 'אמא מאמצת', type: 'adoptive_parent', gender: 'female', direction: 'parent', category: 'parental', dates: 'both' },
    { value: 'step_father', label: 'אבא חורג', type: 'step_parent', gender: 'male', direction: 'parent', category: 'parental', dates: 'start' },
    { value: 'step_mother', label: 'אמא חורגת', type: 'step_parent', gender: 'female', direction: 'parent', category: 'parental', dates: 'start' },
    { value: 'guardian', label: 'אפוטרופוס', type: 'guardian', direction: 'parent', category: 'parental', dates: 'start' },

    // Children (top/bottom handles)
    { value: 'son_daughter', label: 'בן/בת', type: 'parent', direction: 'child', category: 'parental', dates: 'none' },
    { value: 'adopted_son_daughter', label: 'בן/בת מאומץ', type: 'adoptive_parent', direction: 'child', category: 'parental', dates: 'both' },
    { value: 'step_son_daughter', label: 'בן/בת חורג', type: 'step_parent', direction: 'child', category: 'parental', dates: 'start' },

    // Spousal (upper side handles)
    { value: 'married', label: 'נשואים', type: 'spouse', category: 'spousal', dates: 'both' },
    { value: 'divorced', label: 'גרושים', type: 'ex_spouse', category: 'spousal', dates: 'both' },
    { value: 'separated', label: 'פרודים', type: 'separated', category: 'spousal', dates: 'both' },
    { value: 'partner', label: 'בן/בת זוג', type: 'partner', category: 'spousal', dates: 'both' },
    { value: 'ex_partner', label: 'בן/בת זוג לשעבר', type: 'ex_partner', category: 'spousal', dates: 'both' },

    // Sibling (lower side handles)
    { value: 'sibling', label: 'אח/אחות', type: 'sibling', category: 'sibling', dates: 'none' },
    { value: 'twin', label: 'תאום/תאומה', type: 'twin', category: 'sibling', dates: 'none' },
    { value: 'step_sibling', label: 'אח/אחות חורג', type: 'step_sibling', category: 'sibling', dates: 'none' },
];


type RelationshipModalProps = {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection | null;
  relationship: Relationship | null;
  people: Person[];
  onSave: (data: { relData: any, genderUpdate?: { personId: string, gender: 'male' | 'female' | 'other' }}) => void;
  onDelete: (relationshipId: string) => Promise<void>;
};

function getRelationshipValue(relationship: Relationship, sourcePerson: Person) {
  const { relationshipType } = relationship;
  if (['parent', 'adoptive_parent', 'step_parent', 'guardian'].includes(relationshipType)) {
    // It's a parent-child relationship, personA is parent. Find the option based on parent's gender.
    const option = relationshipOptions.find(o => 
        o.type === relationshipType && 
        o.gender === sourcePerson?.gender &&
        o.direction === 'parent'
    );
    // Fallback for guardian which has no gender
    return option?.value || relationshipOptions.find(o => o.type === relationshipType)?.value || '';
  } else {
    // For symmetrical, find the type that matches. e.g. 'spouse' -> 'married'
    return relationshipOptions.find(o => o.type === relationshipType)?.value || '';
  }
}

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
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<z.infer<typeof relationshipSchema>>({
    resolver: zodResolver(relationshipSchema),
    defaultValues: { relationshipType: '', startDate: '', endDate: '', notes: '' },
  });

  const { sourcePerson, targetPerson } = useMemo(() => {
    let sourceId, targetId;

    if (isEditing && relationship) {
        sourceId = relationship.personAId;
        targetId = relationship.personBId;
    } else if (connection) {
        sourceId = connection.source;
        targetId = connection.target;
    }

    return { 
        sourcePerson: people.find(p => p.id === sourceId), 
        targetPerson: people.find(p => p.id === targetId) 
    };
  }, [connection, relationship, people, isEditing]);


  useEffect(() => {
    if (isOpen) {
      if (isEditing && relationship && sourcePerson) {
        const selectedType = getRelationshipValue(relationship, sourcePerson);
        form.reset({
          relationshipType: selectedType,
          startDate: relationship.startDate || '',
          endDate: relationship.endDate || '',
          notes: relationship.notes || '',
        });
      } else {
        form.reset({
          relationshipType: '',
          startDate: '',
          endDate: '',
          notes: '',
        });
      }
    }
  }, [relationship, sourcePerson, form, isOpen, isEditing]);


  function onSubmit(values: z.infer<typeof relationshipSchema>) {
    const selectedOption = relationshipOptions.find(o => o.value === values.relationshipType);
    if (!selectedOption || !sourcePerson || !targetPerson) return;
    
    let personAId, personBId, genderUpdatePerson, genderForUpdate;

    if (selectedOption.direction === 'parent') {
        personAId = sourcePerson.id; // Person A is parent
        personBId = targetPerson.id; // Person B is child
        genderUpdatePerson = sourcePerson;
        genderForUpdate = selectedOption.gender;
    } else if (selectedOption.direction === 'child') {
        personAId = targetPerson.id; // Person A is parent
        personBId = sourcePerson.id; // Person B is child
        genderUpdatePerson = targetPerson;
        // child-directed options don't have gender, so we can't infer it this way.
        genderForUpdate = undefined;
    } else { // Symmetrical, non-parental
        [personAId, personBId] = [sourcePerson.id, targetPerson.id].sort();
    }
    
    const relData = {
      id: isEditing ? relationship.id : undefined,
      personAId: personAId,
      personBId: personBId,
      relationshipType: selectedOption.type,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      notes: values.notes || null,
    };
    
    let genderUpdate;
    if (genderUpdatePerson && genderForUpdate) {
        if (genderUpdatePerson && genderUpdatePerson.gender !== genderForUpdate) {
            genderUpdate = { personId: genderUpdatePerson.id, gender: genderForUpdate as 'male' | 'female' };
        }
    }
    
    onSave({ relData, genderUpdate });
  }

  const handleDelete = async () => {
    if (relationship) {
      console.log('DELETE CALLED WITH ID:', relationship.id);
      setIsDeleting(true);
      try {
        await onDelete(relationship.id);
        // On success, parent component will close the main modal.
        // We just need to close this confirmation dialog.
        setDeleteConfirmOpen(false);
      } catch (e) {
        // Error is already handled and toasted by the parent.
        // Spinner will stop in the finally block.
      } finally {
        // Ensure spinner stops even if the delete fails.
        setIsDeleting(false);
      }
    }
  };

  const relationshipType = form.watch('relationshipType');
  const currentSelectedOption = useMemo(() => {
    return relationshipOptions.find(opt => opt.value === relationshipType);
  }, [relationshipType]);

  const dateVisibility = currentSelectedOption?.dates || 'none';

  const isChildDirection = currentSelectedOption?.direction === 'child';
  const displaySubject = isChildDirection ? targetPerson : sourcePerson;
  const displayObject = isChildDirection ? sourcePerson : targetPerson;
  
  if (!sourcePerson || !targetPerson) {
    return null;
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="rounded-xl">
        <DialogHeader className="text-right">
          <DialogTitle>{isEditing ? 'עריכת קשר' : 'הגדרת קשר'}</DialogTitle>
          <DialogDescription>
            {isEditing ? `עריכת הקשר בין` : `צור קשר בין`}{' '}
            <strong>{`${sourcePerson.firstName} ${sourcePerson.lastName}`}</strong> ו-{' '}
            <strong>{`${targetPerson.firstName} ${targetPerson.lastName}`}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="flex items-center justify-center gap-2 text-lg text-center bg-muted p-3 rounded-md">
                <strong>{displaySubject?.firstName}</strong>
                <span className="text-muted-foreground">{currentSelectedOption?.label}</span>
                <span className="text-muted-foreground">{isChildDirection ? 'של' : ''}</span>
                <strong>{displayObject?.firstName}</strong>
            </div>

            <FormField
              control={form.control}
              name="relationshipType"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>סוג קשר</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                    <FormControl><SelectTrigger><SelectValue placeholder="בחר סוג קשר..." /></SelectTrigger></FormControl>
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
            {dateVisibility !== 'none' && (
                <div className={`grid ${dateVisibility === 'both' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                        <FormItem className="text-right">
                            <FormLabel>תאריך התחלה</FormLabel>
                            <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                        </FormItem>
                    )}
                />
                {dateVisibility === 'both' && (
                    <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                            <FormItem className="text-right">
                                <FormLabel>תאריך סיום</FormLabel>
                                <FormControl><Input type="date" {...field} value={field.value || ''}/></FormControl>
                            </FormItem>
                        )}
                    />
                )}
                </div>
            )}
             <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="text-right"><FormLabel>הערות (אופציונלי)</FormLabel><FormControl><Textarea {...field} value={field.value || ''} /></FormControl></FormItem>
              )}/>
            <DialogFooter className="pt-4 mt-4 border-t flex flex-row-reverse justify-between items-center">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
                <Button type="submit">שמור קשר</Button>
              </div>
              {isEditing && (
                 <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteConfirmOpen(true)}>
                    <Trash2 className="h-5 w-5 text-destructive"/>
                    <span className="sr-only">מחק קשר</span>
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader className="text-right">
                <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                <AlertDialogDescription>
                    פעולה זו תמחק לצמיתות את הקשר. לא ניתן לבטל פעולה זו.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    מחק
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
