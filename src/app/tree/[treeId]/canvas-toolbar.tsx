'use client';
import React from 'react';
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
  Settings,
  User,
  HelpCircle,
  Spline,
  Download,
  FileText,
  FileSpreadsheet,
  FilePresentation,
  Image as ImageIcon,
  Globe,
  Printer,
  Book,
  Link as LinkIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ViewMode } from './tree-page-client';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

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

const edgeStyleOptions: {
  value: 'step' | 'default' | 'straight';
  label: string;
}[] = [
  { value: 'step', label: 'חד' },
  { value: 'default', label: 'גלי' },
  { value: 'straight', label: 'ישר' },
];

type CanvasToolbarProps = {
  onAddPerson: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  edgeType: 'default' | 'step' | 'straight';
  setEdgeType: (type: 'default' | 'step' | 'straight') => void;
  treeId: string;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  onToggleChat: () => void;
};

export function CanvasToolbar({
  onAddPerson,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  viewMode,
  setViewMode,
  edgeType,
  setEdgeType,
  treeId,
  onOpenSettings,
  onOpenAccount,
  onToggleChat,
}: CanvasToolbarProps) {
  const { toast } = useToast();
  const currentView =
    viewOptions.find((opt) => opt.value === viewMode) || viewOptions[0];

  const exportOptions = [
    { label: 'PDF', icon: <FileText /> },
    { label: 'אקסל', icon: <FileSpreadsheet /> },
    { label: 'פאוורפוינט', icon: <FilePresentation /> },
    { label: 'תמונה', icon: <ImageIcon /> },
    { label: 'HTML אינטראקטיבי', icon: <Globe /> },
    { label: 'הדפסה', icon: <Printer /> },
    { label: 'עבודת שורשים', icon: <Book /> },
    { label: 'שיתוף קישור', icon: <LinkIcon /> },
  ];

  const handleComingSoonClick = () => {
    toast({
      title: 'בקרוב',
      description: 'אפשרות זו תהיה זמינה בעדכונים הבאים.',
    });
  };

  return (
    <aside className="flex flex-col items-center gap-4 border-l bg-card p-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
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
            side="right"
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
          <Button variant="ghost" size="icon" onClick={onToggleChat}>
            <MessageSquare className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>עריכה עם AI</p>
        </TooltipContent>
      </Tooltip>

      {(viewMode === 'tree' || viewMode === 'timeline') && (
        <div className="w-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Spline className="h-4 w-4" />
                  <span className="text-sm">סגנון קו</span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              className="w-[var(--radix-dropdown-menu-trigger-width)] z-[1003]"
            >
              {edgeStyleOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setEdgeType(option.value)}
                  className="gap-2"
                >
                  <span>{option.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="flex-grow" />

      <div className="flex w-full flex-col gap-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
          onClick={onOpenSettings}
        >
          <Settings className="h-5 w-5" />
          <span>הגדרות</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
          onClick={onOpenAccount}
        >
          <User className="h-5 w-5" />
          <span>חשבון</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
          onClick={() => window.open(`/tree/${treeId}/help`, '_blank')}
        >
          <HelpCircle className="h-5 w-5" />
          <span>עזרה</span>
        </Button>
      </div>

      <Separator className="my-2 w-full" />

      <div className="flex w-full flex-col items-center gap-2">
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
            <TooltipContent side="right">
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
            <TooltipContent side="right">
              <p>בצע שוב</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="w-full h-auto py-2 flex-col"
              style={{ backgroundColor: '#2563eb' }}
            >
              <Download className="mb-1 h-5 w-5" />
              <span className="text-xs">ייצוא / הדפסה</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" align="center" className="w-80 z-[1003]">
            <div className="grid grid-cols-3 gap-2" dir="rtl">
              {exportOptions.map((option) => (
                <Button
                  key={option.label}
                  variant="ghost"
                  className="flex h-auto flex-col items-center justify-center gap-1.5 p-3"
                  onClick={handleComingSoonClick}
                >
                  {React.cloneElement(option.icon, { className: 'h-7 w-7' })}
                  <span className="text-xs text-center">{option.label}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}
