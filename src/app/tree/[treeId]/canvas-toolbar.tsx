'use client';
import React, { useCallback, useState } from 'react';
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
  Presentation,
  FileSpreadsheet,
  Image as ImageIcon,
  Globe,
  Printer,
  Book,
  BookMarked,
  Link as LinkIcon,
  Upload,
  Shrink,
  Expand,
  Trophy,
  LayoutPanelTop,
  Wand2,
  Files,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import type { ViewMode, CanvasAspectRatio } from './tree-page-client';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import type { Person } from '@/lib/types';

const viewOptions: {
  value: ViewMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  iconColor?: string;
}[] = [
  { value: 'tree', label: 'עץ', icon: <Network />, color: '#26a69a' },
  { value: 'timeline', label: 'ציר זמן', icon: <GanttChart />, color: '#7c3aed' },
  { value: 'table', label: 'טבלה', icon: <TableIcon />, color: '#2563eb' },
  { value: 'map', label: 'מפה', icon: <MapIcon />, color: '#16a34a' },
  { value: 'calendar', label: 'לוח שנה', icon: <CalendarIcon />, color: '#ea580c' },
  { value: 'statistics', label: 'סטטיסטיקות', icon: <BarChart />, color: '#db2777' },
  { value: 'roots', label: 'עבודת שורשים', icon: <BookMarked />, color: '#6366f1', iconColor: '#6366f1' },
  { value: 'trivia', label: 'טריוויה', icon: <Trophy />, color: '#f59e0b', iconColor: '#f59e0b' },
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
  canvasAspectRatio: CanvasAspectRatio;
  setCanvasAspectRatio: (ratio: CanvasAspectRatio) => void;
  // New search props
  people: Person[];
  onSelectSearchResult: (nodeId: string) => void;
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
  canvasAspectRatio,
  setCanvasAspectRatio,
  people,
  onSelectSearchResult,
}: CanvasToolbarProps) {
  const { toast } = useToast();
  const router = useRouter();

  // Search state — fully self-contained, no external deps
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const filteredPeople = searchQuery.trim().length > 0
    ? people.filter(p => {
        const full = `${p.firstName} ${p.lastName}`.toLowerCase();
        const query = searchQuery.toLowerCase().trim();
        return full.includes(query) ||
          p.firstName.toLowerCase().includes(query) ||
          p.lastName.toLowerCase().includes(query) ||
          (p.nickname && p.nickname.toLowerCase().includes(query));
      })
    : people.slice(0, 10); // Show first 10 when no query

  const handleSearchSelect = useCallback((personId: string) => {
    onSelectSearchResult(personId);
    setIsSearchOpen(false);
    setSearchQuery('');
  }, [onSelectSearchResult]);

  const handleComingSoonClick = () => {
    toast({ title: 'בקרוב', description: 'אפשרות זו תהיה זמינה בעדכונים הבאים.' });
  };

  const exportOptions = [
    { label: 'PDF', icon: <FileText />, onClick: onOpenPdfModal },
    { label: 'אקסל', icon: <FileSpreadsheet />, onClick: onExportExcel },
    { label: 'פאוורפוינט', icon: <Presentation />, onClick: onOpenPptExport },
    { label: 'תמונה', icon: <ImageIcon />, onClick: onOpenImageExport },
    { label: 'HTML אינטראקטיבי', icon: <Globe />, onClick: handleComingSoonClick },
    { label: 'הדפסה', icon: <Printer />, onClick: handleComingSoonClick },
    { label: 'עבודת שורשים', icon: <Book />, onClick: handleComingSoonClick },
  ];

  if (!readOnly) {
    exportOptions.push({ label: 'שיתוף קישור', icon: <LinkIcon />, onClick: handleComingSoonClick });
  }

  const showEdgeStylePicker = viewMode === 'tree' || viewMode === 'timeline';
  const isRootsView = viewMode === 'roots';

  return (
    <aside className="flex flex-col items-center gap-4 border-l bg-card p-2" data-export-hide>
      <div className="flex w-full justify-center gap-2">
        {viewMode === 'tree' && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <LayoutPanelTop className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right"><p>יחס תצוגה</p></TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right">
              <DropdownMenuRadioGroup value={canvasAspectRatio} onValueChange={(value) => setCanvasAspectRatio(value as any)}>
                <DropdownMenuRadioItem value="free">חופשי</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="a4-landscape">A4 לרוחב</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="a4-portrait">A4 לגובה</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="16:9-landscape">16:9 לרוחב</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="16:9-portrait">16:9 לגובה</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="1:1">ריבוע</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right"><p>חזרה ללוח הבקרה</p></TooltipContent>
        </Tooltip>
      </div>

      <div className="flex w-full justify-center gap-2">
        {!readOnly && (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="default" size="icon" className="w-12 h-12" onClick={onAddPerson}>
                        <UserPlus className="h-6 w-6" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>הוסף אדם חדש</p></TooltipContent>
            </Tooltip>
        )}
        
        {viewMode === 'roots' && !readOnly && (
            <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-12 h-12" asChild>
                <Link href="/my-files">
                    <Files className="h-6 w-6" />
                </Link>
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
                <p>הקבצים שלי</p>
            </TooltipContent>
            </Tooltip>
        )}
      </div>
      
      <Separator className="w-full my-1" />

      {/* View mode grid */}
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
                {React.cloneElement(option.icon as React.ReactElement, {
                  className: "h-6 w-6",
                  style: viewMode !== option.value && option.iconColor ? { color: option.iconColor } : {}
                })}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>{option.label}</p></TooltipContent>
          </Tooltip>
        ))}
      </div>

      {!readOnly && (
        <div className="w-full flex flex-col items-center gap-1">
          <Separator className="my-1 w-full" />

          {isRootsView ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full bg-gradient-to-br from-teal-600/30 to-indigo-600/30 text-white hover:from-teal-500/40 hover:to-indigo-500/40 border border-teal-500/30"
                  onClick={onToggleChat}
                >
                  <Wand2 className="ml-2 h-4 w-4" />
                  <span>עורך AI</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>פתח עוזר AI לעריכת העיצוב</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full" onClick={onToggleChat}>
                  <MessageSquare className="ml-2 h-4 w-4" />
                  <span>AI Chat</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>פתח עוזר AI להוספת נתונים</p>
              </TooltipContent>
            </Tooltip>
          )}

          {showEdgeStylePicker && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full">
                  <Spline className="ml-2 h-4 w-4" />
                  <span>סגנון קו</span>
                  <ChevronDown className="mr-auto h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" className="w-[var(--radix-dropdown-menu-trigger-width)] z-[1003]">
                {edgeStyleOptions.map((option) => (
                  <DropdownMenuItem key={option.value} onClick={() => setEdgeType(option.value)} className="gap-2">
                    <span>{option.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Person search — NEW feature, separate from everything above */}
          {viewMode === 'tree' && (
            <Popover open={isSearchOpen} onOpenChange={(open) => {
              setIsSearchOpen(open);
              if (!open) setSearchQuery('');
            }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full">
                      <Search className="ml-2 h-4 w-4" />
                      <span>חפש אדם</span>
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="right"><p>חפש אדם בעץ</p></TooltipContent>
              </Tooltip>
              <PopoverContent
                side="right"
                align="start"
                className="w-72 p-2 z-[1003]"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div dir="rtl" className="flex flex-col gap-2">
                  <Input
                    placeholder="הקלד שם לחיפוש..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 text-right"
                    autoFocus
                  />
                  <ScrollArea className="max-h-64">
                    {filteredPeople.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">לא נמצאו תוצאות</p>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {filteredPeople.map((person) => (
                          <Button
                            key={person.id}
                            variant="ghost"
                            className="w-full justify-start text-right h-9 px-2"
                            onMouseDown={(e) => {
                              // Use onMouseDown to fire before the popover blur closes it
                              e.preventDefault();
                              handleSearchSelect(person.id);
                            }}
                          >
                            <span className="truncate">
                              {person.firstName} {person.lastName}
                              {person.nickname ? ` (${person.nickname})` : ''}
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {viewMode === 'timeline' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggleTimelineCompact}>
              {isTimelineCompact ? <Expand className="h-5 w-5" /> : <Shrink className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{isTimelineCompact ? 'הרחב טיימליין' : 'צמצם טיימליין'}</p>
          </TooltipContent>
        </Tooltip>
      )}

      <div className="flex-grow" />

      {!readOnly && (
        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onOpenSettings} className="border border-black">
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>הגדרות</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onOpenAccount} className="border border-black">
                  <User className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>חשבון</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => router.push(`/tree/${treeId}/help`)} className="border border-black">
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>עזרה</p></TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      <Separator className="my-2 w-full" />

      <div className="flex w-full flex-col items-center gap-2">
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo}>
                <Redo2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>בצע שוב</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo}>
                <Undo2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>בטל</p></TooltipContent>
          </Tooltip>
        </div>

        {viewMode !== 'trivia' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="default" size="sm" className="w-full">
                <Download className="h-4 w-4 ml-2" />
                <span className="text-sm">ייצוא / הדפסה</span>
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
                  <Separator className="my-2" />
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