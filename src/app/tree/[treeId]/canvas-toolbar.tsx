
'use client';
import React, { useCallback } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
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
  Presentation,
  FileSpreadsheet,
  Image as ImageIcon,
  Globe,
  Printer,
  Book,
  Link as LinkIcon,
  Upload,
  Shrink,
  Expand,
  Trophy,
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
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const viewOptions: {
  value: ViewMode;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { value: 'tree', label: 'עץ', icon: <Network />, color: '#26a69a' },
  { value: 'timeline', label: 'ציר זמן', icon: <GanttChart />, color: '#7c3aed' },
  { value: 'table', label: 'טבלה', icon: <TableIcon />, color: '#2563eb' },
  { value: 'map', label: 'מפה', icon: <MapIcon />, color: '#16a34a' },
  { value: 'calendar', label: 'לוח שנה', icon: <CalendarIcon />, color: '#ea580c' },
  { value: 'statistics', label: 'סטטיסטיקות', icon: <BarChart />, color: '#db2777' },
  { value: 'trivia', label: 'טריוויה', icon: <Trophy />, color: '#d97706' },
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
  onOpenPdfModal: () => void;
  onExportExcel: () => void;
  onOpenImageExport: () => void;
  onOpenPptExport: () => void;
  onImportClick: () => void;
  isTimelineCompact: boolean;
  onToggleTimelineCompact: () => void;
  readOnly: boolean;
  onBack: () => void;
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
  onOpenPdfModal,
  onExportExcel,
  onOpenImageExport,
  onOpenPptExport,
  onImportClick,
  isTimelineCompact,
  onToggleTimelineCompact,
  readOnly,
  onBack,
}: CanvasToolbarProps) {
  const { toast } = useToast();

  const exportOptions = [
    { label: 'PDF', icon: <FileText />, onClick: onOpenPdfModal },
    { label: 'אקסל', icon: <FileSpreadsheet />, onClick: onExportExcel },
    { label: 'פאוורפוינט', icon: <Presentation />, onClick: onOpenPptExport },
    { label: 'תמונה', icon: <ImageIcon />, onClick: onOpenImageExport },
    { label: 'HTML אינטראקטיבי', icon: <Globe />, onClick: () => handleComingSoonClick() },
    { label: 'הדפסה', icon: <Printer />, onClick: () => handleComingSoonClick() },
    { label: 'עבודת שורשים', icon: <Book />, onClick: () => handleComingSoonClick() },
  ];

   if (!readOnly) {
    exportOptions.push({ label: 'שיתוף קישור', icon: <LinkIcon />, onClick: () => handleComingSoonClick() });
  }

  const handleComingSoonClick = () => {
    toast({
      title: 'בקרוב',
      description: 'אפשרות זו תהיה זמינה בעדכונים הבאים.',
    });
  };

  return (
    <aside className="flex flex-col items-center gap-4 border-l bg-card p-2" data-export-hide>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>חזרה ללוח הבקרה</p>
        </TooltipContent>
      </Tooltip>

      <div className="grid grid-cols-2 gap-2">
         {viewOptions.map((option) => (
           <Tooltip key={option.value}>
             <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode(option.value)}
                  style={viewMode === option.value ? { backgroundColor: option.color } : {}}
                  className={cn(
                    "transition-all duration-200 w-12 h-12",
                    viewMode === option.value ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {React.cloneElement(option.icon as React.ReactElement, { className: "h-6 w-6" })}
                </Button>
             </TooltipTrigger>
             <TooltipContent side="right"><p>{option.label}</p></TooltipContent>
           </Tooltip>
         ))}
      </div>


      {!readOnly && (
        <div className="w-full flex flex-col items-center gap-1">
          <Separator className="my-1 w-full" />
          <Button variant="ghost" size="sm" className="w-full" onClick={onToggleChat}>
            <MessageSquare className="ml-2 h-4 w-4" />
            <span>AI Chat</span>
          </Button>

          {(viewMode === 'tree' || viewMode === 'timeline') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full">
                    <Spline className="ml-2 h-4 w-4" />
                    <span>Line Style</span>
                    <ChevronDown className="mr-auto h-4 w-4 opacity-50" />
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
          )}
        </div>
      )}
      
      {viewMode === 'timeline' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTimelineCompact}
            >
              {isTimelineCompact ? (
                <Expand className="h-5 w-5" />
              ) : (
                <Shrink className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{isTimelineCompact ? 'הרחב טיימליין' : 'צמצם טיימליין'}</p>
          </TooltipContent>
        </Tooltip>
      )}


      <div className="flex-grow" />

      {!readOnly && (
        <div className="flex w-full flex-col gap-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-2 border border-black"
            onClick={onOpenSettings}
          >
            <Settings className="h-5 w-5" />
            <span>הגדרות</span>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-2 border border-black"
            onClick={onOpenAccount}
          >
            <User className="h-5 w-5" />
            <span>חשבון</span>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-2 border border-black"
            onClick={() => window.open(`/tree/${treeId}/help`, '_blank')}
          >
            <HelpCircle className="h-5 w-5" />
            <span>עזרה</span>
          </Button>
        </div>
      )}

      <Separator className="my-2 w-full" />

      <div className="flex w-full flex-col items-center gap-2">
        {!readOnly && viewMode !== 'trivia' && (
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
        )}
        {viewMode !== 'trivia' && (
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
            <PopoverContent side="right" align="center" className="w-80 z-[1003] p-2">
              <div className="grid grid-cols-3 gap-1" dir="rtl">
                {exportOptions.map((option) => (
                  <Button
                    key={option.label}
                    variant="ghost"
                    className="flex h-auto flex-col items-center justify-center gap-1.5 p-3"
                    onClick={option.onClick}
                  >
                    {React.cloneElement(option.icon, { className: 'h-7 w-7' })}
                    <span className="text-xs text-center">{option.label}</span>
                  </Button>
                ))}
              </div>
              {!readOnly && (
                  <>
                  <Separator className="my-2"/>
                  <Button
                    variant="ghost"
                    className="flex w-full h-auto flex-col items-center justify-center gap-1.5 p-3"
                    onClick={onImportClick}
                  >
                    <Upload className="h-7 w-7" />
                    <span className="text-xs text-center">ייבוא מקובץ Excel</span>
                  </Button>
                  </>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </aside>
  );
}
