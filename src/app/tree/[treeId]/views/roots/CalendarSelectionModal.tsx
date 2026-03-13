'use client';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import type { Person, Relationship, ManualEvent } from '@/lib/types';
import { format, getMonth, getDate, getYear, parseISO, isValid } from 'date-fns';
import { he } from 'date-fns/locale';

// --- Event Processing Logic (from CalendarView) ---
type CalendarEventType = 'birth' | 'death' | 'marriage' | 'divorce' | 'custom';
type CalEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  originalDate: Date;
  people: Person[];
  isAnniversary: boolean;
};

function processEvents(people: Person[], relationships: Relationship[], manualEvents: ManualEvent[]): CalEvent[] {
  const events: CalEvent[] = [];
  people.forEach((person) => {
    if (person.birthDate && isValid(parseISO(person.birthDate))) {
      events.push({ id: `birth-${person.id}`, type: 'birth', title: `יום הולדת - ${person.firstName}`, originalDate: parseISO(person.birthDate), people: [person], isAnniversary: true });
    }
    if (person.deathDate && isValid(parseISO(person.deathDate))) {
      events.push({ id: `death-${person.id}`, type: 'death', title: `יום פטירה - ${person.firstName}`, originalDate: parseISO(person.deathDate), people: [person], isAnniversary: true });
    }
  });
  relationships.forEach((rel) => {
    if ((rel.relationshipType === 'spouse' || rel.relationshipType === 'partner') && rel.startDate && isValid(parseISO(rel.startDate))) {
      const pA = people.find(p => p.id === rel.personAId);
      const pB = people.find(p => p.id === rel.personBId);
      if (pA && pB) {
        events.push({ id: `marriage-${rel.id}`, type: 'marriage', title: `נישואין - ${pA.firstName} ו${pB.firstName}`, originalDate: parseISO(rel.startDate), people: [pA, pB], isAnniversary: true });
      }
    }
  });
  manualEvents.forEach((me) => {
    if (isValid(parseISO(me.date))) {
        events.push({ id: me.id, type: 'custom', title: me.title, originalDate: parseISO(me.date), people: [], isAnniversary: me.allDay });
    }
  });
  return events;
}

// --- Main Modal Component ---
interface CalendarSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedIds: string[]) => void;
    people: Person[];
    relationships: Relationship[];
    manualEvents: ManualEvent[];
    involvedPeopleIds: string[];
    initialSelected: string[];
}

export function CalendarSelectionModal({ isOpen, onClose, onConfirm, people, relationships, manualEvents, involvedPeopleIds, initialSelected }: CalendarSelectionModalProps) {
    const [selectedEventIds, setSelectedEventIds] = useState<string[]>(initialSelected);
    const [searchTerm, setSearchTerm] = useState('');

    const allEvents = useMemo(() => processEvents(people, relationships, manualEvents), [people, relationships, manualEvents]);
    
    const { recommendedEvents, otherEvents } = useMemo(() => {
        const recommended: CalEvent[] = [];
        const others: CalEvent[] = [];
        const busyDays = new Map<string, number>();

        allEvents.forEach(event => {
            const dayKey = format(event.originalDate, 'yyyy-MM-dd');
            busyDays.set(dayKey, (busyDays.get(dayKey) || 0) + 1);
        });

        allEvents.forEach(event => {
            const isRelated = event.people.some(p => involvedPeopleIds.includes(p.id));
            const isBusy = (busyDays.get(format(event.originalDate, 'yyyy-MM-dd')) || 0) > 1;

            if (isRelated || isBusy) {
                recommended.push(event);
            } else {
                others.push(event);
            }
        });
        return { recommendedEvents: recommended, otherEvents: others };
    }, [allEvents, involvedPeopleIds]);

    const filteredRecommended = useMemo(() => recommendedEvents.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())), [recommendedEvents, searchTerm]);
    const filteredOthers = useMemo(() => otherEvents.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())), [otherEvents, searchTerm]);

    const toggleEvent = (id: string) => {
        setSelectedEventIds(prev => prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]);
    };

    const EventRow = ({ event }: { event: CalEvent }) => (
        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-800/50">
            <Checkbox id={`evt-${event.id}`} checked={selectedEventIds.includes(event.id)} onCheckedChange={() => toggleEvent(event.id)} />
            <Label htmlFor={`evt-${event.id}`} className="flex-1 cursor-pointer">
                <span className="font-semibold">{event.title}</span>
                <span className="text-xs text-muted-foreground mr-2">{format(event.originalDate, 'd MMMM yyyy', { locale: he })}</span>
            </Label>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl w-full h-[70vh] flex flex-col p-0" dir="rtl">
                <DialogHeader className="p-6 pb-2 text-right">
                    <DialogTitle>בחירת אירועים חשובים</DialogTitle>
                    <DialogDescription>בחר את האירועים מלוח השנה שתרצה להדגיש במצגת.</DialogDescription>
                </DialogHeader>
                <div className="px-6 pb-4 border-b">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="חיפוש אירוע..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pr-10" />
                    </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 space-y-4">
                        {filteredRecommended.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-bold text-sm text-primary">אירועים מומלצים</h3>
                                {filteredRecommended.map(event => <EventRow key={event.id} event={event} />)}
                            </div>
                        )}
                         {filteredOthers.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-bold text-sm text-muted-foreground pt-3 border-t">כל האירועים</h3>
                                {filteredOthers.map(event => <EventRow key={event.id} event={event} />)}
                            </div>
                        )}
                        {filteredRecommended.length === 0 && filteredOthers.length === 0 && (
                            <p className="text-center text-muted-foreground py-10">לא נמצאו אירועים.</p>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="p-4 border-t">
                     <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
                    <Button type="button" onClick={() => onConfirm(selectedEventIds)}>אישור</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
