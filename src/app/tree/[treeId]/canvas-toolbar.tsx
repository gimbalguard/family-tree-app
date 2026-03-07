'use client';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  UserPlus,
  ArrowLeft,
  MessageSquare,
  Undo2,
  Redo2,
  Network,
  GanttChart,
  Table as TableIcon,
  Map as MapIcon,
  Calendar as CalendarIcon,
  BarChart,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ViewMode } from './tree-page-client';

const viewOptions: {
  value: ViewMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: 'tree', label: 'עץ', icon: <Network className="h-4 w-4" /> },
  {
    value: 'timeline',
    label: 'ציר זמן',
    icon: <GanttChart className="h-4 w-4" />,
  },
  { value: 'table', label: 'טבלה', icon: <TableIcon className="h-4 w-4" /> },
  { value: 'map', label: 'מפה', icon: <MapIcon className="h-4 w-4" /> },
  {
    value: 'calendar',
    label: 'לוח שנה',
    icon: <CalendarIcon className="h-4 w-4" />,
  },
  {
    value: 'statistics',
    label: 'סטטיסטיקות',
    icon: <BarChart className="h-4 w-4" />,
  },
];

type CanvasToolbarProps = {
  onAddPerson: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
};

export function CanvasToolbar({
  onAddPerson,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  viewMode,
  setViewMode,
}: CanvasToolbarProps) {
  const currentView =
    viewOptions.find((opt) => opt.value === viewMode) || viewOptions[0];

  return (
    <aside className="flex flex-col items-center gap-4 border-r bg-card p-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>חזרה ללוח הבקרה</p>
        </TooltipContent>
      </Tooltip>

      <div className="w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                {currentView.icon}
                <span className="text-sm">{currentView.label}</span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="left"
            className="w-[var(--radix-dropdown-menu-trigger-width)] z-[1003]"
          >
            {viewOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setViewMode(option.value)}
                className="gap-2"
              >
                {option.icon}
                <span>{option.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        variant="outline"
        onClick={onAddPerson}
        className="h-auto w-full flex-col p-3"
      >
        <UserPlus className="mb-1 h-6 w-6" />
        <span className="text-xs">הוסף אדם חדש</span>
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" disabled>
            {' '}
            {/* Disabled for now */}
            <MessageSquare className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>עריכה עם AI (בקרוב)</p>
        </TooltipContent>
      </Tooltip>

      <div className="flex-grow" />

      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>בטל</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>בצע שוב</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
