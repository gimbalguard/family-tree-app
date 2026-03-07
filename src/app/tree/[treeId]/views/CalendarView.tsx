
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Person, Relationship, ManualEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DayPicker } from 'react-day-picker';
import {
  format,
  getYear,
  getMonth,
  getDate,
  differenceInYears,
  isValid
} from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter, PlusCircle, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';

type CalendarEventType = 'birth' | 'death' | 'marriage' | 'divorce' | 'custom';

const eventTypeConfig: Record<CalendarEventType, { label: string; color: string; }> = {
  birth: { label: 'יום הולדת', color: 'bg-green-600' },
  death: { label: 'יום פטירה', color: 'bg-gray-700' },
  marriage: { label: 'נישואין', color: 'bg-yellow-500' },
  divorce: { label: 'גירושין', color: 'bg-red-600' },
  custom: { label: 'אירוע', color: 'bg-purple-600' },
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
  allDay: boolean;
  time?: string;
};

const processEvents = (
  people: Person[],
  relationships: Relationship[],
  manualEvents: ManualEvent[],
): CalendarEvent[] => {
  const events: CalendarEvent[] = [];

  // 1. Family events (births, deaths, relationships)
  people.forEach((person) => {
    if (person.birthDate) {
      const date = new Date(person.birthDate);
      if (isValid(date)) {
        events.push({
          id: `birth-${person.id}`, type: 'birth', title: `יום הולדת של ${person.firstName} ${person.lastName}`,
          date, people: [person], isAnniversary: true, color: eventTypeConfig.birth.color, allDay: true,
        });
      }
    }
    if (person.deathDate) {
      const date = new Date(person.deathDate);
      if (isValid(date)) {
        events.push({
          id: `death-${person.id}`, type: 'death', title: `יום פטירה של ${person.firstName} ${person.lastName}`,
          date, people: [person], isAnniversary: true, color: eventTypeConfig.death.color, allDay: true,
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
          title: isMarriage ? `נישואין - ${personA.firstName} ו${personB.firstName}`: `תחילת קשר - ${personA.firstName} ו${personB.firstName}`,
          date, people: [personA, personB], notes: rel.notes, isAnniversary: isMarriage, color: eventTypeConfig[isMarriage ? 'marriage' : 'custom'].color, allDay: true,
        });
      }
    }

    if (rel.endDate) {
      const date = new Date(rel.endDate);
      if (isValid(date)) {
          const isDivorce = rel.relationshipType === 'ex_spouse' || rel.relationshipType === 'separated' || rel.relationshipType === 'ex_partner';
           events.push({
            id: `rel-end-${rel.id}`, type: isDivorce ? 'divorce' : 'custom',
            title: isDivorce ? `גירושין / פרידה - ${personA.firstName} ו${personB.firstName}` : `סיום קשר - ${personA.firstName} ו${personB.firstName}`,
            date, people: [personA, personB], notes: rel.notes, isAnniversary: isDivorce, color: eventTypeConfig[isDivorce ? 'divorce' : 'custom'].color, allDay: true,
        });
      }
    }
  });
  
  // 2. Manual events
  manualEvents.forEach(event => {
     const date = new Date(event.date);
     if (isValid(date)) {
        // Manual events can have time, so adjust date if needed (UTC issue)
        const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        events.push({
            id: event.id, type: 'custom', title: event.title,
            date: adjustedDate, people: [], notes: event.description, isAnniversary: false,
            color: event.color, allDay: event.allDay, time: event.time,
        });
     }
  });

  return events;
};

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
  const [month, setMonth] = useState(new Date());
  const [popoverState, setPopoverState] = useState<{
    open: boolean;
    target: HTMLElement | null;
    date: Date | null;
  }>({ open: false, target: null, date: null });

  const [visibleTypes, setVisibleTypes] = useState<Record<CalendarEventType, boolean>>({
    birth: true, death: true, marriage: true, divorce: true, custom: true,
  });

  const allEvents = useMemo(
    () => processEvents(people, relationships, manualEvents),
    [people, relationships, manualEvents]
  );
  
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => visibleTypes[event.type]);
  }, [allEvents, visibleTypes]);

  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
        const key = event.isAnniversary 
            ? `${getMonth(event.date)}-${getDate(event.date)}`
            : format(event.date, 'yyyy-MM-dd');
        
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(event);
    });
    return map;
  }, [filteredEvents]);
  
  const getEventsForDay = (date: Date): CalendarEvent[] => {
      const anniversaryKey = `${getMonth(date)}-${getDate(date)}`;
      const exactKey = format(date, 'yyyy-MM-dd');
      const anniversaryEvents = eventsByDayKey.get(anniversaryKey) || [];
      const exactEvents = eventsByDayKey.get(exactKey) || [];
      return [...anniversaryEvents, ...exactEvents].filter(e => e.isAnniversary || getYear(e.date) === getYear(date));
  };

  const formatDay = (date: Date) => {
    const eventsOnDay = getEventsForDay(date);
    const uniqueEventTypes = [...new Set(eventsOnDay.map(e => e.type))];

    return (
      <div className="relative h-full w-full flex items-center justify-center">
        {format(date, 'd')}
        {uniqueEventTypes.length > 0 && (
          <div className="absolute bottom-1 right-1 flex items-center justify-end gap-0.5">
            {uniqueEventTypes.slice(0, 4).map(type => (
              <div key={type} className={cn('h-1.5 w-1.5 rounded-full', eventTypeConfig[type]?.color || 'bg-gray-400')} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleDayClick = (date: Date, modifiers: any, e: React.MouseEvent<HTMLButtonElement>) => {
    if (modifiers.outside) return;
    const eventsOnDay = getEventsForDay(date);

    if (eventsOnDay.length > 0) {
        setPopoverState({ open: true, target: e.currentTarget, date });
    } else {
        // Open new event modal if an empty day is clicked
        onOpenEventEditor({ date: format(date, 'yyyy-MM-dd'), allDay: true });
    }
  }
  
  const EventCard = ({event}: {event: CalendarEvent}) => {
    const isCustom = event.type === 'custom';
    
    return (
         <div 
            key={event.id} 
            className="text-right border-b pb-3 last:border-b-0 cursor-pointer hover:bg-muted/50 -mx-1 px-1 rounded"
            onClick={() => {
                if(isCustom) {
                    const manualEvent = manualEvents.find(me => me.id === event.id);
                    if(manualEvent) onOpenEventEditor(manualEvent);
                }
            }}
        >
            <div className="flex items-center gap-2">
                <div className={cn("w-2.5 h-2.5 rounded-full", event.color)} />
                <p className="font-semibold">{event.title}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
                {format(event.date, 'd MMMM yyyy', { locale: he })}
                {event.isAnniversary && ` · לפני ${differenceInYears(new Date(), event.date)} שנים`}
            </p>
            {event.people.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                    {event.people.map(p => (
                        <Avatar key={p.id} className="h-7 w-7 border">
                            <AvatarImage src={p.photoURL || undefined} />
                            <AvatarFallback><img src={getPlaceholderImage(p.gender)} alt="avatar" /></AvatarFallback>
                        </Avatar>
                    ))}
                    <span className="text-sm">{event.people.map(p => p.firstName).join(', ')}</span>
                </div>
            )}
            {event.notes && (
                <div className="text-sm mt-2 pt-2 border-t">
                    <p className="italic text-muted-foreground">{event.notes}</p>
                </div>
            )}
        </div>
    )
  }

  function CalendarToolbar() {
    return (
      <div className="flex items-center justify-between gap-2 p-2 md:p-4 border-b">
         <div className="flex items-center gap-1 md:gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenEventEditor({ date: format(new Date(), 'yyyy-MM-dd'), allDay: true })}>
                <PlusCircle className="ml-2 h-4 w-4"/>
                הוסף אירוע
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Filter className="ml-2 h-4 w-4"/>
                        סינון
                    </Button>
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
                            <div className={cn('h-2.5 w-2.5 rounded-full', config.color)}/>
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <div className="flex items-center gap-1">
            <h2 className="text-base md:text-lg font-bold whitespace-nowrap">
                {format(month, 'MMMM yyyy', { locale: he })}
            </h2>
             <div className="flex">
                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(prev => new Date(prev.setMonth(prev.getMonth() - 1)))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(prev => new Date(prev.setMonth(prev.getMonth() + 1)))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>היום</Button>
        </div>
      </div>
    );
  }
  
  const eventsForPopover = popoverState.date ? getEventsForDay(popoverState.date) : [];

  return (
    <div className="h-full w-full flex flex-col bg-card" dir="rtl">
      <CalendarToolbar />
      <div className="flex-1 p-2 md:p-4 overflow-auto">
        <DayPicker
          month={month}
          onMonthChange={setMonth}
          locale={he}
          showOutsideDays
          onDayClick={handleDayClick}
          formatters={{ formatDay }}
          classNames={{
            months: 'w-full', month: 'w-full space-y-0',
            table: 'w-full border-collapse', caption: 'hidden',
            head_row: 'flex border-b', head_cell: 'w-[calc(100%/7)] text-muted-foreground text-sm font-normal py-2',
            row: 'flex w-full min-h-[6rem]', cell: 'w-[calc(100%/7)] text-center text-sm relative focus-within:relative focus-within:z-20 border-l border-b',
            day: 'h-full w-full p-1 focus:z-20',
            day_today: 'bg-accent/10 text-accent-foreground',
            day_outside: 'text-muted-foreground/50',
          }}
          components={{
            button: ({ children, ...props }) => React.cloneElement(
              (buttonVariants({ variant: 'ghost' }) as React.ReactElement),
              props,
              children
            ),
          }}
        />
        <Popover open={popoverState.open} onOpenChange={(open) => setPopoverState(p => ({...p, open}))}>
            <PopoverTrigger asChild>
                <div style={{
                    position: 'fixed',
                    top: popoverState.target?.getBoundingClientRect().bottom ?? 0 + window.scrollY,
                    left: popoverState.target?.getBoundingClientRect().left ?? 0 + window.scrollX,
                  }}
                />
            </PopoverTrigger>
            <PopoverContent className="w-80 z-[1003]" dir="rtl" align="start">
                 {popoverState.date && (
                    <div className="space-y-2">
                        <h4 className="font-medium text-lg leading-none text-right">
                        אירועים ליום {format(popoverState.date, 'd MMMM', {locale: he})}
                        </h4>
                        <ScrollArea className="h-80">
                            <div className="space-y-4 p-1">
                                {eventsForPopover.length > 0 ? eventsForPopover.map(event => <EventCard key={event.id} event={event} />)
                                 : <p className='text-sm text-muted-foreground text-center py-4'>אין אירועים ליום זה.</p>
                                }
                            </div>
                        </ScrollArea>
                    </div>
                 )}
            </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
