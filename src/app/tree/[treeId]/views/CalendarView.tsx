'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Person, Relationship, ManualEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  format,
  addDays,
  addMonths,
  addWeeks,
  subDays,
  subMonths,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  differenceInYears,
  isValid,
  getMonth,
  getDate,
  getYear,
  parseISO,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter, PlusCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | '4day' | 'day';

type CalendarEventType = 'birth' | 'death' | 'marriage' | 'divorce' | 'custom';

const EVENT_CONFIG: Record<CalendarEventType, { label: string; bg: string; hex: string }> = {
  birth:    { label: 'יום הולדת', bg: 'bg-green-600',  hex: '#16a34a' },
  death:    { label: 'יום פטירה', bg: 'bg-gray-800',   hex: '#1a1a1a' },
  marriage: { label: 'נישואין',   bg: 'bg-yellow-500', hex: '#ca8a04' },
  divorce:  { label: 'גירושין',   bg: 'bg-red-600',    hex: '#dc2626' },
  custom:   { label: 'אירוע',     bg: 'bg-purple-600', hex: '#7c3aed' },
};

type CalEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  originalDate: Date;       // the actual historical date
  people: Person[];
  notes?: string | null;
  isAnniversary: boolean;
  colorHex: string;
  colorBg: string;
  allDay: boolean;
  time?: string;
  sortYear: number;         // birth year of first person (for sorting)
};

// ─── Event Processing ─────────────────────────────────────────────────────────

function processEvents(
  people: Person[],
  relationships: Relationship[],
  manualEvents: ManualEvent[],
): CalEvent[] {
  const events: CalEvent[] = [];

  people.forEach((person) => {
    if (person.birthDate) {
      const d = new Date(person.birthDate);
      if (isValid(d)) {
        events.push({
          id: `birth-${person.id}`,
          type: 'birth',
          title: `יום הולדת — ${person.firstName} ${person.lastName}`,
          originalDate: d,
          people: [person],
          isAnniversary: true,
          colorHex: EVENT_CONFIG.birth.hex,
          colorBg: EVENT_CONFIG.birth.bg,
          allDay: true,
          sortYear: getYear(d),
        });
      }
    }
    if (person.deathDate) {
      const d = new Date(person.deathDate);
      if (isValid(d)) {
        events.push({
          id: `death-${person.id}`,
          type: 'death',
          title: `יום פטירה — ${person.firstName} ${person.lastName}`,
          originalDate: d,
          people: [person],
          isAnniversary: true,
          colorHex: EVENT_CONFIG.death.hex,
          colorBg: EVENT_CONFIG.death.bg,
          allDay: true,
          sortYear: person.birthDate ? getYear(new Date(person.birthDate)) : 9999,
        });
      }
    }
  });

  relationships.forEach((rel) => {
    const pA = people.find((p) => p.id === rel.personAId);
    const pB = people.find((p) => p.id === rel.personBId);
    if (!pA || !pB) return;

    const isSpouse = rel.relationshipType === 'spouse' || rel.relationshipType === 'partner';
    const isDivorce =
      rel.relationshipType === 'ex_spouse' ||
      rel.relationshipType === 'separated' ||
      rel.relationshipType === 'ex_partner';

    if (rel.startDate) {
      const d = new Date(rel.startDate);
      if (isValid(d)) {
        events.push({
          id: `rel-start-${rel.id}`,
          type: isSpouse ? 'marriage' : 'custom',
          title: isSpouse
            ? `נישואין — ${pA.firstName} ו${pB.firstName}`
            : `תחילת קשר — ${pA.firstName} ו${pB.firstName}`,
          originalDate: d,
          people: [pA, pB],
          notes: rel.notes,
          isAnniversary: isSpouse,
          colorHex: EVENT_CONFIG[isSpouse ? 'marriage' : 'custom'].hex,
          colorBg: EVENT_CONFIG[isSpouse ? 'marriage' : 'custom'].bg,
          allDay: true,
          sortYear: pA.birthDate ? getYear(new Date(pA.birthDate)) : 9999,
        });
      }
    }

    if (rel.endDate) {
      const d = new Date(rel.endDate);
      if (isValid(d)) {
        events.push({
          id: `rel-end-${rel.id}`,
          type: isDivorce ? 'divorce' : 'custom',
          title: isDivorce
            ? `גירושין — ${pA.firstName} ו${pB.firstName}`
            : `סיום קשר — ${pA.firstName} ו${pB.firstName}`,
          originalDate: d,
          people: [pA, pB],
          notes: rel.notes,
          isAnniversary: isDivorce,
          colorHex: EVENT_CONFIG[isDivorce ? 'divorce' : 'custom'].hex,
          colorBg: EVENT_CONFIG[isDivorce ? 'divorce' : 'custom'].bg,
          allDay: true,
          sortYear: pA.birthDate ? getYear(new Date(pA.birthDate)) : 9999,
        });
      }
    }
  });

  manualEvents.forEach((me) => {
    const d = parseISO(me.date);
    if (isValid(d)) {
      events.push({
        id: me.id,
        type: 'custom',
        title: me.title,
        originalDate: d,
        people: [],
        notes: me.description,
        isAnniversary: false,
        colorHex: me.color,
        colorBg: 'bg-purple-600',
        allDay: me.allDay,
        time: me.time,
        sortYear: 9999,
      });
    }
  });

  return events;
}

// ─── Helper: get events for a specific calendar day ───────────────────────────

function getEventsForDay(allEvents: CalEvent[], day: Date): CalEvent[] {
  const results: CalEvent[] = [];
  const dayMonth = getMonth(day);
  const dayDate = getDate(day);
  const dayYear = getYear(day);

  allEvents.forEach((ev) => {
    if (ev.isAnniversary) {
      if (getMonth(ev.originalDate) === dayMonth && getDate(ev.originalDate) === dayDate) {
        results.push(ev);
      }
    } else {
      if (isSameDay(ev.originalDate, day)) {
        results.push(ev);
      }
    }
  });

  // Sort: by sortYear ascending (oldest first)
  return results.sort((a, b) => a.sortYear - b.sortYear);
}

// ─── Event Detail Popover ─────────────────────────────────────────────────────

function EventDetailPopover({
  event,
  viewingYear,
  onClose,
  onEditManual,
  onEditPerson,
}: {
  event: CalEvent;
  viewingYear: number;
  onClose: () => void;
  onEditManual?: (id: string) => void;
  onEditPerson?: (personId: string) => void;
}) {
  const yearsAgo = event.isAnniversary
    ? differenceInYears(new Date(viewingYear, getMonth(event.originalDate), getDate(event.originalDate)), event.originalDate)
    : null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-80 p-4 space-y-3"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.colorHex }} />
            <h3 className="font-bold text-base leading-tight">{event.title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {format(event.originalDate, 'd MMMM yyyy', { locale: he })}
          {yearsAgo !== null && yearsAgo > 0 && ` · לפני ${yearsAgo} שנים`}
        </p>

        {event.people.length > 0 && (
          <div className="space-y-2">
            {event.people.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border flex-shrink-0">
                  <AvatarImage src={p.photoURL || undefined} />
                  <AvatarFallback>
                    <img src={getPlaceholderImage(p.gender)} alt="avatar" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm flex-1">{p.firstName} {p.lastName}</span>
                {onEditPerson && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    onClick={() => { onEditPerson(p.id); onClose(); }}
                  >
                    פתח כרטיס
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {event.notes && (
          <p className="text-sm italic text-muted-foreground border-t pt-2">{event.notes}</p>
        )}

        {event.type === 'custom' && onEditManual && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => { onEditManual(event.id); onClose(); }}
          >
            עריכת אירוע
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Event Pill ───────────────────────────────────────────────────────────────

function EventPill({
  event,
  onClick,
  compact = false,
}: {
  event: CalEvent;
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded text-white text-xs font-medium cursor-pointer truncate px-1.5 py-0.5 leading-tight',
        compact ? 'py-0' : 'py-0.5',
      )}
      style={{ backgroundColor: event.colorHex }}
      onClick={onClick}
      title={event.title}
    >
      {event.title}
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  filteredEvents,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  filteredEvents: CalEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalEvent, day: Date) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  return (
    <div className="flex flex-col h-full">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-muted-foreground py-2">
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const eventsOnDay = getEventsForDay(filteredEvents, day);
          const inMonth = isSameMonth(day, currentDate);
          const todayDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'border-b border-l min-h-[5rem] p-1 cursor-pointer hover:bg-muted/30 transition-colors',
                !inMonth && 'bg-muted/10',
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="flex justify-end mb-1">
                <span
                  className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    todayDay && 'bg-blue-600 text-white',
                    !todayDay && !inMonth && 'text-muted-foreground/50',
                    !todayDay && inMonth && 'text-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-0.5">
                {eventsOnDay.slice(0, 3).map((ev) => (
                  <EventPill
                    key={ev.id}
                    event={ev}
                    compact
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev, day); }}
                  />
                ))}
                {eventsOnDay.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{eventsOnDay.length - 3} נוספים
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Multi-Day View (week / 4-day / day) ─────────────────────────────────────

const HOUR_HEIGHT = 48; // px per hour
const EVENT_BLOCK_HEIGHT = HOUR_HEIGHT * 0.75; // 45 min equivalent

function MultiDayView({
  days,
  filteredEvents,
  onDayClick,
  onEventClick,
}: {
  days: Date[];
  filteredEvents: CalEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalEvent, day: Date) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column headers */}
      <div className="flex border-b flex-shrink-0">
        {/* Gutter */}
        <div className="w-14 flex-shrink-0" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              'flex-1 text-center py-2 border-l cursor-pointer hover:bg-muted/20',
              isToday(day) && 'bg-blue-50 dark:bg-blue-950/20',
            )}
            onClick={() => onDayClick(day)}
          >
            <div className="text-xs text-muted-foreground">
              {['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'][day.getDay()]}
            </div>
            <div
              className={cn(
                'text-lg font-semibold w-9 h-9 mx-auto flex items-center justify-center rounded-full',
                isToday(day) && 'bg-blue-600 text-white',
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Hourly grid (scrollable) — events placed starting at 08:00 */}
      <ScrollArea className="flex-1">
        <div className="flex" style={{ height: `${HOUR_HEIGHT * 24}px` }}>
          {/* Time gutter */}
          <div className="w-14 flex-shrink-0 relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute text-right pr-2 text-xs text-muted-foreground"
                style={{ top: h * HOUR_HEIGHT - 8, width: '100%' }}
              >
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const evs = getEventsForDay(filteredEvents, day);
            return (
              <div
                key={day.toISOString()}
                className="flex-1 border-l relative cursor-pointer"
                style={{ height: `${HOUR_HEIGHT * 24}px` }}
                onClick={() => onDayClick(day)}
              >
                {/* Hour lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-border/40"
                    style={{ top: h * HOUR_HEIGHT }}
                  />
                ))}
                {/* Events — stacked from 08:00, each 45 min tall */}
                {evs.map((ev, index) => (
                  <div
                    key={ev.id}
                    className="absolute left-0.5 right-0.5 rounded text-white text-xs font-medium cursor-pointer px-1.5 flex items-center truncate shadow-sm"
                    style={{
                      backgroundColor: ev.colorHex,
                      top: 8 * HOUR_HEIGHT + index * (EVENT_BLOCK_HEIGHT + 2),
                      height: EVENT_BLOCK_HEIGHT,
                    }}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev, day); }}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({
  viewMode,
  setViewMode,
  currentDate,
  onPrev,
  onNext,
  onToday,
  visibleTypes,
  setVisibleTypes,
  onAddEvent,
}: {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  visibleTypes: Record<CalendarEventType, boolean>;
  setVisibleTypes: React.Dispatch<React.SetStateAction<Record<CalendarEventType, boolean>>>;
  onAddEvent: () => void;
}) {
  const VIEW_LABELS: Record<ViewMode, string> = {
    month: 'חודש',
    week: 'שבוע',
    '4day': '4 ימים',
    day: 'יום',
  };

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: he });
    if (viewMode === 'day') return format(currentDate, 'EEEE, d MMMM yyyy', { locale: he });
    const start = viewMode === 'week'
      ? startOfWeek(currentDate, { weekStartsOn: 0 })
      : currentDate;
    const end = addDays(start, viewMode === 'week' ? 6 : 3);
    return `${format(start, 'd MMM', { locale: he })} – ${format(end, 'd MMM yyyy', { locale: he })}`;
  }, [viewMode, currentDate]);

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b flex-shrink-0 bg-card" dir="rtl">
      {/* Right side: today + nav + label */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>היום</Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-base font-bold whitespace-nowrap">{headerLabel}</h2>
      </div>

      {/* Left side: view switcher + filter + add */}
      <div className="flex items-center gap-2">
        {/* View switcher */}
        <div className="flex border rounded-md overflow-hidden">
          {(['month', 'week', '4day', 'day'] as ViewMode[]).map((v) => (
            <button
              key={v}
              className={cn(
                'px-3 py-1 text-sm border-l last:border-l-0 transition-colors',
                viewMode === v
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/50',
              )}
              onClick={() => setViewMode(v)}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="ml-2 h-4 w-4" />
              סינון
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 z-[1003]" dir="rtl">
            <DropdownMenuLabel>הצג אירועים</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.entries(EVENT_CONFIG) as [CalendarEventType, typeof EVENT_CONFIG[CalendarEventType]][]).map(
              ([type, cfg]) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={visibleTypes[type]}
                  onCheckedChange={(checked) =>
                    setVisibleTypes((prev) => ({ ...prev, [type]: !!checked }))
                  }
                  className="justify-end gap-2"
                >
                  <span>{cfg.label}</span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.hex }} />
                </DropdownMenuCheckboxItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Add event */}
        <Button size="sm" onClick={onAddEvent}>
          <PlusCircle className="ml-2 h-4 w-4" />
          הוסף אירוע
        </Button>
      </div>
    </div>
  );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

export function CalendarView({
  people,
  relationships,
  manualEvents,
  onOpenEventEditor,
  onEditPerson,
}: {
  people: Person[];
  relationships: Relationship[];
  manualEvents: ManualEvent[];
  onOpenEventEditor: (event: Partial<ManualEvent> | null) => void;
  onEditPerson?: (personId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<{ event: CalEvent; day: Date } | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Record<CalendarEventType, boolean>>({
    birth: true,
    death: true,
    marriage: true,
    divorce: true,
    custom: true,
  });

  const allEvents = useMemo(
    () => processEvents(people, relationships, manualEvents),
    [people, relationships, manualEvents],
  );

  const filteredEvents = useMemo(
    () => allEvents.filter((e) => visibleTypes[e.type]),
    [allEvents, visibleTypes],
  );

  // Navigation
  const handlePrev = useCallback(() => {
    if (viewMode === 'month') setCurrentDate((d) => subMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else if (viewMode === '4day') setCurrentDate((d) => subDays(d, 4));
    else setCurrentDate((d) => subDays(d, 1));
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === 'month') setCurrentDate((d) => addMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else if (viewMode === '4day') setCurrentDate((d) => addDays(d, 4));
    else setCurrentDate((d) => addDays(d, 1));
  }, [viewMode]);

  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  // Days for multi-day views
  const multiDayDays = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    if (viewMode === '4day') {
      return eachDayOfInterval({ start: currentDate, end: addDays(currentDate, 3) });
    }
    if (viewMode === 'day') {
      return [currentDate];
    }
    return [];
  }, [viewMode, currentDate]);

  const handleDayClick = useCallback(
    (day: Date) => {
      const evs = getEventsForDay(filteredEvents, day);
      if (evs.length === 0) {
        onOpenEventEditor({ date: format(day, 'yyyy-MM-dd'), allDay: true });
      }
      // If there are events, they handle their own click
    },
    [filteredEvents, onOpenEventEditor],
  );

  const handleEventClick = useCallback((event: CalEvent, day: Date) => {
    setSelectedEvent({ event, day });
  }, []);

  const handleEditManual = useCallback(
    (id: string) => {
      const me = manualEvents.find((e) => e.id === id);
      if (me) onOpenEventEditor(me);
    },
    [manualEvents, onOpenEventEditor],
  );

  return (
    <div className="h-full w-full flex flex-col bg-card overflow-hidden" dir="rtl">
      <Toolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        visibleTypes={visibleTypes}
        setVisibleTypes={setVisibleTypes}
        onAddEvent={() =>
          onOpenEventEditor({ date: format(currentDate, 'yyyy-MM-dd'), allDay: true })
        }
      />

      <div className="flex-1 overflow-hidden">
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            filteredEvents={filteredEvents}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        )}
        {(viewMode === 'week' || viewMode === '4day' || viewMode === 'day') && (
          <MultiDayView
            days={multiDayDays}
            filteredEvents={filteredEvents}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Event detail popover */}
      {selectedEvent && (
        <EventDetailPopover
          event={selectedEvent.event}
          viewingYear={getYear(selectedEvent.day)}
          onClose={() => setSelectedEvent(null)}
          onEditManual={handleEditManual}
          onEditPerson={onEditPerson}
        />
      )}
    </div>
  );
}