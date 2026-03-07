
'use client';

import React, { useState, useMemo } from 'react';
import type { Person, Relationship } from '@/lib/types';
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
import { DayPicker, DayContent, type DayContentProps } from 'react-day-picker';
import {
  format,
  getYear,
  getMonth,
  getDate,
  differenceInYears,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';

type CalendarEventType = 'birth' | 'death' | 'marriage' | 'divorce' | 'other';

const eventTypeConfig: Record<
  CalendarEventType,
  { label: string; color: string }
> = {
  birth: { label: 'יום הולדת', color: 'bg-green-500' },
  death: { label: 'יום פטירה', color: 'bg-gray-700' },
  marriage: { label: 'נישואין', color: 'bg-yellow-500' },
  divorce: { label: 'גירושין', color: 'bg-red-500' },
  other: { label: 'אירוע', color: 'bg-purple-500' },
};

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  date: Date;
  people: Person[];
  notes?: string | null;
  isAnniversary: boolean;
};

const processEvents = (
  people: Person[],
  relationships: Relationship[]
): CalendarEvent[] => {
  const events: CalendarEvent[] = [];

  people.forEach((person) => {
    if (person.birthDate) {
      try {
        const date = new Date(person.birthDate);
        if (!isNaN(date.getTime())) {
          events.push({
            id: `birth-${person.id}`,
            type: 'birth',
            title: `יום הולדת של ${person.firstName} ${person.lastName}`,
            date: date,
            people: [person],
            isAnniversary: true,
          });
        }
      } catch (e) { console.error("Invalid birth date:", person.birthDate); }
    }
    if (person.deathDate) {
      try {
        const date = new Date(person.deathDate);
        if (!isNaN(date.getTime())) {
          events.push({
              id: `death-${person.id}`,
              type: 'death',
              title: `יום פטירה של ${person.firstName} ${person.lastName}`,
              date: date,
              people: [person],
              isAnniversary: true,
          });
        }
      } catch (e) { console.error("Invalid death date:", person.deathDate); }
    }
  });

  relationships.forEach((rel) => {
    const personA = people.find((p) => p.id === rel.personAId);
    const personB = people.find((p) => p.id === rel.personBId);
    if (!personA || !personB) return;
    const involved = [personA, personB];
    const peopleNames = `${personA.firstName} ו${personB.firstName}`;

    if (rel.startDate) {
      try {
        const date = new Date(rel.startDate);
        if (!isNaN(date.getTime())) {
          let type: CalendarEventType = 'other';
          let title = `אירוע - ${peopleNames}`;
          let isAnniversary = false;

          if (rel.relationshipType === 'spouse') {
            type = 'marriage';
            title = `נישואין - ${peopleNames}`;
            isAnniversary = true;
          } else if (rel.relationshipType === 'partner') {
            title = `תחילת זוגיות - ${peopleNames}`;
          }

          events.push({
            id: `rel-start-${rel.id}`,
            type,
            title,
            date: date,
            people: involved,
            notes: rel.notes,
            isAnniversary,
          });
        }
      } catch(e) { console.error("Invalid relationship start date:", rel.startDate); }
    }

    if (rel.endDate) {
       try {
        const date = new Date(rel.endDate);
        if (!isNaN(date.getTime())) {
          let type: CalendarEventType = 'other';
          let title = `סיום אירוע - ${peopleNames}`;
          let isAnniversary = false;

          if (
            rel.relationshipType === 'ex_spouse' ||
            rel.relationshipType === 'separated'
          ) {
            type = 'divorce';
            title = `גירושין / פרידה - ${peopleNames}`;
            isAnniversary = true;
          } else if (rel.relationshipType === 'ex_partner') {
            title = `סיום זוגיות - ${peopleNames}`;
          }

          events.push({
            id: `rel-end-${rel.id}`,
            type,
            title,
            date: date,
            people: involved,
            notes: rel.notes,
            isAnniversary,
          });
        }
      } catch(e) { console.error("Invalid relationship end date:", rel.endDate); }
    }
  });

  return events;
};

export function CalendarView({
  people,
  relationships,
}: {
  people: Person[];
  relationships: Relationship[];
}) {
  const [month, setMonth] = useState(new Date());
  const [popoverState, setPopoverState] = useState<{
    open: boolean;
    target: HTMLElement | null;
    date: Date | null;
  }>({ open: false, target: null, date: null });

  const [visibleTypes, setVisibleTypes] = useState<
    Record<CalendarEventType, boolean>
  >({
    birth: true,
    death: true,
    marriage: true,
    divorce: true,
    other: true,
  });

  const allEvents = useMemo(
    () => processEvents(people, relationships),
    [people, relationships]
  );
  
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => visibleTypes[event.type]);
  }, [allEvents, visibleTypes]);

  const eventsByAnniversaryDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
        if (!event.isAnniversary) return;
        const key = `${getMonth(event.date)}-${getDate(event.date)}`;
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(event);
    });
    return map;
  }, [filteredEvents]);
  
  const eventsByExactDay = useMemo(() => {
      const map = new Map<string, CalendarEvent[]>();
      filteredEvents.forEach((event) => {
        if(event.isAnniversary) return;
        const key = format(event.date, 'yyyy-MM-dd');
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(event);
      });
      return map;
  }, [filteredEvents]);


  function CustomDayContent(props: DayContentProps) {
    const anniversaryKey = `${getMonth(props.date)}-${getDate(props.date)}`;
    const exactKey = format(props.date, 'yyyy-MM-dd');
    
    const anniversaryEventsOnDay = eventsByAnniversaryDay.get(anniversaryKey) || [];
    const exactEventsOnDay = eventsByExactDay.get(exactKey) || [];

    const allEventsOnDay = [...anniversaryEventsOnDay, ...exactEventsOnDay];
    if (props.isOutside || allEventsOnDay.length === 0) {
      return <DayContent {...props} />;
    }

    const uniqueEventTypes = [...new Set(allEventsOnDay.map(e => e.type))];

    return (
      <div className="relative h-full w-full">
        <DayContent {...props} />
        <div className="absolute bottom-1 right-1 flex items-center justify-end gap-0.5">
          {uniqueEventTypes.slice(0, 4).map(type => (
            <div key={type} className={cn('h-1.5 w-1.5 rounded-full', eventTypeConfig[type].color)} />
          ))}
        </div>
      </div>
    );
  }

  const handleDayClick = (date: Date, modifiers: any, e: React.MouseEvent<HTMLButtonElement>) => {
    if (modifiers.outside) return;

    const anniversaryKey = `${getMonth(date)}-${getDate(date)}`;
    const exactKey = format(date, 'yyyy-MM-dd');
    const hasAnniversaryEvents = (eventsByAnniversaryDay.get(anniversaryKey) || []).length > 0;
    const hasExactEvents = (eventsByExactDay.get(exactKey) || []).length > 0;

    if(hasAnniversaryEvents || hasExactEvents) {
        setPopoverState({ open: true, target: e.currentTarget, date });
    }
  }

  function CalendarToolbar() {
    return (
      <div className="flex items-center justify-between gap-2 p-2 md:p-4 border-b">
         <div className="flex items-center gap-1 md:gap-2">
            <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>היום</Button>
            <div className="flex">
                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(prev => new Date(prev.setMonth(prev.getMonth() - 1)))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(prev => new Date(prev.setMonth(prev.getMonth() + 1)))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>
             <h2 className="text-base md:text-lg font-bold whitespace-nowrap">
                {format(month, 'MMMM yyyy', { locale: he })}
            </h2>
        </div>
        
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
    );
  }
  
  const eventsForPopover = useMemo(() => {
      if(!popoverState.date) return [];
      const anniversaryKey = `${getMonth(popoverState.date)}-${getDate(popoverState.date)}`;
      const exactKey = format(popoverState.date, 'yyyy-MM-dd');
      const anniversaryEvents = eventsByAnniversaryDay.get(anniversaryKey) || [];
      const exactEvents = eventsByExactDay.get(exactKey) || [];
      return [...anniversaryEvents, ...exactEvents].sort((a,b) => getYear(a.date) - getYear(b.date));
  }, [popoverState.date, eventsByAnniversaryDay, eventsByExactDay]);

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
          components={{
            DayContent: CustomDayContent,
          }}
          classNames={{
            months: 'w-full',
            month: 'w-full space-y-0',
            table: 'w-full border-collapse',
            caption: 'hidden',
            head_row: 'flex border-b',
            head_cell: 'w-[calc(100%/7)] text-muted-foreground text-sm font-normal py-2',
            row: 'flex w-full min-h-[6rem]',
            cell: 'w-[calc(100%/7)] text-center text-sm relative focus-within:relative focus-within:z-20 border-l border-b',
            day: 'h-full w-full p-1',
            day_today: 'bg-accent/10 text-accent-foreground',
            day_outside: 'text-muted-foreground/50',
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
                                {eventsForPopover.map(event => (
                                    <div key={event.id} className="text-right border-b pb-3 last:border-b-0">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2.5 h-2.5 rounded-full", eventTypeConfig[event.type].color)} />
                                            <p className="font-semibold">{event.title}</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {format(event.date, 'd MMMM yyyy', { locale: he })}
                                            {event.isAnniversary && ` · לפני ${differenceInYears(new Date(), event.date)} שנים`}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            {event.people.map(p => (
                                                <Avatar key={p.id} className="h-7 w-7 border">
                                                    <AvatarImage src={p.photoURL || undefined} />
                                                    <AvatarFallback><img src={getPlaceholderImage(p.gender)} alt="avatar" /></AvatarFallback>
                                                </Avatar>
                                            ))}
                                            <span className="text-sm">{event.people.map(p => p.firstName).join(', ')}</span>
                                        </div>
                                        {event.notes && (
                                            <div className="text-sm mt-2 pt-2 border-t">
                                                <p className="italic text-muted-foreground">{event.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
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
