'use client';

import React, { useState, useMemo } from 'react';
import type { Person, Relationship } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DayPicker, Row } from 'react-day-picker';
import {
  format,
  getYear,
  getMonth,
  getDate,
  differenceInYears,
  setYear,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type CalendarEventType = 'birth' | 'death' | 'marriage' | 'divorce' | 'other';

const eventTypeConfig: Record<
  CalendarEventType,
  { label: string; className: string }
> = {
  birth: { label: 'יום הולדת', className: 'bg-green-600 text-white' },
  death: { label: 'יום פטירה', className: 'bg-black text-white' },
  marriage: { label: 'נישואין', className: 'bg-yellow-600 text-white' },
  divorce: { label: 'גירושין', className: 'bg-red-600 text-white' },
  other: { label: 'אירוע', className: 'bg-purple-600 text-white' },
};

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  date: Date;
  people: Person[];
  notes?: string | null;
};

const processEvents = (
  people: Person[],
  relationships: Relationship[]
): CalendarEvent[] => {
  const events: CalendarEvent[] = [];

  people.forEach((person) => {
    if (person.birthDate) {
      const date = new Date(person.birthDate);
      if (!isNaN(date.getTime())) {
        events.push({
          id: `birth-${person.id}`,
          type: 'birth',
          title: `יום הולדת - ${person.firstName} ${person.lastName}`,
          date: date,
          people: [person],
        });
      }
    }
    if (person.deathDate) {
      const date = new Date(person.deathDate);
       if (!isNaN(date.getTime())) {
        events.push({
            id: `death-${person.id}`,
            type: 'death',
            title: `יום פטירה - ${person.firstName} ${person.lastName}`,
            date: date,
            people: [person],
        });
      }
    }
  });

  relationships.forEach((rel) => {
    const personA = people.find((p) => p.id === rel.personAId);
    const personB = people.find((p) => p.id === rel.personBId);
    if (!personA || !personB) return;
    const involved = [personA, personB];
    const peopleNames = `${personA.firstName} ו${personB.firstName}`;

    if (rel.startDate) {
      const date = new Date(rel.startDate);
       if (!isNaN(date.getTime())) {
        let type: CalendarEventType = 'other';
        let title = `אירוע - ${peopleNames}`;

        if (rel.relationshipType === 'spouse') {
          type = 'marriage';
          title = `נישואין - ${peopleNames}`;
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
        });
      }
    }

    if (rel.endDate) {
      const date = new Date(rel.endDate);
      if (!isNaN(date.getTime())) {
        let type: CalendarEventType = 'other';
        let title = `סיום אירוע - ${peopleNames}`;

        if (
          rel.relationshipType === 'ex_spouse' ||
          rel.relationshipType === 'separated'
        ) {
          type = 'divorce';
          title = `גירושין / פרידה - ${peopleNames}`;
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
        });
      }
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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      const key = `${getMonth(event.date)}-${getDate(event.date)}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(event);
    });
    return map;
  }, [filteredEvents]);

  const toggleTypeVisibility = (type: CalendarEventType) => {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  function DayCell({ date, displayMonth }: { date: Date; displayMonth: Date }) {
    if (getMonth(date) !== getMonth(displayMonth)) {
      return (
        <div className="h-32 border-t border-r first:border-r-0"></div>
      );
    }
    const dayKey = `${getMonth(date)}-${getDate(date)}`;
    const dayEvents = eventsByDay.get(dayKey) || [];

    return (
      <div className="h-32 border-t border-r first:border-r-0 p-1 flex flex-col gap-1 overflow-hidden">
        <div className="font-semibold text-right text-sm">
          {format(date, 'd')}
        </div>
        <ScrollArea className="flex-1">
            <div className="flex flex-col gap-1 pr-1">
            {dayEvents.map((event) => (
                <Popover key={event.id}>
                <PopoverTrigger asChild>
                    <div
                    className={cn(
                        'p-1 rounded-sm text-xs cursor-pointer truncate text-right',
                        eventTypeConfig[event.type].className
                    )}
                    >
                    {event.title}
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-80 z-[1003]" dir="rtl">
                    <div className="space-y-2">
                    <h4 className="font-medium leading-none text-right">
                        {eventTypeConfig[event.type].label}
                    </h4>
                    <p className="text-sm text-muted-foreground text-right">
                        {event.title}
                    </p>
                    <p className="text-sm text-right">
                        {format(event.date, 'd MMMM yyyy', { locale: he })}
                        {' · '}
                        לפני {differenceInYears(setYear(new Date(), getYear(month)), event.date)} שנים
                    </p>
                    <div className="text-sm text-right">
                        <span className="font-medium">מעורבים: </span>
                        {event.people.map((p) => `${p.firstName} ${p.lastName}`).join(', ')}
                    </div>
                    {event.notes && (
                        <div className="text-sm text-right pt-2 border-t mt-2">
                        <p className="font-medium">הערות:</p>
                        <p className="text-muted-foreground">{event.notes}</p>
                        </div>
                    )}
                    </div>
                </PopoverContent>
                </Popover>
            ))}
            </div>
        </ScrollArea>
      </div>
    );
  }

  function CalendarToolbar() {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 p-4 border-b">
        {Object.entries(eventTypeConfig).map(([type, config]) => (
          <Button
            key={type}
            onClick={() => toggleTypeVisibility(type as CalendarEventType)}
            variant="outline"
            size="sm"
            className={cn(
              'transition-all',
              visibleTypes[type as CalendarEventType]
                ? config.className
                : 'opacity-50'
            )}
          >
            {config.label}
          </Button>
        ))}
      </div>
    );
  }
  
  function CustomCaption({ displayMonth }: { displayMonth: Date }) {
     return (
        <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-lg font-bold">
                {format(displayMonth, 'MMMM yyyy', { locale: he })}
            </h2>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>היום</Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(prev => new Date(prev.setMonth(prev.getMonth() - 1)))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(prev => new Date(prev.setMonth(prev.getMonth() + 1)))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-card" dir="rtl">
      <CalendarToolbar />
      <div className="flex-1 p-4 overflow-auto">
        <DayPicker
          month={month}
          onMonthChange={setMonth}
          locale={he}
          showOutsideDays
          components={{
            Caption: CustomCaption,
            Row: (props) => (
                <Row {...props} className="flex w-full mt-2 first:mt-0" />
            ),
            Day: DayCell,
          }}
          classNames={{
            months: 'w-full',
            month: 'w-full space-y-0',
            table: 'w-full border-collapse',
            head_row: 'flex border-b',
            head_cell: 'w-[calc(100%/7)] text-muted-foreground text-sm font-normal py-2 border-r first:border-r-0',
            cell: 'w-[calc(100%/7)]',
          }}
        />
      </div>
    </div>
  );
}
