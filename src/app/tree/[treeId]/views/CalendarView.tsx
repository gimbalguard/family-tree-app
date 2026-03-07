'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Person, Relationship, ManualEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  format,
  getYear,
  getMonth,
  getDate,
  differenceInYears,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isSameDay,
  set,
  getDay
} from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter, PlusCircle, Clock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';

// --- DATA PROCESSING & TYPES (UNCHANGED) ---
type CalendarEventType = 'birth' | 'death' | 'marriage' | 'divorce' | 'custom';
type ViewMode = 'month' | 'week' | 'four-day' | 'day';

const eventTypeConfig: Record<CalendarEventType, { label: string; color: string; textColor: string; }> = {
  birth: { label: 'יום הולדת', color: '#16a34a', textColor: 'text-white' },
  death: { label: 'יום פטירה', color: '#1a1a1a', textColor: 'text-white' },
  marriage: { label: 'נישואין', color: '#ca8a04', textColor: 'text-white' },
  divorce: { label: 'גירושין', color: '#dc2626', textColor: 'text-white' },
  custom: { label: 'אירוע', color: '#7c3aed', textColor: 'text-white' }, // Default
};

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  date: Date;
  people: Person[];
  notes?: string | null;
  isAnniversary: boolean;
  color: string;
  textColor: string;
  allDay: boolean;
  time?: string;
  endDate?: Date;
};

const processEvents = (people: Person[], relationships: Relationship[], manualEvents: ManualEvent[]): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  
  people.forEach((person) => {
    if (person.birthDate) {
      const date = new Date(person.birthDate);
      if (isValid(date)) {
        events.push({
          id: `birth-${person.id}`, type: 'birth', title: `יומולדת ל${person.firstName}`,
          date, people: [person], isAnniversary: true, color: eventTypeConfig.birth.color, textColor: eventTypeConfig.birth.textColor, allDay: true,
        });
      }
    }
    if (person.deathDate) {
      const date = new Date(person.deathDate);
      if (isValid(date)) {
        events.push({
          id: `death-${person.id}`, type: 'death', title: `יום פטירה של ${person.firstName}`,
          date, people: [person], isAnniversary: true, color: eventTypeConfig.death.color, textColor: eventTypeConfig.death.textColor, allDay: true,
        });
      }
    }
  });

  relationships.forEach((rel) => {
    const personA = people.find((p) => p.id === rel.personAId);
    const personB = people.find((p) => p.id === rel.personBId);
    if (!personA || !personB) return;

    if (rel.startDate) {
      const date = new Date(rel.startDate);
      if (isValid(date)) {
        const isMarriage = rel.relationshipType === 'spouse' || rel.relationshipType === 'partner';
        events.push({
          id: `rel-start-${rel.id}`, type: isMarriage ? 'marriage' : 'custom',
          title: isMarriage ? `נישואין: ${personA.firstName} ו${personB.firstName}` : `תחילת קשר`,
          date, people: [personA, personB], notes: rel.notes, isAnniversary: true, 
          color: isMarriage ? eventTypeConfig.marriage.color : '#7c3aed',
          textColor: eventTypeConfig.marriage.textColor,
          allDay: true,
        });
      }
    }
    if (rel.endDate) {
      const date = new Date(rel.endDate);
      if (isValid(date)) {
        const isDivorce = rel.relationshipType === 'ex_spouse' || rel.relationshipType === 'separated' || rel.relationshipType === 'ex_partner';
        events.push({
          id: `rel-end-${rel.id}`, type: isDivorce ? 'divorce' : 'custom',
          title: isDivorce ? `גירושין: ${personA.firstName} ו${personB.firstName}` : `סיום קשר`,
          date, people: [personA, personB], notes: rel.notes, isAnniversary: true,
          color: isDivorce ? eventTypeConfig.divorce.color : '#7c3aed',
          textColor: eventTypeConfig.divorce.textColor,
          allDay: true,
        });
      }
    }
  });

  manualEvents.forEach(event => {
    const date = new Date(event.date);
    if (isValid(date)) {
      const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
      let startDateTime = adjustedDate;
      if (!event.allDay && event.time) {
        const [hours, minutes] = event.time.split(':').map(Number);
        startDateTime = set(adjustedDate, { hours, minutes });
      }
      events.push({
        id: event.id, type: 'custom', title: event.title, date: startDateTime,
        people: [], notes: event.description, isAnniversary: false, color: event.color, textColor: 'text-white',
        allDay: event.allDay, time: event.time,
      });
    }
  });
  return events;
};
// --- END OF UNCHANGED DATA LOGIC ---


// --- HELPER COMPONENTS ---

const EventPopoverContent = ({ event }: { event: CalendarEvent }) => (
    <div className="p-4 space-y-3 max-w-sm" dir="rtl">
        <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: event.color }} />
            <div className="flex-1">
                <h3 className="font-bold text-lg">{event.title}</h3>
                <p className="text-sm text-muted-foreground">
                    {format(event.date, 'eeee, d MMMM yyyy', { locale: he })}
                    {event.isAnniversary && ` · לפני ${differenceInYears(new Date(), event.date)} שנים`}
                </p>
            </div>
        </div>
        {event.people.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t">
                {event.people.map(p => (
                    <Avatar key={p.id} className="h-8 w-8 border">
                        <AvatarImage src={p.photoURL || undefined} />
                        <AvatarFallback><img src={getPlaceholderImage(p.gender)} alt="avatar" /></AvatarFallback>
                    </Avatar>
                ))}
                <span className="text-sm font-medium">{event.people.map(p => p.firstName).join(', ')}</span>
            </div>
        )}
        {event.notes && (
            <div className="text-sm pt-2 border-t">
                <p className="italic text-muted-foreground">{event.notes}</p>
            </div>
        )}
    </div>
);

// --- VIEW COMPONENTS ---

const MonthView = ({ currentDate, events, onOpenEventEditor, onEventClick }: any) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const getEventsForDay = (day: Date) => {
        return events
            .filter((e: CalendarEvent) => {
                if (e.isAnniversary) {
                    return getMonth(e.date) === getMonth(day) && getDate(e.date) === getDate(day);
                }
                return isSameDay(e.date, day);
            })
            .slice(0, 3); // Limit to 3 visible events
    };

    return (
        <div className="flex-1 grid grid-cols-7 grid-rows-[auto,1fr] border-r border-t">
            {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2 border-b border-l">
                    {day}
                </div>
            ))}
            <div className="col-span-7 grid grid-cols-7 grid-rows-6 h-full">
                {days.map(day => {
                    const eventsOnDay = getEventsForDay(day);
                    return (
                        <div
                            key={day.toString()}
                            className="relative border-b border-l p-1 overflow-hidden group"
                            onClick={() => onOpenEventEditor({ date: format(day, 'yyyy-MM-dd'), allDay: true })}
                        >
                            <span className={cn(
                                "flex items-center justify-center h-6 w-6 rounded-full text-sm",
                                !isSameMonth(day, monthStart) && "text-muted-foreground/50",
                                isToday(day) && "bg-primary text-primary-foreground"
                            )}>
                                {format(day, 'd')}
                            </span>
                            <div className="mt-1 space-y-0.5">
                                {eventsOnDay.map((event: CalendarEvent) => (
                                    <Popover key={event.id}>
                                        <PopoverTrigger asChild>
                                             <div onClick={(e) => { e.stopPropagation(); }} className={cn("text-xs rounded px-1.5 py-0.5 truncate cursor-pointer", event.textColor)} style={{ backgroundColor: event.color }}>
                                                {event.title}
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 z-[1004]"><EventPopoverContent event={event} /></PopoverContent>
                                    </Popover>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TimeGridView = ({ currentDate, events, viewMode, onOpenEventEditor }: any) => {
    const numDays = viewMode === 'day' ? 1 : viewMode === 'four-day' ? 4 : 7;
    const days = eachDayOfInterval({ start: currentDate, end: addDays(currentDate, numDays - 1) });
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    const getEventsForDay = (day: Date) => {
        const allDay = events.filter((e: CalendarEvent) => e.allDay && (e.isAnniversary ? getMonth(e.date) === getMonth(day) && getDate(e.date) === getDate(day) : isSameDay(e.date, day)))
            .sort((a: CalendarEvent, b: CalendarEvent) => (a.people[0]?.birthDate || '').localeCompare(b.people[0]?.birthDate || ''));
        const timed = events.filter((e: CalendarEvent) => !e.allDay && isSameDay(e.date, day));
        return { allDay, timed };
    };

    return (
        <div className="flex flex-1 h-full border-t">
            <ScrollArea className="h-full">
                <div className="sticky top-0 z-20 bg-card pr-2">
                    <div className="h-12 border-b"></div>
                    <div className="h-10 border-b flex items-center justify-center text-xs text-muted-foreground">כל היום</div>
                </div>
                <div className="pr-2">
                    {hours.map(hour => (
                        <div key={hour} className="h-[60px] text-xs text-muted-foreground text-center relative -top-2">
                            {hour !== '00:00' && <span>{hour}</span>}
                        </div>
                    ))}
                </div>
            </ScrollArea>
            <div className="flex-1 flex overflow-x-auto">
                <div className="flex flex-1 min-w-max">
                     {days.map(day => {
                        const { allDay, timed } = getEventsForDay(day);
                        return (
                            <div key={day.toString()} className="flex-1 flex flex-col border-l min-w-[200px]">
                                <div className="text-center py-2 border-b sticky top-0 z-10 bg-card">
                                    <span className="text-sm text-muted-foreground">{format(day, 'eee', {locale: he})}</span>
                                    <p className={cn("text-2xl font-semibold", isToday(day) && "text-primary")}>{format(day, 'd')}</p>
                                </div>
                                <div className="border-b relative p-1 space-y-0.5 min-h-[41px]">
                                    {allDay.map((event: CalendarEvent) => (
                                         <Popover key={event.id}>
                                            <PopoverTrigger asChild>
                                                 <div className={cn("text-xs rounded px-1.5 py-0.5 truncate cursor-pointer", event.textColor)} style={{ backgroundColor: event.color }}>
                                                    {event.title}
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 z-[1004]"><EventPopoverContent event={event} /></PopoverContent>
                                        </Popover>
                                    ))}
                                </div>
                                <div className="flex-1 relative">
                                    {hours.map((_, index) => (
                                        <div key={index} className="h-[60px] border-b" onClick={() => onOpenEventEditor({ date: format(day, 'yyyy-MM-dd'), allDay: false, time: `${String(index).padStart(2, '0')}:00` })} />
                                    ))}
                                    {timed.map((event:CalendarEvent) => {
                                        const startHour = event.date.getHours() + event.date.getMinutes() / 60;
                                        const duration = 1; // Assume 1 hour for now
                                        return (
                                            <Popover key={event.id}>
                                                <PopoverTrigger asChild>
                                                    <div 
                                                        className={cn("absolute w-[95%] text-xs rounded px-1.5 py-0.5 truncate cursor-pointer z-10", event.textColor)} 
                                                        style={{ backgroundColor: event.color, top: `${startHour * 60}px`, height: `${duration * 60}px` }}
                                                        onClick={(e) => {e.stopPropagation()}}
                                                    >
                                                        {event.title} <span className="opacity-80">{event.time}</span>
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 z-[1004]"><EventPopoverContent event={event} /></PopoverContent>
                                            </Popover>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                     })}
                </div>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
export function CalendarView({
  people,
  relationships,
  manualEvents,
  onOpenEventEditor
}: {
  people: Person[];
  relationships: Relationship[];
  manualEvents: ManualEvent[];
  onOpenEventEditor: (event: Partial<ManualEvent> | null) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visibleTypes, setVisibleTypes] = useState<Record<CalendarEventType, boolean>>({
    birth: true, death: true, marriage: true, divorce: true, custom: true,
  });

  const allEvents = useMemo(() => processEvents(people, relationships, manualEvents), [people, relationships, manualEvents]);
  const filteredEvents = useMemo(() => allEvents.filter(event => visibleTypes[event.type]), [allEvents, visibleTypes]);

  const handleNavigate = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -1 : 1;
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, amount));
    else if (viewMode === 'week') setCurrentDate(addDays(currentDate, amount * 7));
    else if (viewMode === 'four-day') setCurrentDate(addDays(currentDate, amount * 4));
    else if (viewMode === 'day') setCurrentDate(addDays(currentDate, amount));
  };
  
  const handleToday = () => setCurrentDate(new Date());

  const dateRangeLabel = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: he });
    if (viewMode === 'day') return format(currentDate, 'd MMMM yyyy', { locale: he });
    const numDays = viewMode === 'week' ? 6 : 3;
    const endDate = addDays(currentDate, numDays);
    const startFormat = isSameMonth(currentDate, endDate) ? 'd' : 'd MMMM';
    return `${format(currentDate, startFormat, { locale: he })} - ${format(endDate, 'd MMMM yyyy', { locale: he })}`;
  }, [currentDate, viewMode]);

  const viewLabels: Record<ViewMode, string> = { month: 'חודש', week: 'שבוע', 'four-day': '4 ימים', day: 'יום' };

  return (
    <div className="h-full w-full flex flex-col bg-card" dir="rtl">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 p-2 md:p-4 border-b shrink-0">
            <div className="flex items-center gap-1 md:gap-2">
                <Button variant="outline" size="sm" onClick={handleToday}>היום</Button>
                <div className="flex">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleNavigate('prev')}><ChevronRight className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleNavigate('next')}><ChevronLeft className="h-4 w-4" /></Button>
                </div>
                <h2 className="text-base md:text-lg font-bold whitespace-nowrap">{dateRangeLabel}</h2>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenEventEditor({ date: format(new Date(), 'yyyy-MM-dd'), allDay: true })}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    הוסף אירוע
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm"><Filter className="ml-2 h-4 w-4" />סינון</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 z-[1003]">
                        <DropdownMenuLabel>הצג אירועים</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(eventTypeConfig).map(([type, config]) => (
                            <DropdownMenuCheckboxItem
                                key={type}
                                checked={visibleTypes[type as CalendarEventType]}
                                onCheckedChange={(checked) => setVisibleTypes(prev => ({...prev, [type]: !!checked}))}
                                className="justify-end gap-2"
                            >
                                <span>{config.label}</span>
                                <div className='w-2.5 h-2.5 rounded-full' style={{backgroundColor: config.color}}/>
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[100px] justify-between">
                            <span>{viewLabels[viewMode]}</span>
                            <ChevronDown className="h-4 w-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[100px] z-[1003]">
                        <DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                           {Object.keys(viewLabels).map((key) => (
                             <DropdownMenuRadioItem key={key} value={key} className="justify-end">
                                {viewLabels[key as ViewMode]}
                            </DropdownMenuRadioItem>
                           ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {/* View Area */}
        <div className="flex-1 overflow-hidden">
            {viewMode === 'month' ? (
                <MonthView currentDate={currentDate} events={filteredEvents} onOpenEventEditor={onOpenEventEditor} />
            ) : (
                <TimeGridView currentDate={currentDate} events={filteredEvents} viewMode={viewMode} onOpenEventEditor={onOpenEventEditor} />
            )}
        </div>
    </div>
  );
}
